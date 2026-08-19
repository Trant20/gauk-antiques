import type { APIRoute } from 'astro'
import { env } from 'cloudflare:workers'
import Anthropic from '@anthropic-ai/sdk'
import { createClient } from '@supabase/supabase-js'
import { getPromptConfig } from '../../lib/ai'
import { ANTIQUES_SITE_ID, GI_SITE_ID, RECEIPTS_SITE_ID, CLAUDE_INPUT_COST_PENCE_PER_TOKEN, CLAUDE_OUTPUT_COST_PENCE_PER_TOKEN } from '../../lib/constants'
import type { CloudflareEnv } from '../../lib/constants'

const GUEST_IDENTIFY_LIMIT = 2

/** Map AI-returned category name to ai_prompts context slug */
function categoryToContext(category: string): string {
  const map: Record<string, string> = {
    'Ceramics': 'ceramics',
    'Glass': 'glass',
    'Jewellery': 'jewellery',
    'Metalware': 'metalware',
    'Furniture': 'furniture',
    'Art': 'art',
    'Clocks & Watches': 'clocks-and-watches',
    'Textiles': 'textiles',
    'Books & Literature': 'books-and-literature',
    'Toys': 'toys',
    'Militaria': 'militaria',
    'Associations Mueseums Auctions': 'associations-mueseums-auctions',
    'Music': 'music',
    'Film & Media': 'film-and-media',
    'Guides': 'guides',
    'Artists Authors Designers': 'artists-authors-designers',
    'Stamps & Coins': 'stamps-and-coins',
    'Memorabilia': 'memorabilia',
    'Collectibles & Decorative Arts': 'collectibles-and-decorative-arts',
    'Factories Studios & Workshops': 'factories-studios-and-workshops',
    'Historical Figures & History': 'historical-figures-and-history',
    'Collections': 'collections',
    'Antiquities': 'antiquities',
  }
  return map[category] || 'general'
}
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
    const { key, secondary_key, context = 'general', site_id: requestedSiteId, identification_id: linkedIdentId } = await request.json()

    if (!key) return json({ error: 'No image key provided' }, 400)

    // Validate site_id — only known properties accepted, default to GA
    const VALID_SITE_IDS = new Set([ANTIQUES_SITE_ID, GI_SITE_ID, RECEIPTS_SITE_ID])
    const site_id = requestedSiteId && VALID_SITE_IDS.has(requestedSiteId) ? requestedSiteId : ANTIQUES_SITE_ID

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
        .eq('site_id', site_id)
        .eq('key', 'credit_cost_identify')
        .single()
      const creditCost = parseInt(costSetting?.value ?? '1', 10)

      // Deduct full credit cost in one operation
      const { data: ok } = await supabase.rpc('deduct_identification_credit', {
        p_user_id: userId,
        p_site_id: site_id,
        p_identification_id: null,
        p_amount: creditCost
      })
      if (!ok) return json({ error: 'Insufficient credits' }, 402)
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

    // ── Fetch R2 image — shared by both passes ────────────────────────────────
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

    // ── Pass 1: Haiku classify — cheap, fast, category only ───────────────────
    // Skip for GI — GI uses a single general prompt
    let resolvedContext = context
    if (site_id === ANTIQUES_SITE_ID) {
      const classifyConfig = await getPromptConfig(supabase, site_id, 'classify', 'system_prompt, model, max_tokens')
      if (classifyConfig?.system_prompt) {
        try {
          const classifyResponse = await client.messages.create({
            model: String(classifyConfig.model || 'claude-haiku-4-5-20251001'),
            max_tokens: Number(classifyConfig.max_tokens || 64),
            system: String(classifyConfig.system_prompt),
            messages: [{
              role: 'user',
              content: [
                {
                  type: 'image',
                  source: { type: 'base64' as const, media_type: contentType as 'image/jpeg' | 'image/png' | 'image/gif' | 'image/webp', data: base64 }
                },
                { type: 'text', text: 'Classify this item. Return only the JSON.' }
              ]
            }]
          })

          if (classifyResponse.content[0]?.type === 'text') {
            const raw = classifyResponse.content[0].text
            const clean = raw.replaceAll('```json', '').replaceAll('```', '').trim()
            const classified = JSON.parse(clean)
            if (classified.category) {
              resolvedContext = categoryToContext(classified.category)
            }
          }

          // Log Haiku token usage
          await supabase.from('token_usage').insert({
            site_id,
            user_id: userId,
            feature: 'classify',
            model: String(classifyConfig.model || 'claude-haiku-4-5-20251001'),
            input_tokens: classifyResponse.usage.input_tokens,
            output_tokens: classifyResponse.usage.output_tokens,
            cost_pence: Math.ceil(
              (classifyResponse.usage.input_tokens * CLAUDE_INPUT_COST_PENCE_PER_TOKEN) +
              (classifyResponse.usage.output_tokens * CLAUDE_OUTPUT_COST_PENCE_PER_TOKEN)
            )
          })
        } catch {
          // Classification failed — fall back to general prompt
          resolvedContext = 'general'
        }
      }
    }

    // ── Pass 2: Sonnet full identification with category prompt ────────────────
    const promptConfig = await getPromptConfig(supabase, site_id, resolvedContext, 'system_prompt, description_instruction, model, max_tokens, gate_cta_text')
    if (!promptConfig) return json({ error: 'Prompt configuration not found' }, 500)

    const systemPrompt = (promptConfig.system_prompt as string).replace(
      '{{DESCRIPTION_INSTRUCTION}}',
      promptConfig.description_instruction as string
    )

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

    let record: { id: string } | null = null

    if (site_id === RECEIPTS_SITE_ID) {
      // ── Receipts: write to receipts + receipt_line_items ──────────────────
      const r = result as any
      const { data: receiptRecord, error: receiptError } = await supabase
        .from('receipts')
        .insert({
          site_id,
          user_id: userId,
          image_key: key,
          merchant:        r.merchant        || null,
          date:            r.date            || null,
          total:           r.total           ?? null,
          currency:        r.currency        || null,
          category:        r.category        || null,
          receipt_number:  r.receipt_number  || null,
          warranty_years:  r.warranty_years  ?? null,
          warranty_expiry: r.warranty_expiry || null,
          confidence:      r.confidence      || null,
          notes:           r.notes           || null,
          result_json:     result,
          credits_used:    1,
          identification_id: linkedIdentId || null
        })
        .select()
        .single()

      if (receiptError) {
        console.error('Receipt DB write error:', receiptError)
      } else if (receiptRecord && r.items?.length) {
        const lineItems = r.items.map((item: any) => ({
          receipt_id:  receiptRecord.id,
          description: item.description,
          amount:      item.amount ?? null
        }))
        const { error: lineError } = await supabase
          .from('receipt_line_items')
          .insert(lineItems)
        if (lineError) console.error('Receipt line items write error:', lineError)
      }

      record = receiptRecord
    } else {
      // ── GA / GI: write to identifications ─────────────────────────────────
      const { data: idRecord, error: dbError } = await supabase
        .from('identifications')
        .insert({
          site_id,
          user_id: userId,
          image_key: key,
          secondary_image_key: secondary_key || null,
          result_json: result,
          category: (result as any).category,
          maker:    (result as any).maker,
          period:   (result as any).period,
          value_range_low:  (result as any).value_range_low,
          value_range_high: (result as any).value_range_high,
          confidence: (result as any).confidence
        })
        .select()
        .single()

      if (dbError) console.error('DB write error:', dbError)
      record = idRecord
    }

    // Log token usage
    const inputTokens = response.usage.input_tokens
    const outputTokens = response.usage.output_tokens
    const costPence = Math.ceil((inputTokens * CLAUDE_INPUT_COST_PENCE_PER_TOKEN) + (outputTokens * CLAUDE_OUTPUT_COST_PENCE_PER_TOKEN))
    await supabase.from('token_usage').insert({
      site_id: site_id,
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
