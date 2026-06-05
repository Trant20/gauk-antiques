import type { APIRoute } from 'astro'
import { createClient } from '@supabase/supabase-js'
import { env } from 'cloudflare:workers'
import { ANTIQUES_SITE_ID } from '../../../lib/constants'
import type { CloudflareEnv } from '../../../lib/constants'


function getSupabase() {
  return createClient(
    (env as unknown as CloudflareEnv).PUBLIC_SUPABASE_URL,
    (env as unknown as CloudflareEnv).SUPABASE_SERVICE_ROLE_KEY
  )
}

function errorResponse(message: string, status = 400) {
  return new Response(JSON.stringify({ error: message }), {
    status,
    headers: { 'Content-Type': 'application/json' },
  })
}

function jsonResponse(data: unknown, status = 200) {
  return new Response(JSON.stringify(data), {
    status,
    headers: { 'Content-Type': 'application/json' },
  })
}

/** Resolves the user_id from a Supabase JWT bearer token. */
async function resolveUserId(request: Request): Promise<string | null> {
  const auth = request.headers.get('Authorization')
  if (!auth?.startsWith('Bearer ')) return null
  const token = auth.slice(7)
  const supabase = getSupabase()
  const { data: { user } } = await supabase.auth.getUser(token)
  return user?.id || null
}

/** GET /api/follow?publisher_id=x — returns { following: boolean } */
export const GET: APIRoute = async ({ request, url }) => {
  const publisherId = url.searchParams.get('publisher_id')
  if (!publisherId) return errorResponse('publisher_id required')

  const userId = await resolveUserId(request)
  if (!userId) return jsonResponse({ following: false })

  const supabase = getSupabase()
  const { data } = await supabase
    .from('user_channels')
    .select('id')
    .eq('user_id', userId)
    .eq('publisher_id', publisherId)
    .eq('site_id', ANTIQUES_SITE_ID)
    .single()

  return jsonResponse({ following: !!data })
}

/** POST /api/follow — body: { publisher_id, action: 'follow' | 'unfollow' } */
export const POST: APIRoute = async ({ request }) => {
  const userId = await resolveUserId(request)
  if (!userId) return errorResponse('Unauthorised', 401)

  let body: { publisher_id?: string; action?: string }
  try {
    body = await request.json()
  } catch {
    return errorResponse('Invalid JSON')
  }

  const { publisher_id, action } = body
  if (!publisher_id) return errorResponse('publisher_id required')
  if (action !== 'follow' && action !== 'unfollow') return errorResponse('action must be follow or unfollow')

  const supabase = getSupabase()

  if (action === 'follow') {
    const { error } = await supabase
      .from('user_channels')
      .upsert(
        { user_id: userId, publisher_id, site_id: ANTIQUES_SITE_ID },
        { onConflict: 'user_id,publisher_id' }
      )
    if (error) return errorResponse(error.message, 500)
    return jsonResponse({ following: true })
  }

  const { error } = await supabase
    .from('user_channels')
    .delete()
    .eq('user_id', userId)
    .eq('publisher_id', publisher_id)
    .eq('site_id', ANTIQUES_SITE_ID)

  if (error) return errorResponse(error.message, 500)
  return jsonResponse({ following: false })
}
