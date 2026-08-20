import type { APIRoute } from 'astro'
import { env } from 'cloudflare:workers'
import { createClient } from '@supabase/supabase-js'
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

    const { receipt_id } = await request.json()
    if (!receipt_id) return json({ error: 'Missing receipt_id' }, 400)

    const { error } = await supabase
      .from('receipts')
      .update({ user_id: user.id })
      .eq('id', receipt_id)
      .is('user_id', null)

    if (error) return json({ error: error.message }, 500)
    return json({ ok: true })

  } catch (err: any) {
    return json({ error: err.message }, 500)
  }
}
