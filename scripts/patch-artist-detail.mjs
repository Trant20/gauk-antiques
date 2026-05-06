import { readFileSync, writeFileSync } from 'fs'

const f = '/Users/hardone/gauk-antiques/src/pages/categories/collections.astro'
let c = readFileSync(f, 'utf8')

// Replace the small avatar in detail panels with portrait photo when available
const avatarFrom = `<div class="col-avatar" style="width:52px;height:52px;font-size:20px;flex-shrink:0">\${(a.last_name||a.preferred_name||'?').charAt(0)}</div>`
const avatarTo   = `<div class="col-avatar" style="width:52px;height:52px;font-size:20px;flex-shrink:0;overflow:hidden;">\${a.portrait_url ? '<img src="' + a.portrait_url + '" alt="" style="width:100%;height:100%;object-fit:cover;border-radius:50%;" loading="lazy"/>' : (a.last_name||a.preferred_name||'?').charAt(0)}</div>`

const avatarCount = (c.match(new RegExp(avatarFrom.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'), 'g')) || []).length
console.log(`Avatar: found ${avatarCount} occurrence(s)`)
c = c.replaceAll(avatarFrom, avatarTo)

// Add signature block after the wikidata link in both panels
const wikidataLine = `\${a.wikidata_id?\`<div style="margin-bottom:16px"><a class="col-wikidata" href="https://www.wikidata.org/wiki/\${a.wikidata_id}" target="_blank" rel="noopener">Wikidata →</a></div>\`:''}`
const wikidataWithSig = wikidataLine + `
    \${a.signature_url ? '<div style="margin-bottom:20px;padding:12px;background:var(--surface);border:1px solid var(--border);border-radius:var(--radius);text-align:center;"><div class="col-field-label" style="margin-bottom:8px">Signature</div><img src="' + a.signature_url + '" alt="Signature" style="max-height:48px;max-width:100%;object-fit:contain;filter:invert(1) opacity(0.7);" loading="lazy"/></div>' : ''}`

const sigCount = (c.match(new RegExp(wikidataLine.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'), 'g')) || []).length
console.log(`Wikidata/signature: found ${sigCount} occurrence(s)`)
c = c.replaceAll(wikidataLine, wikidataWithSig)

writeFileSync(f, c)
console.log('done')
