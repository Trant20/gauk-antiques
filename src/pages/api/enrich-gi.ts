import type { APIRoute } from 'astro'
import { env } from 'cloudflare:workers'
import { createClient } from '@supabase/supabase-js'
import { GI_SITE_ID, R2_CDN } from '../../lib/constants'
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

// Build Google Shopping query from GI result
function buildShoppingQuery(result: any): string {
  const parts: string[] = []
  if (result.brand && result.brand !== 'Unknown') parts.push(result.brand)
  if (result.model) parts.push(result.model)
  else if (result.subcategory) {
    // Strip generic words — keep product type
    const strip = new Set(['the','a','an','and','or','of','with','for','in','on','from',
      'vintage','antique','old','used','second','hand','refurbished'])
    const words = result.subcategory.toLowerCase().split(/\s+/)
    const meaningful = words.filter((w: string) => w.length > 2 && !strip.has(w))
    parts.push(meaningful.slice(0, 3).join(' '))
  }
  return parts.join(' ').trim()
}

// Calculate replacement cost range from shopping results
function calcRetailRange(results: any[]): { low: number; high: number; currency: string } | null {
  if (!results || results.length === 0) return null

  const prices = results
    .map((r: any) => r.extracted_price)
    .filter((p: any) => typeof p === 'number' && p > 0)
    .sort((a: number, b: number) => a - b)

  if (prices.length === 0) return null

  // Trim outliers — remove bottom 10% (heavily discounted) and top 10% (premium/rare)
  const trim = Math.floor(prices.length * 0.1)
  const trimmed = prices.length > 4 ? prices.slice(trim, prices.length - trim) : prices

  return {
    low: Math.round(trimmed[0]),
    high: Math.round(trimmed[trimmed.length - 1]),
    currency: results[0]?.extracted_price_symbol || '$'
  }
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

    // Read credit cost from site_settings
    const { data: costSetting } = await supabase
      .from('site_settings')
      .select('value')
      .eq('site_id', GI_SITE_ID)
      .eq('key', 'credit_cost_gi_enrich')
      .single()
    const creditCost = parseInt(costSetting?.value ?? '2', 10)

    // Deduct credits
    const { data: ok } = await supabase.rpc('deduct_identification_credit', {
      p_user_id: user.id,
      p_site_id: GI_SITE_ID,
      p_identification_id: identification_id || null,
      p_amount: creditCost
    })
    if (!ok) return json({ error: 'Insufficient credits' }, 402)

    // Build search query
    const query = buildShoppingQuery(result)
    if (!query) return json({ error: 'Could not build search query from item data' }, 400)

    const serpApiKey = (env as unknown as CloudflareEnv).SERPAPI_KEY
    if (!serpApiKey) return json({ error: 'Search unavailable' }, 503)

    // Call SerpApi Google Shopping — no country restriction, gl param optional
    const params = new URLSearchParams({
      engine: 'google_shopping',
      q: query,
      api_key: serpApiKey,
      num: '10',
      gl: 'gb',
      hl: 'en'
    })

    const serpRes = await fetch(`https://serpapi.com/search?${params}`)
    if (!serpRes.ok) return json({ error: 'Retail search failed — please try again' }, 503)

    const serpData = await serpRes.json()
    const shoppingResults = serpData.shopping_results || []

    if (shoppingResults.length === 0) {
      return json({ retail_prices: [], query, message: 'No retail results found' })
    }

    // Extract clean retail data — no fluff
    const retailPrices = shoppingResults.map((item: any) => ({
      title: item.title,
      price: item.price,
      extracted_price: item.extracted_price,
      source: item.source,
      link: item.link,
      currency: item.extracted_price_symbol || '$'
    })).filter((item: any) => item.extracted_price > 0)

    // Calculate price range
    const priceRange = calcRetailRange(retailPrices)

    // Save to identifications
    const updatePayload: Record<string, any> = {
      retail_prices: retailPrices
    }

    if (identification_id) {
      const { error: updateError } = await supabase
        .from('identifications')
        .update(updatePayload)
        .eq('id', identification_id)
        .eq('user_id', user.id)

      if (updateError) console.error('GI enrich update error:', updateError)
    }

    return json({
      retail_prices: retailPrices,
      price_range: priceRange,
      query,
      count: retailPrices.length
    })

  } catch (err: any) {
    return json({ error: err.message }, 500)
  }
}
