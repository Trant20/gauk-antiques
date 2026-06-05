import type { SupabaseClient } from '@supabase/supabase-js'
import { ANTIQUES_SITE_ID } from './constants'

/** Fetch prompt config from ai_prompts for the given context, fallback to general.
 *  Pass the select string appropriate for the calling route. */
export async function getPromptConfig(
  supabase: SupabaseClient,
  context: string,
  select: string
): Promise<Record<string, unknown> | null> {
  const { data } = await supabase
    .from('ai_prompts')
    .select(select)
    .eq('site_id', ANTIQUES_SITE_ID)
    .eq('context', context)
    .single()

  if (data) return data as Record<string, unknown>

  const { data: fallback } = await supabase
    .from('ai_prompts')
    .select(select)
    .eq('site_id', ANTIQUES_SITE_ID)
    .eq('context', 'general')
    .single()

  return fallback as Record<string, unknown> | null
}
