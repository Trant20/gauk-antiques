import { readFileSync, writeFileSync } from 'fs'

const f = '/Users/hardone/gauk-antiques/src/pages/artists/[slug].astro'
let c = readFileSync(f, 'utf8')

const oldQuery = `// Find constituent by slug-matching preferred_name
const { data: constituents } = await supabase
  .from('nga_constituents')
  .select('constituent_id,preferred_name,forward_name,last_name,display_date,begin_year,end_year,nationality,constituent_type,ulan_id,wikidata_id,portrait_url,signature_url')
  .not('preferred_name', 'is', null)
  .neq('constituent_type', 'anonymous')

const artist = constituents?.find(c => nameToSlug(c.preferred_name) === slug)`

const newQuery = `// Find constituent directly by slug column
const { data: artist } = await supabase
  .from('nga_constituents')
  .select('constituent_id,preferred_name,forward_name,last_name,display_date,begin_year,end_year,nationality,constituent_type,ulan_id,wikidata_id,portrait_url,signature_url')
  .eq('slug', slug)
  .single()`

const count = (c.match(new RegExp(oldQuery.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'), 'g')) || []).length
console.log(`Found ${count} occurrence(s) to replace`)
c = c.replace(oldQuery, newQuery)
writeFileSync(f, c)
console.log('done')
