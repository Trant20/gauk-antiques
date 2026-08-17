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

function arrayBufferToBase64Chunked(buffer: ArrayBuffer): string {
  const bytes = new Uint8Array(buffer)
  let binary = ''
  const chunkSize = 8192
  for (let i = 0; i < bytes.length; i += chunkSize) {
    const chunk = bytes.subarray(i, i + chunkSize)
    binary += String.fromCodePoint(...chunk)
  }
  return btoa(binary)
}

// Strip adjectives and filler words from subcategory to extract core item type
// e.g. "Art Deco Lidded Preserve Pot / Jam Pot" → "Preserve Pot"
function extractItemType(subcategory: string): string {
  const strip = new Set([
    'art','deco','nouveau','arts','crafts','victorian','edwardian','georgian',
    'regency','baroque','rococo','gothic','medieval','renaissance',
    'antique','vintage','old','rare','unusual','unique','fine','quality',
    'english','british','french','german','italian','japanese','chinese',
    'lidded','covered','footed','handled','mounted','fitted','framed',
    'small','large','miniature','full','half','pair','set','collection',
    'early','late','mid','circa','period','style','type','form','shape',
    'a','an','the','and','or','of','with','for','by','in','on','from'
  ])
  // Split on space, slash, dash — take meaningful words only
  const words = subcategory.toLowerCase().split(/[\s\/\-]+/)
  const meaningful = words.filter(w => w.length > 2 && !strip.has(w))
  // Take first 2 meaningful words max
  return meaningful.slice(0, 2).join(' ')
}

// Build a clean search query from identification result — server-side extraction
// maker + item type + distinguishing term (range or pattern)
function buildTrawlQuery(result: any): string {
  const parts: string[] = []

  // 1. Maker
  if (result.maker && result.maker.toLowerCase() !== 'unknown') {
    parts.push(result.maker)
  }

  // 2. Core item type from subcategory
  if (result.subcategory) {
    const itemType = extractItemType(result.subcategory)
    if (itemType) parts.push(itemType)
  }

  // 3. Distinguishing term — range first, then pattern (skip uncertain ones)
  const cs = result.category_specific || {}
  const uncertain = /^(likely|possibly|probably|perhaps|maybe)/i

  if (cs.range && !uncertain.test(cs.range)) {
    // Use first word of range only e.g. "Bizarre or Fantasque" → "Bizarre"
    const rangeWord = cs.range.split(/[\s,\/]/)[0]
    if (rangeWord && rangeWord.length > 2) parts.push(rangeWord)
  } else if (cs.pattern && !uncertain.test(cs.pattern)) {
    const patternWord = cs.pattern.split(/[\s,\/]/)[0]
    if (patternWord && patternWord.length > 2) parts.push(patternWord)
  }

  // Fallback — if nothing useful, use category
  if (parts.length === 0 && result.category) {
    parts.push(result.category)
  }

  return parts.join(' ').trim()
}

// Fetch eBay sold data from Trawl and proxy images to R2
async function fetchEbaySold(
  result: any,
  identificationId: string,
  bucket: R2Bucket,
  trawlKey: string
): Promise<any[]> {
  const query = buildTrawlQuery(result)
  if (!query) return []

  const url = `https://api.trawl.dev/ebay/v1/sold?query=${encodeURIComponent(query)}&site=EBAY_GB&limit=10`

  let trawlData: any
  try {
    const res = await fetch(url, { headers: { 'x-api-key': trawlKey } })
    if (!res.ok) return []
    trawlData = await res.json()
  } catch {
    return []
  }

  if (!trawlData?.results?.length) return []

  // Proxy images to R2 in parallel
  const results = await Promise.all(
    trawlData.results.map(async (item: any) => {
      let r2Key: string | null = null

      if (item.image_url) {
        try {
          const imgRes = await fetch(item.image_url)
          if (imgRes.ok) {
            const imgBuffer = await imgRes.arrayBuffer()
            const contentType = imgRes.headers.get('content-type') || 'image/jpeg'
            r2Key = `ebay-sold/${identificationId}/${item.item_id}.jpg`
            await bucket.put(r2Key, imgBuffer, {
              httpMetadata: { contentType }
            })
          }
        } catch {
          // Image proxy failed — continue without image
          r2Key = null
        }
      }

      return {
        item_id: item.item_id,
        title: item.title,
        sale_price: item.sale_price,
        shipping_price: item.shipping_price || 0,
        currency: item.currency || '£',
        condition: item.condition,
        condition_raw: item.condition_raw,
        date_sold: item.date_sold,
        buying_format: item.buying_format,
        bids: item.bids || null,
        item_link: item.item_link,
        r2_key: r2Key
      }
    })
  )

  return results.filter(Boolean)
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

    const reqBody = await request.json()
    const { identification_id, result } = reqBody
    const userCurrency = reqBody.currency || 'GBP'
    const userLocale = reqBody.locale || 'en-GB'
    if (!result) return json({ error: 'No identification result provided' }, 400)

    // Fetch credit cost from site_settings
    const { data: costSetting } = await supabase
      .from('site_settings')
      .select('value')
      .eq('site_id', ANTIQUES_SITE_ID)
      .eq('key', 'credit_cost_enrich')
      .single()
    const creditCost = parseInt(costSetting?.value ?? '5', 10)

    // Deduct credits before AI call — single RPC call with p_amount
    const { data: ok } = await supabase.rpc('deduct_identification_credit', {
      p_user_id: user.id,
      p_site_id: ANTIQUES_SITE_ID,
      p_identification_id: identification_id || null,
      p_amount: creditCost
    })
    if (!ok) return json({ error: 'Insufficient credits' }, 402)

    // Fetch eBay sold data — non-blocking, enrich proceeds even if Trawl fails
    const bucket = (env as unknown as CloudflareEnv).gauk_antiques_images
    const trawlKey = (env as unknown as CloudflareEnv).TRAWL_API_KEY as string
    let ebaySold: any[] = []

    if (trawlKey && bucket) {
      ebaySold = await fetchEbaySold(result, identification_id || 'unknown', bucket, trawlKey)
    }

    // Build Claude prompt — inject eBay sold data as context if available
    const promptConfig = await getPromptConfig(supabase, ANTIQUES_SITE_ID, 'enrich', 'system_prompt, model, max_tokens')
    if (!promptConfig?.system_prompt) return json({ error: 'Enrich prompt not configured' }, 500)

    const ebayContext = ebaySold.length > 0
      ? `\n\nREAL EBAY SOLD DATA (use this to ground your valuation and comparable sales):\n${JSON.stringify(ebaySold.map(s => ({
          title: s.title,
          sale_price: s.sale_price,
          condition: s.condition_raw,
          date_sold: s.date_sold,
          buying_format: s.buying_format,
          bids: s.bids
        })), null, 2)}\n\nUse the above real sold prices to inform your comparable_sales section and price_history. These are actual transactions, not estimates.`
      : ''

    const client = new Anthropic({ apiKey: (env as unknown as CloudflareEnv).ANTHROPIC_API_KEY })
    const response = await client.messages.create({
      model: String(promptConfig.model || 'claude-sonnet-4-6'),
      max_tokens: 8192,
      system: String(promptConfig.system_prompt),
      tools: [{ type: 'web_search_20250305' as any, name: 'web_search', max_uses: 3 }],
      messages: [{
        role: 'user',
        content: `You are generating a JSON enrichment report for an antique identification. First, use the web search tool to search for recent auction results for this specific maker, item type and pattern (2023-2026). Run 2-3 searches. Then output ONLY a single valid JSON object with no other text before or after it. All prices must be in ${userCurrency}.\n\nIdentification data:\n${JSON.stringify(result, null, 2)}${ebayContext}`
      }]
    })

    // Extract text from response — web search adds server_tool_use blocks before final text
    // Collect all text blocks and join — the JSON will be in the final text block
    const textBlocks = response.content.filter((b: any) => b.type === 'text')
    if (textBlocks.length === 0) {
      return json({ error: 'No response from AI' }, 500)
    }

    // Use the last text block — that's where the JSON output will be after web searches
    const lastText = textBlocks[textBlocks.length - 1] as any

    let enrichment: unknown
    try {
      const raw = lastText.text
      // Find JSON — may have text before/after due to web search context
      const jsonStart = raw.indexOf('{')
      const jsonEnd = raw.lastIndexOf('}')
      if (jsonStart === -1 || jsonEnd === -1) throw new Error('No JSON found')
      const clean = raw.slice(jsonStart, jsonEnd + 1)
      enrichment = JSON.parse(clean)
    } catch {
      return json({ error: 'AI returned malformed response' }, 500)
    }

    // Extract market_research from enrichment and save separately
    const marketResearch = (enrichment as any)?.market_research || null

    // Build update payload — price range always from AI, not eBay
    const updatePayload: Record<string, any> = {
      enrichment_json: enrichment,
      ebay_sold: ebaySold.length > 0 ? ebaySold : null,
      market_research_json: marketResearch
    }

    if (identification_id) {
      const { error: updateError } = await supabase
        .from('identifications')
        .update(updatePayload)
        .eq('id', identification_id)
      if (updateError) console.error('Enrichment update error:', updateError)
    }

    // Log token usage
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

    return json({ enrichment, ebay_sold: ebaySold, market_research: marketResearch })

  } catch (err: any) {
    return json({ error: err.message }, 500)
  }
}
