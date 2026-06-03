import type { APIRoute } from 'astro'
import { env } from 'cloudflare:workers'
import { createClient } from '@supabase/supabase-js'

export const POST: APIRoute = async ({ request }) => {
  try {
    const body = await request.json()
    const { user_id, identification_id, email, site_id } = body

    if (!user_id) {
      return new Response(JSON.stringify({ error: 'Missing user_id' }), { status: 400, headers: { 'Content-Type': 'application/json' } })
    }

    const supabase = createClient(env.PUBLIC_SUPABASE_URL, env.SUPABASE_SERVICE_ROLE_KEY)

    // Direct claim — identification_id provided via localStorage
    if (identification_id) {
      const { error } = await supabase
        .from('identifications')
        .update({ user_id })
        .eq('id', identification_id)
        .is('user_id', null)
      if (error) return new Response(JSON.stringify({ error: error.message }), { status: 500, headers: { 'Content-Type': 'application/json' } })
      return new Response(JSON.stringify({ ok: true }), { status: 200, headers: { 'Content-Type': 'application/json' } })
    }

    // Cross-browser claim — look up pending_claims by email + site_id
    if (email && site_id) {
      const { data: claim, error: claimErr } = await supabase
        .from('pending_claims')
        .select('identification_id')
        .eq('email', email)
        .eq('site_id', site_id)
        .single()

      if (claimErr || !claim) {
        return new Response(JSON.stringify({ ok: true, note: 'No pending claim found' }), { status: 200, headers: { 'Content-Type': 'application/json' } })
      }

      const { error: updateErr } = await supabase
        .from('identifications')
        .update({ user_id })
        .eq('id', claim.identification_id)
        .is('user_id', null)

      if (updateErr) return new Response(JSON.stringify({ error: updateErr.message }), { status: 500, headers: { 'Content-Type': 'application/json' } })

      // Clean up pending claim
      await supabase
        .from('pending_claims')
        .delete()
        .eq('email', email)
        .eq('site_id', site_id)

      return new Response(JSON.stringify({ ok: true }), { status: 200, headers: { 'Content-Type': 'application/json' } })
    }

    return new Response(JSON.stringify({ error: 'Missing identification_id or email+site_id' }), { status: 400, headers: { 'Content-Type': 'application/json' } })

  } catch (err: any) {
    return new Response(JSON.stringify({ error: err.message }), { status: 500, headers: { 'Content-Type': 'application/json' } })
  }
}
