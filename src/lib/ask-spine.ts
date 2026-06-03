/** Extract entity names from question for spine lookup */
export function extractSearchTerms(question: string): string[] {
  const stop = new Set(['what','is','the','a','an','how','do','i','can','you','tell','me','about','this','my','it','was','are','does','did','has','have','where','when','who','which','why','to','of','in','on','at','for','with','its','that','be','clean','care','piece','best','place','sell','genuine','tell','identify'])
  return question.toLowerCase()
    .replaceAll(/[^a-z0-9\s]/g, ' ')
    .split(/\s+/)
    .filter(w => w.length > 2 && !stop.has(w))
    .slice(0, 6)
}

/** Humanise a source slug */
export function humaniseSource(slug: string): string {
  return slug.replaceAll('_', ' ').replace(/\b\w/g, c => c.toUpperCase())
}

export interface SpineMark {
  name: string
  image_url: string
  source: string
  gauk_id: string
}

export interface SpineResult {
  sources: string[]
  contextBlocks: string[]
  marks: SpineMark[]
}

/** Query spine tables for relevant context */
export async function lookupSpine(supabase: any, terms: string[], context: string, identificationResult: any): Promise<SpineResult> {
  const sources: string[] = []
  const contextBlocks: string[] = []
  const marks: SpineMark[] = []

  if (terms.length === 0) return { sources, contextBlocks, marks }

  const boostedTerms = [...terms]
  if (identificationResult?.maker) boostedTerms.unshift(identificationResult.maker)
  if (identificationResult?.manufacturer) boostedTerms.unshift(identificationResult.manufacturer)

  // Marks lookup — return images for visual display
  const { data: markRows } = await supabase
    .from('gauk_marks')
    .select('gauk_id, name, description, mark_type, date_from, date_to, country, image_url, sources')
    .or(boostedTerms.map((t: string) => `name.ilike.%${t}%`).join(','))
    .limit(8)

  if (markRows && markRows.length > 0) {
    const seenImages = new Set<string>()
    markRows.forEach((m: any) => {
      sources.push(m.name)
      const markDateTo = m.date_to ? `–${m.date_to}` : ''
      contextBlocks.push(`MARK: ${m.name} — ${m.mark_type || 'mark'}, ${m.country || ''}, ${m.date_from || ''}${markDateTo}. ${m.description || ''}`)
      if (m.image_url && !seenImages.has(m.image_url)) {
        seenImages.add(m.image_url)
        marks.push({
          gauk_id: m.gauk_id,
          name: m.name,
          image_url: m.image_url,
          source: m.sources?.[0] ? humaniseSource(m.sources[0]) : 'GAUK Spine'
        })
      }
    })
  }

  // Manufacturers lookup
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

  // Artists lookup
  const { data: artists } = await supabase
    .from('gauk_artists')
    .select('preferred_name, description, birth_year, death_year, nationality')
    .or(boostedTerms.map((t: string) => `preferred_name.ilike.%${t}%`).join(','))
    .limit(3)

  if (artists && artists.length > 0) {
    artists.forEach((a: any) => {
      sources.push(a.preferred_name)
      const artistDateTo = a.death_year ? `–${a.death_year}` : ''
      contextBlocks.push(`ARTIST: ${a.preferred_name} — ${a.nationality || ''}, ${a.birth_year || ''}${artistDateTo}. ${a.description || ''}`)
    })
  }

  return { sources: [...new Set(sources)], contextBlocks, marks }
}
