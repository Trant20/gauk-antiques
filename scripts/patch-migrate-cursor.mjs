import { readFileSync, writeFileSync } from 'node:fs'

const f = '/Users/hardone/gauk-antiques/scripts/migrate-to-gauk.mjs'
let c = readFileSync(f, 'utf8')

// Fix fetchAllArtists
const oldArtistFetch = `  const all = []
  let offset = 0
  while (true) {
    const { data, error } = await supabase
      .from('collection_artists')
      .select('id,source_id,source_artist_id,preferred_name,forward_name,last_name,display_date,begin_year,end_year,nationality,artist_type,wikidata_id,portrait_url,signature_url,slug,raw_data')
      .range(offset, offset + 499)
      .order('id', { ascending: true })
    if (error) throw new Error(error.message)
    if (!data.length) break
    all.push(...data)
    if (data.length < 500) break
    offset += 500
    process.stdout.write(\`\\r  Fetched \${all.length} artists…\`)
    await sleep(200)
  }`

const newArtistFetch = `  const all = []
  let lastId = '00000000-0000-0000-0000-000000000000'
  while (true) {
    const { data, error } = await supabase
      .from('collection_artists')
      .select('id,source_id,source_artist_id,preferred_name,forward_name,last_name,display_date,begin_year,end_year,nationality,artist_type,wikidata_id,portrait_url,signature_url,slug,raw_data')
      .gt('id', lastId)
      .order('id', { ascending: true })
      .limit(500)
    if (error) throw new Error(error.message)
    if (!data.length) break
    all.push(...data)
    lastId = data[data.length - 1].id
    if (data.length < 500) break
    process.stdout.write(\`\\r  Fetched \${all.length} artists…\`)
    await sleep(200)
  }`

const ac = (c.match(new RegExp(oldArtistFetch.replace(/[.*+?^${}()|[\]\\]/g, String.raw`\$&`), 'g')) || []).length
console.log(`Artist fetch: found ${ac}`)
c = c.replace(oldArtistFetch, newArtistFetch)

// Fix fetchAllObjects
const oldObjectFetch = `  const all = []
  let offset = 0
  while (true) {
    const { data, error } = await supabase
      .from('collection_objects')
      .select('id,source_id,source_object_id,accession_num,title,display_date,begin_year,end_year,medium,dimensions,classification,attribution,credit_line,provenance_text,image_url,thumb_url,on_view,wikidata_id,raw_data')
      .range(offset, offset + 499)
      .order('id', { ascending: true })
    if (error) throw new Error(error.message)
    if (!data.length) break
    all.push(...data)
    if (data.length < 500) break
    offset += 500
    process.stdout.write(\`\\r  Fetched \${all.length} objects…\`)
    await sleep(200)
  }`

const newObjectFetch = `  const all = []
  let lastId = '00000000-0000-0000-0000-000000000000'
  while (true) {
    const { data, error } = await supabase
      .from('collection_objects')
      .select('id,source_id,source_object_id,accession_num,title,display_date,begin_year,end_year,medium,dimensions,classification,attribution,credit_line,provenance_text,image_url,thumb_url,on_view,wikidata_id,raw_data')
      .gt('id', lastId)
      .order('id', { ascending: true })
      .limit(500)
    if (error) throw new Error(error.message)
    if (!data.length) break
    all.push(...data)
    lastId = data[data.length - 1].id
    if (data.length < 500) break
    process.stdout.write(\`\\r  Fetched \${all.length} objects…\`)
    await sleep(200)
  }`

const oc = (c.match(new RegExp(oldObjectFetch.replace(/[.*+?^${}()|[\]\\]/g, String.raw`\$&`), 'g')) || []).length
console.log(`Object fetch: found ${oc}`)
c = c.replace(oldObjectFetch, newObjectFetch)

writeFileSync(f, c)
console.log('done')
console.log('Verify:', c.includes(".gt('id', lastId)") ? 'cursor pagination ✓' : 'still offset ✗')
