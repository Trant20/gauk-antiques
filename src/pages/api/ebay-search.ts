import type { APIRoute } from 'astro'
import { env } from 'cloudflare:workers'
import { createClient } from '@supabase/supabase-js'
import { ANTIQUES_SITE_ID } from '../../lib/constants'
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

    const { query, identification_id } = await request.json()
    if (!query || !query.trim()) return json({ error: 'Search query is required' }, 400)

    // Read credit cost from site_settings — never hardcoded
    const { data: costSetting } = await supabase
      .from('site_settings')
      .select('value')
      .eq('site_id', ANTIQUES_SITE_ID)
      .eq('key', 'credit_cost_ebay_search')
      .single()
    const creditCost = parseInt(costSetting?.value ?? '1', 10)

    // Deduct credits
    const { data: ok } = await supabase.rpc('deduct_identification_credit', {
      p_user_id: user.id,
      p_site_id: ANTIQUES_SITE_ID,
      p_identification_id: identification_id || null,
      p_amount: creditCost
    })
    if (!ok) return json({ error: 'Insufficient credits' }, 402)

    // Call Trawl
    const trawlKey = (env as unknown as CloudflareEnv).TRAWL_API_KEY as string
    if (!trawlKey) return json({ error: 'Search unavailable' }, 503)

    const url = `https://api.trawl.dev/ebay/v1/sold?query=${encodeURIComponent(query.trim())}&site=EBAY_GB&limit=10`
    const trawlRes = await fetch(url, { headers: { 'x-api-key': trawlKey } })
    if (!trawlRes.ok) return json({ error: 'Search failed — please try again' }, 503)

    const trawlData = await trawlRes.json()
    if (!trawlData?.results?.length) {
      return json({ results: [], query: query.trim(), credit_cost: creditCost })
    }

    // Proxy images to R2
    const bucket = (env as unknown as CloudflareEnv).gauk_antiques_images
    const searchId = crypto.randomUUID()

    const results = await Promise.all(
      trawlData.results.map(async (item: any) => {
        let r2Key: string | null = null

        if (item.image_url && bucket) {
          try {
            const imgRes = await fetch(item.image_url)
            if (imgRes.ok) {
              const imgBuffer = await imgRes.arrayBuffer()
              const contentType = imgRes.headers.get('content-type') || 'image/jpeg'
              r2Key = `ebay-search/${user.id}/${searchId}/${item.item_id}.jpg`
              await bucket.put(r2Key, imgBuffer, { httpMetadata: { contentType } })
            }
          } catch {
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

    return json({
      results: results.filter(Boolean),
      query: query.trim(),
      credit_cost: creditCost,
      search_id: searchId
    })

  } catch (err: any) {
    return json({ error: err.message }, 500)
  }
}
