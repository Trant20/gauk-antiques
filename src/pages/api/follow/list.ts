import type { APIRoute } from 'astro'
import { createClient } from '@supabase/supabase-js'
import { env } from 'cloudflare:workers'
import { ANTIQUES_SITE_ID } from '../../../lib/constants'


function getSupabase() {
  return createClient(
    (env as Record<string, string>).PUBLIC_SUPABASE_URL,
    (env as Record<string, string>).SUPABASE_SERVICE_ROLE_KEY
  )
}

async function resolveUserId(request: Request): Promise<string | null> {
  const auth = request.headers.get('Authorization')
  if (!auth?.startsWith('Bearer ')) return null
  const token = auth.slice(7)
  const supabase = getSupabase()
  const { data: { user } } = await supabase.auth.getUser(token)
  return user?.id || null
}

/** GET /api/follow/list — returns { publisher_ids: string[] } for current user */
export const GET: APIRoute = async ({ request }) => {
  const userId = await resolveUserId(request)
  if (!userId) {
    return new Response(JSON.stringify({ publisher_ids: [] }), {
      headers: { 'Content-Type': 'application/json' },
    })
  }

  const supabase = getSupabase()
  const { data } = await supabase
    .from('user_channels')
    .select('publisher_id')
    .eq('user_id', userId)
    .eq('site_id', SITE_ID)

  return new Response(JSON.stringify({
    publisher_ids: (data || []).map(r => r.publisher_id)
  }), {
    headers: { 'Content-Type': 'application/json' },
  })
}
