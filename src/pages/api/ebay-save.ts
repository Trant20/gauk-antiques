import type { APIRoute } from 'astro'
import { env } from 'cloudflare:workers'
import { createClient } from '@supabase/supabase-js'
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

    const { results, identification_id, query } = await request.json()

    if (!results || !Array.isArray(results) || results.length === 0) {
      return json({ error: 'No results to save' }, 400)
    }

    if (identification_id) {
      // Connected mode — merge into identifications.ebay_sold
      const { data: existing } = await supabase
        .from('identifications')
        .select('ebay_sold, user_id')
        .eq('id', identification_id)
        .single()

      // Verify ownership
      if (!existing || existing.user_id !== user.id) {
        return json({ error: 'Item not found' }, 404)
      }

      // Merge — avoid duplicates by item_id
      const current: any[] = existing.ebay_sold || []
      const existingIds = new Set(current.map((r: any) => r.item_id))
      const toAdd = results.filter((r: any) => !existingIds.has(r.item_id))
      const merged = [...current, ...toAdd]

      const { error: updateError } = await supabase
        .from('identifications')
        .update({ ebay_sold: merged })
        .eq('id', identification_id)
        .eq('user_id', user.id)

      if (updateError) return json({ error: 'Failed to save' }, 500)

      return json({ saved: toAdd.length, total: merged.length, mode: 'connected' })

    } else {
      // Standalone mode — save to saved_searches
      const { error: insertError } = await supabase
        .from('saved_searches')
        .insert({
          user_id: user.id,
          query: query || 'eBay search',
          results,
          identification_id: null
        })

      if (insertError) return json({ error: 'Failed to save' }, 500)

      return json({ saved: results.length, mode: 'standalone' })
    }

  } catch (err: any) {
    return json({ error: err.message }, 500)
  }
}
