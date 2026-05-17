import { createClient } from '@supabase/supabase-js'

/** Shared browser-side Supabase client. Import this in all client scripts. */
export const supabase = createClient(
  import.meta.env.PUBLIC_SUPABASE_URL,
  import.meta.env.PUBLIC_SUPABASE_ANON_KEY
)
