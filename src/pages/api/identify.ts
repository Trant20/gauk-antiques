import type { APIRoute } from 'astro'
import { env } from 'cloudflare:workers'
import Anthropic from '@anthropic-ai/sdk'
import { createClient } from '@supabase/supabase-js'
import { getPromptConfig } from '../../lib/ai'
import { ANTIQUES_SITE_ID, CLAUDE_INPUT_COST_PENCE_PER_TOKEN, CLAUDE_OUTPUT_COST_PENCE_PER_TOKEN } from '../../lib/constants'
import type { CloudflareEnv } from '../../lib/constants'

const GUEST_IDENTIFY_LIMIT = 2
const GUEST_IDENTIFY_TTL = 60 * 60 * 24 // 24 hours in seconds

function arrayBufferToBase64(buffer: ArrayBuffer): string {
  const bytes = new Uint8Array(buffer)
  let binary = ''
  const chunkSize = 8192
  for (let i = 0; i < bytes.length; i += chunkSize) {
    const chunk = bytes.subarray(i, i + chunkSize)
    binary += String.fromCodePoint(...chunk)
  }
  return btoa(binary)
}

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
    const { key, secondary_key, context = 'general' } = await request.json()

    if (!key) return json({ error: 'No image key provided' }, 400)

    const supabase = getSupabase()
    const auth = request.headers.get('Authorization')
    let userId: string | null = null

    if (auth?.startsWith('Bearer ')) {
      // Logged-in user — verify token and check credits
      const token = auth.slice(7)
      const { data: { user }, error: authError } = await supabase.auth.getUser(token)
      if (authError || !user) return json({ error: 'Invalid token' }, 401)
      userId = user.id

      // Fetch credit cost from site_settings
      const { data: costSetting } = await supabase
        .from('site_settings')
        .select('value')
        .eq('site_id', ANTIQUES_SITE_ID)
        .eq('key', 'credit_cost_identify')
        .single()
      const creditCost = parseInt(costSetting?.value ?? '1', 10)

      // Deduct credits before AI call — reject if insufficient
      for (let i = 0; i < creditCost; i++) {
        const { data: ok } = await supabase.rpc('deduct_identification_credit', {
          p_user_id: userId,
          p_site_id: ANTIQUES_SITE_ID,
          p_identification_id: null
        })
        if (!ok) return json({ error: 'Insufficient credits' }, 402)
      }
    } else {
      // Guest — enforce limit via KV
      const kv = (env as unknown as CloudflareEnv).SESSION
      const ip = request.headers.get('CF-Connecting-IP') || 'unknown'
      const kvKey = `guest_identify:${ip}`

      if (kv) {
        const existing = await kv.get(kvKey)
        const count = existing ? parseInt(existing, 10) : 0
        if (count >= GUEST_IDENTIFY_LIMIT) {
          return json({ error: 'Guest limit reached. Register free to continue.', guest_limit: true }, 429)
        }
      }
    }

    const promptConfig = await getPromptConfig(supabase, context, 'system_prompt, description_instruction, model, max_tokens, gate_cta_text')
    if (!promptConfig) return json({ error: 'Prompt configuration not found' }, 500)

    const systemPrompt = promptConfig.system_prompt.replace(
      '{{DESCRIPTION_INSTRUCTION}}',
      promptConfig.description_instruction
    )

    const bucket = (env as unknown as CloudflareEnv).gauk_antiques_images
    const object = await bucket.get(key)
    if (!object) return json({ error: 'Image not found in R2' }, 404)

    const arrayBuffer = await object.arrayBuffer()
    const base64 = arrayBufferToBase64(arrayBuffer)
    const rawContentType = object.httpMetadata?.contentType || 'image/jpeg'
    const allowed = new Set(['image/jpeg', 'image/png', 'image/gif', 'image/webp'])
    const contentType = allowed.has(rawContentType) ? rawContentType : 'image/jpeg'

    let secondary: { base64: string; contentType: string } | null = null
    if (secondary_key) {
      const secObject = await bucket.get(secondary_key)
      if (secObject) {
        const secBuffer = await secObject.arrayBuffer()
        const secRaw = secObject.httpMetadata?.contentType || 'image/jpeg'
        secondary = {
          base64: arrayBufferToBase64(secBuffer),
          contentType: allowed.has(secRaw) ? secRaw : 'image/jpeg'
        }
      }
    }

    const client = new Anthropic({ apiKey: (env as unknown as CloudflareEnv).ANTHROPIC_API_KEY })
    const response = await client.messages.create({
      model: promptConfig.model,
      max_tokens: promptConfig.max_tokens,
      system: systemPrompt,
      messages: [{
        role: 'user',
        content: [
          {
            type: 'image',
            source: { type: 'base64' as const, media_type: contentType as 'image/jpeg' | 'image/png' | 'image/gif' | 'image/webp', data: base64 }
          },
          ...(secondary ? [{
            type: 'image' as const,
            source: { type: 'base64' as const, media_type: secondary.contentType as 'image/jpeg' | 'image/png' | 'image/gif' | 'image/webp', data: secondary.base64 }
          }] : []),
          {
            type: 'text',
            text: secondary
              ? 'Identify and appraise this antique. The first image shows the front or main view. The second image shows the back, base, or maker mark. Use both images together for the most accurate identification. Return only the JSON.'
              : 'Identify and appraise this antique. Return only the JSON.'
          }
        ]
      }]
    })

    if (!response.content[0] || response.content[0].type !== 'text') {
      return json({ error: 'No response from AI' }, 500)
    }

    let result: unknown
    try {
      const raw = response.content[0].text
      const clean = raw.replaceAll('```json', '').replaceAll('```', '').trim()
      result = JSON.parse(clean)
    } catch {
      return json({ error: 'AI returned malformed response' }, 500)
    }

    const { data: record, error: dbError } = await supabase
      .from('identifications')
      .insert({
        site_id: ANTIQUES_SITE_ID,
        user_id: userId,
        image_key: key,
        secondary_image_key: secondary_key || null,
        result_json: result,
        category: (result as any).category,
        maker: (result as any).maker,
        period: (result as any).period,
        value_range_low: (result as any).value_range_low,
        value_range_high: (result as any).value_range_high,
        confidence: (result as any).confidence
      })
      .select()
      .single()

    if (dbError) console.error('DB write error:', dbError)

    // Log token usage
    const inputTokens = response.usage.input_tokens
    const outputTokens = response.usage.output_tokens
    const costPence = Math.ceil((inputTokens * CLAUDE_INPUT_COST_PENCE_PER_TOKEN) + (outputTokens * CLAUDE_OUTPUT_COST_PENCE_PER_TOKEN))
    await supabase.from('token_usage').insert({
      site_id: ANTIQUES_SITE_ID,
      user_id: userId,
      feature: 'identify',
      model: promptConfig.model,
      input_tokens: inputTokens,
      output_tokens: outputTokens,
      cost_pence: costPence
    })

    // Increment guest counter after successful identification
    if (!userId) {
      const kv = (env as unknown as CloudflareEnv).SESSION
      const ip = request.headers.get('CF-Connecting-IP') || 'unknown'
      const kvKey = `guest_identify:${ip}`
      if (kv) {
        const existing = await kv.get(kvKey)
        const count = existing ? parseInt(existing, 10) : 0
        await kv.put(kvKey, String(count + 1), { expirationTtl: GUEST_IDENTIFY_TTL })
      }
    }

    return json({ result, id: record?.id || null, gate_cta_text: promptConfig.gate_cta_text || null })

  } catch (err: any) {
    return json({ error: err.message }, 500)
  }
}
