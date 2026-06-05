import type { APIRoute } from 'astro'
import { env } from 'cloudflare:workers'
import Anthropic from '@anthropic-ai/sdk'
import { createClient } from '@supabase/supabase-js'
import { getPromptConfig } from '../../lib/ai'
import { extractSearchTerms, lookupSpine } from '../../lib/ask-spine'
import { ANTIQUES_ANTIQUES_SITE_ID, CLAUDE_INPUT_COST_PENCE_PER_TOKEN, CLAUDE_OUTPUT_COST_PENCE_PER_TOKEN } from '../../lib/constants'
import type { CloudflareEnv } from '../../lib/constants'


/** Simple hash for cache key */
function hashQuestion(question: string, context: string): string {
  const str = `${context}::${question.toLowerCase().trim()}`
  let hash = 0
  for (let i = 0; i < str.length; i++) {
    const char = str.codePointAt(i) ?? 0
    hash = ((hash << 5) - hash) + char
    hash = hash & hash
  }
  return Math.abs(hash).toString(36)
}

export const POST: APIRoute = async ({ request }) => {
  try {
    const {
      message,
      history = [],
      context = 'general',
      user_id,
      identification_result
    } = await request.json()

    if (!message) {
      return new Response(JSON.stringify({ error: 'No message provided' }), {
        status: 400,
        headers: { 'Content-Type': 'application/json' }
      })
    }

    const supabase = createClient(
      (env as unknown as CloudflareEnv).PUBLIC_SUPABASE_URL,
      (env as unknown as CloudflareEnv).SUPABASE_SERVICE_ROLE_KEY
    )

    // 1. Deduct credit for logged-in users
    if (user_id) {
      const { data: creditOk } = await supabase.rpc('deduct_ask_message_credit', {
        p_user_id: user_id,
        p_site_id: ANTIQUES_SITE_ID
      })
      if (!creditOk) {
        return new Response(JSON.stringify({ error: 'Insufficient credits' }), {
          status: 402,
          headers: { 'Content-Type': 'application/json' }
        })
      }
    }

    // 2. Cache check
    const questionHash = hashQuestion(message, context)
    const { data: cached } = await supabase
      .from('ask_cache')
      .select('answer, sources, hit_count')
      .eq('site_id', ANTIQUES_SITE_ID)
      .eq('question_hash', questionHash)
      .single()

    if (cached) {
      await supabase
        .from('ask_cache')
        .update({ hit_count: (cached.hit_count || 0) + 1, updated_at: new Date().toISOString() })
        .eq('site_id', ANTIQUES_SITE_ID)
        .eq('question_hash', questionHash)

      return new Response(JSON.stringify({
        answer: cached.answer,
        sources: cached.sources || [],
        marks: [],
        cached: true,
        tokens: { input: 0, output: 0, cost_pence: 0 }
      }), {
        status: 200,
        headers: { 'Content-Type': 'application/json' }
      })
    }

    // 3. Spine lookup
    const terms = extractSearchTerms(message)
    const { sources, contextBlocks, marks } = await lookupSpine(supabase, terms, context, identification_result)

    // 4. Fetch prompt from ai_prompts
    const activePrompt = await getPromptConfig(supabase, context, 'ask_system_prompt, model, max_tokens, hint_message_2, hint_message_3, gate_cta_text')
    if (!activePrompt?.ask_system_prompt) {
      return new Response(JSON.stringify({ error: 'Ask prompt not configured' }), {
        status: 500,
        headers: { 'Content-Type': 'application/json' }
      })
    }

    // Build system prompt with spine context
    let systemPrompt = activePrompt.ask_system_prompt
    if (contextBlocks.length > 0) {
      systemPrompt += `\n\nGAUK SPINE CONTEXT — use this authoritative data in your answer:\n${contextBlocks.join('\n')}`
    }
    if (identification_result) {
      systemPrompt += `\n\nCURRENT IDENTIFICATION CONTEXT:\nCategory: ${identification_result.category || ''}\nItem: ${identification_result.subcategory || ''}\nMaker: ${identification_result.maker || 'unknown'}\nPeriod: ${identification_result.period || 'unknown'}\nCondition: ${identification_result.condition || 'unknown'}`
    }

    // 5. Summarise history if getting long
    const trimmedHistory = history.length > 12
      ? history.slice(-8)
      : history

    // 6. Call Claude
    const client = new Anthropic({ apiKey: (env as unknown as CloudflareEnv).ANTHROPIC_API_KEY })

    const response = await client.messages.create({
      model: activePrompt.model || 'claude-sonnet-4-6',
      max_tokens: 1024,
      system: systemPrompt,
      messages: [
        ...trimmedHistory,
        { role: 'user', content: message }
      ]
    })

    const answer = response.content[0].type === 'text' ? response.content[0].text : ''
    const inputTokens = response.usage.input_tokens
    const outputTokens = response.usage.output_tokens
    const costPence = Math.ceil((inputTokens * CLAUDE_INPUT_COST_PENCE_PER_TOKEN) + (outputTokens * CLAUDE_OUTPUT_COST_PENCE_PER_TOKEN))

    // 7. Write to ask_cache
    await supabase
      .from('ask_cache')
      .insert({
        site_id: ANTIQUES_SITE_ID,
        question_hash: questionHash,
        question: message,
        answer,
        sources: sources.length > 0 ? sources : null,
        hit_count: 1
      })

    // 8. Log token usage
    await supabase
      .from('token_usage')
      .insert({
        site_id: ANTIQUES_SITE_ID,
        user_id: user_id || null,
        feature: 'ask',
        model: activePrompt.model || 'claude-sonnet-4-6',
        input_tokens: inputTokens,
        output_tokens: outputTokens,
        cost_pence: costPence
      })

    return new Response(JSON.stringify({
      answer,
      sources,
      marks,
      hints: {
        message_2: activePrompt.hint_message_2 || null,
        message_3: activePrompt.hint_message_3 || null,
      },
      cached: false,
      tokens: { input: inputTokens, output: outputTokens, cost_pence: costPence }
    }), {
      status: 200,
      headers: { 'Content-Type': 'application/json' }
    })

  } catch (err: any) {
    return new Response(JSON.stringify({ error: err.message }), {
      status: 500,
      headers: { 'Content-Type': 'application/json' }
    })
  }
}
