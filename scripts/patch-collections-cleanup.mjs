import { readFileSync, writeFileSync } from 'fs'

const f = '/Users/hardone/gauk-antiques/src/pages/categories/collections.astro'
let c = readFileSync(f, 'utf8')

// 1. Fix remaining \u0027 in works loop
const before1 = c.split('\\u0027').length - 1
c = c.replaceAll("replace(/'/g,\"\\u0027\")", "replace(/'/g,'&#39;')")
const after1 = c.split('\\u0027').length - 1
console.log(`u0027: ${before1} → ${after1} remaining`)

// 2. Remove ULAN ID from both artist panels
const ulanBlock = '${a.ulan_id?`<div><div class="col-field-label">ULAN ID</div><div class="col-field-val">${a.ulan_id}</div></div>`:\'\'}'
const ulanCount = (c.match(new RegExp(ulanBlock.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'), 'g')) || []).length
console.log(`ULAN blocks: found ${ulanCount}`)
c = c.replaceAll(ulanBlock, '')

// 3. Remove duplicate large portrait (small avatar in header is enough for the panel)
const largePortrait = `\${a.portrait_url ? '<img src="' + a.portrait_url + '" alt="" style="max-height:200px;width:auto;max-width:100%;object-fit:contain;display:block;margin:0 auto 16px;border-radius:4px;" loading="lazy"/>' : ''}`
const portraitCount = (c.match(new RegExp(largePortrait.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'), 'g')) || []).length
console.log(`Large portrait blocks: found ${portraitCount}`)
c = c.replaceAll(largePortrait, '')

writeFileSync(f, c)
console.log('done')
