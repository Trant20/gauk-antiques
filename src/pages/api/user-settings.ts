import type { APIRoute } from 'astro'
import { env } from 'cloudflare:workers'
import { createClient } from '@supabase/supabase-js'
import type { CloudflareEnv } from '../../lib/constants'

const VALID_CURRENCIES = new Set(['GBP', 'USD', 'NZD', 'EUR', 'AUD'])
const VALID_LOCALES = new Set(['en-GB', 'en-US', 'en-NZ', 'en-AU', 'de-DE', 'fr-FR'])

function getSupabase() {
  return createClient(
    (env as unknown as CloudflareEnv).PUBLIC_SUPABASE_URL,
    (env as unknown as CloudflareEnv).SUPABASE_SERVICE_ROLE_KEY
  )
}

function json(data: unknown, status = 200) {
  return new Response(JSON.stringify(data), {
    status,
    headers: { 'Content-Type': 'application/json' }
  })
}

export const GET: APIRoute = async ({ request }) => {
  try {
    const auth = request.headers.get('Authorization')
    if (!auth?.startsWith('Bearer ')) return json({ error: 'Unauthorized' }, 401)

    const token = auth.slice(7)
    const supabase = getSupabase()

    const { data: { user }, error: authError } = await supabase.auth.getUser(token)
    if (authError || !user) return json({ error: 'Invalid token' }, 401)

    const { data: settings } = await supabase
      .from('user_settings')
      .select('currency, locale, audit_rooms, policy_cover')
      .eq('user_id', user.id)
      .single()

    // Return defaults if no settings yet
    return json({
      currency: settings?.currency || 'GBP',
      locale: settings?.locale || 'en-GB',
      audit_rooms: settings?.audit_rooms || [],
      policy_cover: settings?.policy_cover || 0
    })

  } catch (err: any) {
    return json({ error: err.message }, 500)
  }
}

export const POST: APIRoute = async ({ request }) => {
  try {
    const auth = request.headers.get('Authorization')
    if (!auth?.startsWith('Bearer ')) return json({ error: 'Unauthorized' }, 401)

    const token = auth.slice(7)
    const supabase = getSupabase()

    const { data: { user }, error: authError } = await supabase.auth.getUser(token)
    if (authError || !user) return json({ error: 'Invalid token' }, 401)

    const body = await request.json()
    const currency = body.currency
    const locale = body.locale
    const auditRooms = body.audit_rooms
    const policyCover = body.policy_cover

    if (currency && !VALID_CURRENCIES.has(currency)) {
      return json({ error: 'Invalid currency' }, 400)
    }
    if (locale && !VALID_LOCALES.has(locale)) {
      return json({ error: 'Invalid locale' }, 400)
    }
    if (auditRooms !== undefined && !Array.isArray(auditRooms)) {
      return json({ error: 'Invalid audit_rooms' }, 400)
    }

    const update: Record<string, any> = { updated_at: new Date().toISOString() }
    if (currency) update.currency = currency
    if (locale) update.locale = locale
    if (auditRooms !== undefined) update.audit_rooms = auditRooms
    if (policyCover !== undefined) update.policy_cover = parseInt(String(policyCover), 10) || 0

    const { error } = await supabase
      .from('user_settings')
      .upsert({
        user_id: user.id,
        ...update
      }, { onConflict: 'user_id' })

    if (error) return json({ error: 'Failed to save settings' }, 500)

    return json({ currency: currency || 'GBP', locale: locale || 'en-GB', audit_rooms: auditRooms || [], policy_cover: policyCover || 0 })

  } catch (err: any) {
    return json({ error: err.message }, 500)
  }
}
