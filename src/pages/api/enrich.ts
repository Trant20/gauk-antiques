import type { APIRoute } from 'astro'
import { env } from 'cloudflare:workers'
import Anthropic from '@anthropic-ai/sdk'
import { createClient } from '@supabase/supabase-js'
import { ANTIQUES_SITE_ID, CLAUDE_INPUT_COST_PENCE_PER_TOKEN, CLAUDE_OUTPUT_COST_PENCE_PER_TOKEN } from '../../lib/constants'
import { getPromptConfig } from '../../lib/ai'
import type { CloudflareEnv } from '../../lib/constants'


function getSupabase() {
  return createClient(
    (env as unknown as CloudflareEnv).PUBLIC_SUPABASE_URL,
    (env as unknown as CloudflareEnv).SUPABASE_SERVICE_ROLE_KEY
  )
}

function json(data: unknown, status = 200) {
  return new Response(JSON.stringify(data), {
    status,
    headers: { 'Content-Type': 'application/json' }
  })
}


export const POST: APIRoute = async ({ request }) => {
  try {
    const auth = request.headers.get('Authorization')
    if (!auth?.startsWith('Bearer ')) {
      return json({ error: 'Unauthorized' }, 401)
    }

    const token = auth.slice(7)
    const supabase = getSupabase()

    const { data: { user }, error: authError } = await supabase.auth.getUser(token)
    if (authError || !user) return json({ error: 'Invalid token' }, 401)

    const { identification_id, result } = await request.json()
    if (!result) return json({ error: 'No identification result provided' }, 400)

    // Fetch credit cost from site_settings
    const { data: costSetting } = await supabase
      .from('site_settings')
      .select('value')
      .eq('site_id', ANTIQUES_SITE_ID)
      .eq('key', 'credit_cost_enrich')
      .single()
    const creditCost = parseInt(costSetting?.value ?? '5', 10)

    // Deduct credits before AI call — reject if insufficient
    for (let i = 0; i < creditCost; i++) {
      const { data: ok } = await supabase.rpc('deduct_identification_credit', {
        p_user_id: user.id,
        p_site_id: ANTIQUES_SITE_ID,
        p_identification_id: identification_id || null
      })
      if (!ok) return json({ error: 'Insufficient credits' }, 402)
    }

    const promptConfig = await getPromptConfig(supabase, 'enrich', 'system_prompt, model, max_tokens')
    if (!promptConfig?.system_prompt) return json({ error: 'Enrich prompt not configured' }, 500)

    const client = new Anthropic({ apiKey: (env as unknown as CloudflareEnv).ANTHROPIC_API_KEY })
    const response = await client.messages.create({
      model: String(promptConfig.model || 'claude-sonnet-4-6'),
      max_tokens: Number(promptConfig.max_tokens || 4096),
      system: String(promptConfig.system_prompt),
      messages: [{
        role: 'user',
        content: `Generate enrichment content for this antique identification:\n\n${JSON.stringify(result, null, 2)}`
      }]
    })

    if (!response.content[0] || response.content[0].type !== 'text') {
      return json({ error: 'No response from AI' }, 500)
    }

    let enrichment: unknown
    try {
      const raw = response.content[0].text
      const clean = raw.replaceAll('```json', '').replaceAll('```', '').trim()
      enrichment = JSON.parse(clean)
    } catch {
      return json({ error: 'AI returned malformed response' }, 500)
    }

    if (identification_id) {
      const { error: updateError } = await supabase
        .from('identifications')
        .update({ enrichment_json: enrichment })
        .eq('id', identification_id)
      if (updateError) console.error('Enrichment update error:', updateError)
    }

    const inputTokens = response.usage.input_tokens
    const outputTokens = response.usage.output_tokens
    const costPence = Math.ceil((inputTokens * CLAUDE_INPUT_COST_PENCE_PER_TOKEN) + (outputTokens * CLAUDE_OUTPUT_COST_PENCE_PER_TOKEN))
    await supabase.from('token_usage').insert({
      site_id: ANTIQUES_SITE_ID,
      user_id: user.id,
      feature: 'enrich',
      model: String(promptConfig.model || 'claude-sonnet-4-6'),
      input_tokens: inputTokens,
      output_tokens: outputTokens,
      cost_pence: costPence
    })

    return json({ enrichment })

  } catch (err: any) {
    return json({ error: err.message }, 500)
  }
}
