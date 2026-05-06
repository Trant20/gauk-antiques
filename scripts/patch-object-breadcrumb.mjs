import { readFileSync, writeFileSync } from 'fs'

const f = '/Users/hardone/gauk-antiques/src/pages/collection/[slug].astro'
let c = readFileSync(f, 'utf8')

// 1. Add fromSlug resolution in the frontmatter — after the slug/accessionNum lines
const oldSlugLine = `const accessionNum = slug.replace(/-/g, '.')`
const newSlugLine = `const accessionNum = slug.replace(/-/g, '.')

// Breadcrumb — read ?from=artist-slug if arriving from an artist profile
const fromSlug = Astro.url.searchParams.get('from') || null
let fromArtistName: string | null = null
if (fromSlug) {
  const { data: fromArtist } = await supabase
    .from('nga_constituents')
    .select('preferred_name')
    .eq('slug', fromSlug)
    .single()
  fromArtistName = fromArtist?.preferred_name || null
}`

const slugCount = (c.match(new RegExp(oldSlugLine.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'), 'g')) || []).length
console.log(`Slug line: found ${slugCount}`)
c = c.replace(oldSlugLine, newSlugLine)

// 2. Replace the plain back link with a full breadcrumb trail
const oldBack = `<a class="op-link" href="/categories/collections">← Back to collection</a>`
const newBack = `<a class="op-link" href="/categories/collections">Collections</a>
          {fromSlug && fromArtistName && (
            <>
              <span style="color:var(--text3);margin:0 6px">/</span>
              <a class="op-link" href={'/artists/' + fromSlug}>{fromArtistName}</a>
            </>
          )}
          <span style="color:var(--text3);margin:0 6px">/</span>
          <span style="color:var(--text2);font-family:var(--prata);font-size:11px;max-width:200px;overflow:hidden;text-overflow:ellipsis;white-space:nowrap;display:inline-block;vertical-align:middle">{obj.title}</span>`

const backCount = (c.match(new RegExp(oldBack.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'), 'g')) || []).length
console.log(`Back links: found ${backCount}`)
c = c.replace(oldBack, newBack)

writeFileSync(f, c)
console.log('done')
