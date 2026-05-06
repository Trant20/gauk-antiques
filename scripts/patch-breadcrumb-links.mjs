import { readFileSync, writeFileSync } from 'fs'

// ── OBJECT PAGE ──────────────────────────────────────────────
const objFile = '/Users/hardone/gauk-antiques/src/pages/collection/[slug].astro'
let obj = readFileSync(objFile, 'utf8')

// Fix: Collections link goes to artist profile when fromSlug is present
const oldCollectionsLink = `<a class="op-link" href="/categories/collections">Collections</a>`
const newCollectionsLink = `<a class="op-link" href={fromSlug ? '/artists/' + fromSlug : '/categories/collections'}>
            {fromSlug && fromArtistName ? fromArtistName : 'Collections'}
          </a>`

const objLinkCount = (obj.match(new RegExp(oldCollectionsLink.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'), 'g')) || []).length
console.log(`Object Collections link: found ${objLinkCount}`)
obj = obj.replace(oldCollectionsLink, newCollectionsLink)

// Remove Wikidata link from object page
const oldObjWd = `{obj.wikidata_id && (
            <a class="op-link" href={\`https://www.wikidata.org/wiki/\${obj.wikidata_id}\`} target="_blank" rel="noopener">Wikidata →</a>
          )}`
const objWdCount = (obj.match(new RegExp(oldObjWd.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'), 'g')) || []).length
console.log(`Object Wikidata link: found ${objWdCount}`)
obj = obj.replace(oldObjWd, '')

writeFileSync(objFile, obj)
console.log('Object page done')

// ── ARTIST PAGE ──────────────────────────────────────────────
const artFile = '/Users/hardone/gauk-antiques/src/pages/artists/[slug].astro'
let art = readFileSync(artFile, 'utf8')

// Remove Wikidata and ULAN links from artist page
const oldWdLink = `{artist.wikidata_id && (
            <a class="ap-link" href={\`https://www.wikidata.org/wiki/\${artist.wikidata_id}\`} target="_blank" rel="noopener">Wikidata →</a>
          )}`
const oldUlanLink = `{artist.ulan_id && (
            <a class="ap-link" href={\`https://vocab.getty.edu/ulan/\${artist.ulan_id}\`} target="_blank" rel="noopener">ULAN →</a>
          )}`

const wdCount = (art.match(new RegExp(oldWdLink.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'), 'g')) || []).length
const ulanCount = (art.match(new RegExp(oldUlanLink.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'), 'g')) || []).length
console.log(`Artist Wikidata link: found ${wdCount}, ULAN link: found ${ulanCount}`)
art = art.replace(oldWdLink, '')
art = art.replace(oldUlanLink, '')

writeFileSync(artFile, art)
console.log('Artist page done')
