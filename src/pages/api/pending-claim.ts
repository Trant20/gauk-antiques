import type { APIRoute } from 'astro'
import { env } from 'cloudflare:workers'
import { createClient } from '@supabase/supabase-js'
import { ANTIQUES_SITE_ID } from '../../lib/constants'

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i

function json(data: unknown, status = 200) {
  return new Response(JSON.stringify(data), {
    status, headers: { 'Content-Type': 'application/json' }
  })
}

export const POST: APIRoute = async ({ request }) => {
  try {
    const { email, identification_id } = await request.json()

    if (!email || !identification_id) return json({ error: 'Missing required fields' }, 400)
    if (!UUID_RE.test(identification_id)) return json({ error: 'Invalid identification_id' }, 400)
    if (typeof email !== 'string' || !email.includes('@')) return json({ error: 'Invalid email' }, 400)

    const supabase = createClient(
      (env as any).PUBLIC_SUPABASE_URL,
      (env as any).SUPABASE_SERVICE_ROLE_KEY
    )

    // Verify the identification exists and is unclaimed
    const { data: record } = await supabase
      .from('identifications')
      .select('id')
      .eq('id', identification_id)
      .is('user_id', null)
      .single()

    if (!record) return json({ ok: true }) // Silent — don't reveal whether record exists

    const { error } = await supabase
      .from('pending_claims')
      .upsert({ email, identification_id, site_id: SITE_ID }, { onConflict: 'email,site_id' })

    if (error) return json({ error: error.message }, 500)

    return json({ ok: true })

  } catch (err: any) {
    return json({ error: err.message }, 500)
  }
}
