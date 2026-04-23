import type { APIRoute } from 'astro'
import { env } from 'cloudflare:workers'

export const POST: APIRoute = async ({ request }) => {
  try {
    const { identification_id, user_id } = await request.json()
    if (!identification_id || !user_id) {
      return new Response(JSON.stringify({ error: 'Missing params' }), { status: 400, headers: { 'Content-Type': 'application/json' } })
    }
    const supabase = await import('@supabase/supabase-js').then(m =>
      m.createClient((env as any).PUBLIC_SUPABASE_URL, (env as any).SUPABASE_SERVICE_ROLE_KEY)
    )
    // Only claim if currently unclaimed
    const { error } = await supabase
      .from('identifications')
      .update({ user_id })
      .eq('id', identification_id)
      .is('user_id', null)
    if (error) return new Response(JSON.stringify({ error: error.message }), { status: 500, headers: { 'Content-Type': 'application/json' } })
    return new Response(JSON.stringify({ ok: true }), { status: 200, headers: { 'Content-Type': 'application/json' } })
  } catch (err: any) {
    return new Response(JSON.stringify({ error: err.message }), { status: 500, headers: { 'Content-Type': 'application/json' } })
  }
}
