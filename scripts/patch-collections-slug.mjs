import { readFileSync, writeFileSync } from 'fs'

const f = '/Users/hardone/gauk-antiques/src/pages/categories/collections.astro'
let c = readFileSync(f, 'utf8')

// 1. Add slug to the fetchArtists select
const oldSelect = `select: 'constituent_id,preferred_name,forward_name,last_name,display_date,nationality,constituent_type,ulan_id,wikidata_id,portrait_url,signature_url'`
const newSelect = `select: 'constituent_id,preferred_name,forward_name,last_name,display_date,nationality,constituent_type,ulan_id,wikidata_id,portrait_url,signature_url,slug'`

const selectCount = (c.match(new RegExp(oldSelect.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'), 'g')) || []).length
console.log(`Select: found ${selectCount} occurrence(s)`)
c = c.replaceAll(oldSelect, newSelect)

// 2. Replace client-side slug computation with DB slug in profile links
const oldLink = `href="\${'/artists/' + a.preferred_name.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '')}"`
const newLink = `href="\${'/artists/' + (a.slug || a.preferred_name.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-\\$/g, ''))}"`

const linkCount = (c.match(new RegExp(oldLink.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'), 'g')) || []).length
console.log(`Profile links: found ${linkCount} occurrence(s)`)
c = c.replaceAll(oldLink, newLink)

writeFileSync(f, c)
console.log('done')
