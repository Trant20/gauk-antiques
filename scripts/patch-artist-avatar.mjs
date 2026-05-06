import { readFileSync, writeFileSync } from 'fs'

const f = '/Users/hardone/gauk-antiques/src/pages/categories/collections.astro'
let c = readFileSync(f, 'utf8')

const from = `      <div class="col-avatar">\${(a.last_name||a.preferred_name||'?').charAt(0)}</div>`
const to   = `      <div class="col-avatar">\${a.portrait_url ? '<img src="' + a.portrait_url + '" alt="" style="width:100%;height:100%;object-fit:cover;border-radius:50%;" loading="lazy"/>' : (a.last_name||a.preferred_name||'?').charAt(0)}</div>`

const count = (c.match(new RegExp(from.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'), 'g')) || []).length
console.log(`Found ${count} occurrence(s) to replace`)

c = c.replaceAll(from, to)
writeFileSync(f, c)
console.log('done')
