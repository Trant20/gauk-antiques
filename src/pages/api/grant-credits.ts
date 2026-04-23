import type { APIRoute } from 'astro'
import { env } from 'cloudflare:workers'

export const POST: APIRoute = async ({ request }) => {
  try {
    const { user_id, site_id } = await request.json()
    if (!user_id || !site_id) {
      return new Response(JSON.stringify({ error: 'Missing params' }), { status: 400, headers: { 'Content-Type': 'application/json' } })
    }
    const supabase = await import('@supabase/supabase-js').then(m =>
      m.createClient((env as any).PUBLIC_SUPABASE_URL, (env as any).SUPABASE_SERVICE_ROLE_KEY)
    )
    const { error } = await supabase.rpc('grant_signup_credits', { p_user_id: user_id, p_site_id: site_id })
    if (error) return new Response(JSON.stringify({ error: error.message }), { status: 500, headers: { 'Content-Type': 'application/json' } })
    return new Response(JSON.stringify({ ok: true }), { status: 200, headers: { 'Content-Type': 'application/json' } })
  } catch (err: any) {
    return new Response(JSON.stringify({ error: err.message }), { status: 500, headers: { 'Content-Type': 'application/json' } })
  }
}
