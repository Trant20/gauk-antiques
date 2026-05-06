import { readFileSync, writeFileSync } from 'fs'

const f = '/Users/hardone/gauk-antiques/src/pages/categories/collections.astro'
let c = readFileSync(f, 'utf8')

// Helper — same slug logic as the profile pages
// Add View Full Profile → after artist Wikidata links (both panels, lines 533 and 668)
// Both have identical text so replaceAll hits both
const artistWd = `\${a.wikidata_id?\`<div style="margin-bottom:16px"><a class="col-wikidata" href="https://www.wikidata.org/wiki/\${a.wikidata_id}" target="_blank" rel="noopener">Wikidata →</a></div>\`:''}`
const artistWdWithProfile = artistWd + `
    <div style="margin-top:12px;margin-bottom:16px"><a class="col-wikidata" style="display:inline-block;padding:7px 14px;border:1px solid rgba(200,160,96,.4);border-radius:4px;" href="\${'/artists/' + a.preferred_name.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '')}">View Full Profile →</a></div>`

const artistCount = (c.match(new RegExp(artistWd.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'), 'g')) || []).length
console.log(`Artist Wikidata blocks found: ${artistCount}`)
c = c.replaceAll(artistWd, artistWdWithProfile)

// Add View Object → after object Wikidata links (lines 453 and 736)
const objWd = `\${o.wikidata_id ? \`<div style="margin-top:8px"><a class="col-wikidata" href="https://www.wikidata.org/wiki/\${o.wikidata_id}" target="_blank" rel="noopener">Wikidata →</a></div>\` : ''}`
const objWdWithLink = objWd + `
    <div style="margin-top:12px"><a class="col-wikidata" style="display:inline-block;padding:7px 14px;border:1px solid rgba(200,160,96,.4);border-radius:4px;" href="\${'/collection/' + o.accession_num.replace(/\\./g, '-')}">View Object →</a></div>`

const objCount = (c.match(new RegExp(objWd.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'), 'g')) || []).length
console.log(`Object Wikidata blocks found: ${objCount}`)
c = c.replaceAll(objWd, objWdWithLink)

writeFileSync(f, c)
console.log('done')
