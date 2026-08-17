import { defineMiddleware } from 'astro:middleware'
import { createClient } from '@supabase/supabase-js'
import { env } from 'cloudflare:workers'
import type { CloudflareEnv } from './lib/constants'

const DEFAULT_CURRENCY = 'GBP'
const DEFAULT_LOCALE = 'en-GB'

export const onRequest = defineMiddleware(async (context, next) => {
  context.locals.userId = null
  context.locals.currency = DEFAULT_CURRENCY
  context.locals.locale = DEFAULT_LOCALE

  const token = context.cookies.get('gauk-token')?.value
  if (!token) return next()

  try {
    const supabase = createClient(
      (env as unknown as CloudflareEnv).PUBLIC_SUPABASE_URL,
      (env as unknown as CloudflareEnv).SUPABASE_SERVICE_ROLE_KEY
    )

    const { data: { user }, error } = await supabase.auth.getUser(token)
    if (error || !user) return next()

    context.locals.userId = user.id

    const { data: settings } = await supabase
      .from('user_settings')
      .select('currency, locale')
      .eq('user_id', user.id)
      .single()

    if (settings) {
      context.locals.currency = settings.currency || DEFAULT_CURRENCY
      context.locals.locale = settings.locale || DEFAULT_LOCALE
    }
  } catch {
    // Auth failed — continue with defaults
  }

  return next()
})
