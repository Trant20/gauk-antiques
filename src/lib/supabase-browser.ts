import { createClient } from '@supabase/supabase-js'

/** Write/delete the gauk-token cookie so Astro middleware can read it server-side */
function setAuthCookie(token: string | null) {
  if (typeof document === 'undefined') return
  if (token) {
    const expires = new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toUTCString()
    document.cookie = `gauk-token=${token}; path=/; expires=${expires}; SameSite=Lax`
  } else {
    document.cookie = 'gauk-token=; path=/; expires=Thu, 01 Jan 1970 00:00:00 GMT'
  }
}

/** Shared browser-side Supabase client. Import this in all client scripts. */
export const supabase = createClient(
  import.meta.env.PUBLIC_SUPABASE_URL,
  import.meta.env.PUBLIC_SUPABASE_ANON_KEY
)

/** Sync auth token to cookie and handle session events */
if (typeof window !== 'undefined') {
  // Sync existing session to cookie on page load
  supabase.auth.getSession().then(({ data: { session } }) => {
    if (session?.access_token) setAuthCookie(session.access_token)
  })

  supabase.auth.onAuthStateChange((event, session) => {
    if (event === 'SIGNED_IN' || event === 'TOKEN_REFRESHED') {
      if (session?.access_token) setAuthCookie(session.access_token)
    }
    if (event === 'SIGNED_OUT') {
      setAuthCookie(null)
      const from = 'gaukantiques.com'
      const next = window.location.pathname || '/library'
      window.location.href = `https://gaukauth.com?from=${from}&next=${encodeURIComponent(next)}`
    }
  })
}
