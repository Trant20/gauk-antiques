import type { APIRoute } from 'astro'
import { env } from 'cloudflare:workers'

export const POST: APIRoute = async ({ request }) => {
  try {
    const auth = request.headers.get('Authorization')
    if (!auth) return new Response(JSON.stringify({ error: 'Unauthorized' }), { status: 401, headers: { 'Content-Type': 'application/json' } })

    const { site_id, identification_id, amount = 1 } = await request.json()

    const supabase = await import('@supabase/supabase-js').then(m =>
      m.createClient((env as any).PUBLIC_SUPABASE_URL, (env as any).SUPABASE_SERVICE_ROLE_KEY)
    )

    const token = auth.replace('Bearer ', '')
    const { data: { user }, error: authError } = await supabase.auth.getUser(token)
    if (authError || !user) return new Response(JSON.stringify({ error: 'Invalid token' }), { status: 401, headers: { 'Content-Type': 'application/json' } })

    // Deduct credits one at a time using existing function
    for (let i = 0; i < amount; i++) {
      const { data: ok } = await supabase.rpc('deduct_identification_credit', {
        p_user_id: user.id,
        p_site_id: site_id,
        p_identification_id: identification_id
      })
      if (!ok) return new Response(JSON.stringify({ error: 'Insufficient credits' }), { status: 402, headers: { 'Content-Type': 'application/json' } })
    }

    return new Response(JSON.stringify({ ok: true }), { status: 200, headers: { 'Content-Type': 'application/json' } })
  } catch (err: any) {
    return new Response(JSON.stringify({ error: err.message }), { status: 500, headers: { 'Content-Type': 'application/json' } })
  }
}
