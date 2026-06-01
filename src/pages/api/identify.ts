import type { APIRoute } from 'astro'
import { env } from 'cloudflare:workers'
import Anthropic from '@anthropic-ai/sdk'

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

/** Fetch prompt config from ai_prompts for the given context, fallback to general */
async function getPromptConfig(supabase: any, siteId: string, context: string) {
  const { data } = await supabase
    .from('ai_prompts')
    .select('system_prompt, description_instruction, model, max_tokens')
    .eq('site_id', siteId)
    .eq('context', context)
    .single()

  if (data) return data

  const { data: fallback } = await supabase
    .from('ai_prompts')
    .select('system_prompt, description_instruction, model, max_tokens')
    .eq('site_id', siteId)
    .eq('context', 'general')
    .single()

  return fallback
}

export const POST: APIRoute = async ({ request }) => {
  try {
    const { key, secondary_key, user_id, context = 'general' } = await request.json()

    if (!key) {
      return new Response(JSON.stringify({ error: 'No image key provided' }), {
        status: 400,
        headers: { 'Content-Type': 'application/json' }
      })
    }

    const supabase = await import('@supabase/supabase-js').then(m =>
      m.createClient(
        (env as any).PUBLIC_SUPABASE_URL,
        (env as any).SUPABASE_SERVICE_ROLE_KEY
      )
    )

    const SITE_ID = 'add6d12c-ecd8-4517-b2e5-0f4977603744'

    const promptConfig = await getPromptConfig(supabase, SITE_ID, context)
    if (!promptConfig) {
      return new Response(JSON.stringify({ error: 'Prompt configuration not found' }), {
        status: 500,
        headers: { 'Content-Type': 'application/json' }
      })
    }

    const systemPrompt = promptConfig.system_prompt.replace(
      '{{DESCRIPTION_INSTRUCTION}}',
      promptConfig.description_instruction
    )

    const bucket = (env as any).gauk_antiques_images
    const object = await bucket.get(key)

    if (!object) {
      return new Response(JSON.stringify({ error: 'Image not found in R2' }), {
        status: 404,
        headers: { 'Content-Type': 'application/json' }
      })
    }

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

    const client = new Anthropic({ apiKey: (env as any).ANTHROPIC_API_KEY })

    const response = await client.messages.create({
      model: promptConfig.model,
      max_tokens: promptConfig.max_tokens,
      system: systemPrompt,
      messages: [
        {
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
        }
      ]
    })

    const raw = response.content[0].type === 'text' ? response.content[0].text : ''
    const clean = raw.replaceAll('```json', '').replaceAll('```', '').trim()
    const result = JSON.parse(clean)

    const { data: record, error: dbError } = await supabase
      .from('identifications')
      .insert({
        site_id: SITE_ID,
        user_id: user_id || null,
        image_key: key,
        secondary_image_key: secondary_key || null,
        result_json: result,
        category: result.category,
        maker: result.maker,
        period: result.period,
        value_range_low: result.value_range_low,
        value_range_high: result.value_range_high,
        confidence: result.confidence
      })
      .select()
      .single()

    if (dbError) console.error('DB write error:', dbError)

    // Log token usage
    const inputTokens = response.usage.input_tokens
    const outputTokens = response.usage.output_tokens
    const costPence = Math.ceil((inputTokens * 0.003) + (outputTokens * 0.015))
    await supabase.from('token_usage').insert({
      site_id: SITE_ID,
      user_id: user_id || null,
      feature: 'identify',
      model: promptConfig.model,
      input_tokens: inputTokens,
      output_tokens: outputTokens,
      cost_pence: costPence
    })

    return new Response(JSON.stringify({ result, id: record?.id || null }), {
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
