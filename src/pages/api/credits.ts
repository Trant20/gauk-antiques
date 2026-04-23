import type { APIRoute } from 'astro'
import { env } from 'cloudflare:workers'

export const GET: APIRoute = async ({ request }) => {
  try {
    const auth = request.headers.get('Authorization')
    if (!auth) return new Response(JSON.stringify({ error: 'Unauthorized' }), { status: 401, headers: { 'Content-Type': 'application/json' } })

    const site_id = new URL(request.url).searchParams.get('site_id')
    if (!site_id) return new Response(JSON.stringify({ error: 'Missing site_id' }), { status: 400, headers: { 'Content-Type': 'application/json' } })

    const supabase = await import('@supabase/supabase-js').then(m =>
      m.createClient((env as any).PUBLIC_SUPABASE_URL, (env as any).SUPABASE_SERVICE_ROLE_KEY)
    )

    // Verify JWT and get user
    const token = auth.replace('Bearer ', '')
    const { data: { user }, error: authError } = await supabase.auth.getUser(token)
    if (authError || !user) return new Response(JSON.stringify({ error: 'Invalid token' }), { status: 401, headers: { 'Content-Type': 'application/json' } })

    const { data: credits } = await supabase
      .from('credits')
      .select('balance')
      .eq('user_id', user.id)
      .eq('site_id', site_id)
      .single()

    return new Response(JSON.stringify({ balance: credits?.balance ?? 0 }), {
      status: 200, headers: { 'Content-Type': 'application/json' }
    })
  } catch (err: any) {
    return new Response(JSON.stringify({ error: err.message }), { status: 500, headers: { 'Content-Type': 'application/json' } })
  }
}
