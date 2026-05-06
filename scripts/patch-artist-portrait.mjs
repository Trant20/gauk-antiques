import { readFileSync, writeFileSync } from 'fs'

const f = '/Users/hardone/gauk-antiques/src/pages/categories/collections.astro'
let c = readFileSync(f, 'utf8')

// In both detail panels, insert a full portrait image above the name/avatar row
// The avatar row starts with: <div style="display:flex;align-items:center;gap:14px;margin-bottom:20px">
const avatarRow = `<div style="display:flex;align-items:center;gap:14px;margin-bottom:20px">`
const avatarRowWithPortrait = `\${a.portrait_url ? '<img src="' + a.portrait_url + '" alt="" style="width:100%;max-height:280px;object-fit:cover;object-position:top;border-radius:4px;margin-bottom:16px;" loading="lazy"/>' : ''}
    <div style="display:flex;align-items:center;gap:14px;margin-bottom:20px">`

const count = (c.match(new RegExp(avatarRow.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'), 'g')) || []).length
console.log(`Found ${count} avatar row(s) to patch`)
c = c.replaceAll(avatarRow, avatarRowWithPortrait)

writeFileSync(f, c)
console.log('done')
