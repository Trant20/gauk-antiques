import { createClient } from '@supabase/supabase-js'

/** Shared browser-side Supabase client. Import this in all client scripts. */
export const supabase = createClient(
  import.meta.env.PUBLIC_SUPABASE_URL,
  import.meta.env.PUBLIC_SUPABASE_ANON_KEY
)

/** Global session expiry handler — redirects to gaukauth.com when session ends.
 *  Supabase auto-refreshes tokens silently during the 30-day refresh token window.
 *  This fires only when the refresh token itself expires or explicit signout occurs. */
if (typeof window !== 'undefined') {
  supabase.auth.onAuthStateChange((event) => {
    if (event === 'SIGNED_OUT') {
      const from = 'gaukantiques.com'
      const next = window.location.pathname || '/library'
      window.location.href = `https://gaukauth.com?from=${from}&next=${encodeURIComponent(next)}`
    }
  })
}
