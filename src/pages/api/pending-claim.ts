import type { APIRoute } from 'astro'
import { env } from 'cloudflare:workers'
import { createClient } from '@supabase/supabase-js'

export const POST: APIRoute = async ({ request }) => {
  const { email, identification_id, site_id } = await request.json()
  if (!email || !identification_id || !site_id) {
    return new Response(JSON.stringify({ error: 'Missing required fields' }), { status: 400 })
  }

  const supabase = createClient(env.PUBLIC_SUPABASE_URL, env.SUPABASE_SERVICE_ROLE_KEY)

  // Upsert — if they try again with same email, update the identification_id
  const { error } = await supabase
    .from('pending_claims')
    .upsert({ email, identification_id, site_id }, { onConflict: 'email,site_id' })

  if (error) {
    return new Response(JSON.stringify({ error: error.message }), { status: 500 })
  }

  return new Response(JSON.stringify({ ok: true }), { status: 200 })
}
