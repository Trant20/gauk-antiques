import type { APIRoute } from 'astro'
import { env } from 'cloudflare:workers'

const SITE_ID = 'add6d12c-ecd8-4517-b2e5-0f4977603744'
const SESSION_TTL_MS = 60 * 60 * 1000 // 60 minutes

/** Generate a simple session ID */
function generateSessionId(): string {
  return Date.now().toString(36) + Math.random().toString(36).slice(2)
}

export const POST: APIRoute = async ({ request }) => {
  try {
    const auth = request.headers.get('Authorization')

    const supabase = await import('@supabase/supabase-js').then(m =>
      m.createClient((env as any).PUBLIC_SUPABASE_URL, (env as any).SUPABASE_SERVICE_ROLE_KEY)
    )

    // Guest session — no credit deduction, just return a session ID
    if (!auth) {
      return new Response(JSON.stringify({
        session_id: generateSessionId(),
        guest: true,
        ok: true
      }), { status: 200, headers: { 'Content-Type': 'application/json' } })
    }

    const token = auth.replace('Bearer ', '')
    const { data: { user }, error: authError } = await supabase.auth.getUser(token)
    if (authError || !user) {
      return new Response(JSON.stringify({ error: 'Invalid token' }), {
        status: 401, headers: { 'Content-Type': 'application/json' }
      })
    }

    const sessionId = generateSessionId()

    // Check for existing active session in KV
    const kv = (env as any).SESSION
    const existingKey = `ask_session:${user.id}`
    const existing = kv ? await kv.get(existingKey) : null

    if (existing) {
      const parsed = JSON.parse(existing)
      const age = Date.now() - parsed.created_at
      if (age < SESSION_TTL_MS) {
        // Active session exists — return it without charging
        return new Response(JSON.stringify({
          session_id: parsed.session_id,
          guest: false,
          ok: true,
          resumed: true
        }), { status: 200, headers: { 'Content-Type': 'application/json' } })
      }
    }

    // Store session in KV with TTL
    if (kv) {
      await kv.put(existingKey, JSON.stringify({
        session_id: sessionId,
        user_id: user.id,
        created_at: Date.now()
      }), { expirationTtl: SESSION_TTL_MS / 1000 })
    }

    return new Response(JSON.stringify({
      session_id: sessionId,
      guest: false,
      ok: true,
      resumed: false
    }), { status: 200, headers: { 'Content-Type': 'application/json' } })

  } catch (err: any) {
    return new Response(JSON.stringify({ error: err.message }), {
      status: 500, headers: { 'Content-Type': 'application/json' }
    })
  }
}
