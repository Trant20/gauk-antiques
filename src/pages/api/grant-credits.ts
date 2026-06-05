import type { APIRoute } from 'astro'
import { env } from 'cloudflare:workers'
import { createClient } from '@supabase/supabase-js'

const SITE_ID = 'add6d12c-ecd8-4517-b2e5-0f4977603744'

export const POST: APIRoute = async ({ request }) => {
  try {
    const auth = request.headers.get('Authorization')
    if (!auth?.startsWith('Bearer ')) {
      return new Response(JSON.stringify({ error: 'Unauthorized' }), {
        status: 401, headers: { 'Content-Type': 'application/json' }
      })
    }

    const token = auth.slice(7)
    const supabase = createClient(
      (env as any).PUBLIC_SUPABASE_URL,
      (env as any).SUPABASE_SERVICE_ROLE_KEY
    )

    const { data: { user }, error: authError } = await supabase.auth.getUser(token)
    if (authError || !user) {
      return new Response(JSON.stringify({ error: 'Invalid token' }), {
        status: 401, headers: { 'Content-Type': 'application/json' }
      })
    }

    const { error } = await supabase.rpc('grant_signup_credits', {
      p_user_id: user.id,
      p_site_id: SITE_ID
    })
    if (error) {
      return new Response(JSON.stringify({ error: error.message }), {
        status: 500, headers: { 'Content-Type': 'application/json' }
      })
    }

    return new Response(JSON.stringify({ ok: true }), {
      status: 200, headers: { 'Content-Type': 'application/json' }
    })
  } catch (err: any) {
    return new Response(JSON.stringify({ error: err.message }), {
      status: 500, headers: { 'Content-Type': 'application/json' }
    })
  }
}
