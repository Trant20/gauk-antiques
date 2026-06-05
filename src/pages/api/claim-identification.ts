import type { APIRoute } from 'astro'
import { env } from 'cloudflare:workers'
import { createClient } from '@supabase/supabase-js'
import { ANTIQUES_SITE_ID } from '../../lib/constants'
import type { CloudflareEnv } from '../../lib/constants'


function json(data: unknown, status = 200) {
  return new Response(JSON.stringify(data), {
    status, headers: { 'Content-Type': 'application/json' }
  })
}

export const POST: APIRoute = async ({ request }) => {
  try {
    const auth = request.headers.get('Authorization')
    if (!auth?.startsWith('Bearer ')) return json({ error: 'Unauthorized' }, 401)

    const token = auth.slice(7)
    const supabase = createClient(
      (env as unknown as CloudflareEnv).PUBLIC_SUPABASE_URL,
      (env as unknown as CloudflareEnv).SUPABASE_SERVICE_ROLE_KEY
    )

    const { data: { user }, error: authError } = await supabase.auth.getUser(token)
    if (authError || !user) return json({ error: 'Invalid token' }, 401)

    const { identification_id, email } = await request.json()

    // Direct claim — identification_id provided via localStorage
    if (identification_id) {
      const { error } = await supabase
        .from('identifications')
        .update({ user_id: user.id })
        .eq('id', identification_id)
        .is('user_id', null)
      if (error) return json({ error: error.message }, 500)
      return json({ ok: true })
    }

    // Cross-browser claim — look up pending_claims by email + site_id
    if (email) {
      const { data: claim, error: claimErr } = await supabase
        .from('pending_claims')
        .select('identification_id')
        .eq('email', email)
        .eq('site_id', ANTIQUES_SITE_ID)
        .single()

      if (claimErr || !claim) return json({ ok: true, note: 'No pending claim found' })

      const { error: updateErr } = await supabase
        .from('identifications')
        .update({ user_id: user.id })
        .eq('id', claim.identification_id)
        .is('user_id', null)

      if (updateErr) return json({ error: updateErr.message }, 500)

      await supabase
        .from('pending_claims')
        .delete()
        .eq('email', email)
        .eq('site_id', ANTIQUES_SITE_ID)

      return json({ ok: true })
    }

    return json({ error: 'Missing identification_id or email' }, 400)

  } catch (err: any) {
    return json({ error: err.message }, 500)
  }
}
