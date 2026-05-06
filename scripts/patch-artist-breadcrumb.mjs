import { readFileSync, writeFileSync } from 'fs'

const f = '/Users/hardone/gauk-antiques/src/pages/artists/[slug].astro'
let c = readFileSync(f, 'utf8')

// 1. Add ?from=[slug] to work links so object page knows where we came from
const oldWorkLink = `href={\`/collection/\${w.accession_num.replace(/\\./g, '-')}\`}`
const newWorkLink = `href={\`/collection/\${w.accession_num.replace(/\\./g, '-')}?from=\${canonicalSlug}\`}`

const workCount = (c.match(new RegExp(oldWorkLink.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'), 'g')) || []).length
console.log(`Work links: found ${workCount}`)
c = c.replaceAll(oldWorkLink, newWorkLink)

// 2. Replace the plain back link with a proper breadcrumb
const oldBack = `<a class="ap-link" href="/categories/collections">← Back to collection</a>`
const newBack = `<a class="ap-link" href="/categories/collections">Collections</a>
          <span style="color:var(--text3);margin:0 6px">/</span>
          <span style="color:var(--text2);font-family:var(--prata);font-size:11px">{displayName}</span>`

const backCount = (c.match(new RegExp(oldBack.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'), 'g')) || []).length
console.log(`Back links: found ${backCount}`)
c = c.replaceAll(oldBack, newBack)

writeFileSync(f, c)
console.log('done')
