import { createClient } from '@supabase/supabase-js'

/** Extract entity names from question for spine lookup */
export function extractSearchTerms(question: string): string[] {
  const stop = new Set(['what','is','the','a','an','how','do','i','can','you','tell','me','about','this','my','it','was','are','does','did','has','have','where','when','who','which','why','to','of','in','on','at','for','with','its','that','be'])
  return question.toLowerCase()
    .replace(/[^a-z0-9\s]/g, ' ')
    .split(/\s+/)
    .filter(w => w.length > 2 && !stop.has(w))
    .slice(0, 6)
}

/** Query spine tables for relevant context */
export async function lookupSpine(supabase: any, terms: string[], context: string, identificationResult: any) {
  const sources: string[] = []
  const contextBlocks: string[] = []

  const boostedTerms = [...terms]
  if (identificationResult?.maker) boostedTerms.unshift(identificationResult.maker)
  if (identificationResult?.manufacturer) boostedTerms.unshift(identificationResult.manufacturer)

  const { data: marks } = await supabase
    .from('gauk_marks')
    .select('name, description, mark_type, date_from, date_to, country')
    .or(boostedTerms.map((t: string) => `name.ilike.%${t}%`).join(','))
    .limit(3)

  if (marks && marks.length > 0) {
    marks.forEach((m: any) => {
      sources.push(m.name)
      contextBlocks.push(`MARK: ${m.name} — ${m.mark_type || 'mark'}, ${m.country || ''}, ${m.date_from || ''}${m.date_to ? `–${m.date_to}` : ''}. ${m.description || ''}`)
    })
  }

  const { data: manufacturers } = await supabase
    .from('gauk_manufacturers')
    .select('name, description, founded_year, dissolved_year, location, country')
    .or(boostedTerms.map((t: string) => `name.ilike.%${t}%`).join(','))
    .limit(3)

  if (manufacturers && manufacturers.length > 0) {
    manufacturers.forEach((m: any) => {
      sources.push(m.name)
      contextBlocks.push(`MANUFACTURER: ${m.name} — founded ${m.founded_year || 'unknown'}, ${m.location || m.country || ''}. ${m.description || ''}`)
    })
  }

  const { data: artists } = await supabase
    .from('gauk_artists')
    .select('preferred_name, description, birth_year, death_year, nationality')
    .or(boostedTerms.map((t: string) => `preferred_name.ilike.%${t}%`).join(','))
    .limit(3)

  if (artists && artists.length > 0) {
    artists.forEach((a: any) => {
      sources.push(a.preferred_name)
      contextBlocks.push(`ARTIST: ${a.preferred_name} — ${a.nationality || ''}, ${a.birth_year || ''}${a.death_year ? `–${a.death_year}` : ''}. ${a.description || ''}`)
    })
  }

  return { sources: [...new Set(sources)], contextBlocks }
}
