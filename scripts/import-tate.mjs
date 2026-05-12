import { createClient } from '@supabase/supabase-js'
import { readFileSync } from 'fs'

import 'dotenv/config'

const SUPABASE_URL = process.env.PUBLIC_SUPABASE_URL
const SUPABASE_SERVICE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY

if (!SUPABASE_URL || !SUPABASE_SERVICE_KEY) {
  throw new Error('Missing SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY in environment')
}
const ARTIST_CSV = `${process.env.HOME}/Desktop/collection-master/artist_data.csv`
const ARTWORK_CSV = `${process.env.HOME}/Desktop/collection-master/artwork_data.csv`
const BATCH = 200
const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_KEY)
const sleep = ms => new Promise(r => setTimeout(r, ms))

function readCsv(path) {
  const raw = readFileSync(path, 'utf8').replace(/^\uFEFF/, '')
  const lines = raw.split(/\r?\n/).filter(l => l.trim())
  const headers = lines[0].split(',').map(h => h.trim())
  return lines.slice(1).map(line => {
    const fields = []
    let cur = '', inQ = false
    for (let i = 0; i < line.length; i++) {
      const ch = line[i]
      if (ch === '"') { if (inQ && line[i+1] === '"') { cur += '"'; i++ } else inQ = !inQ }
      else if (ch === ',' && !inQ) { fields.push(cur.trim()); cur = '' }
      else cur += ch
    }
    fields.push(cur.trim())
    const obj = {}
    headers.forEach((h, i) => { obj[h] = fields[i] || '' })
    return obj
  })
}

async function upsertBatches(table, rows, onConflict) {
  let total = 0, errors = 0
  for (let i = 0; i < rows.length; i += BATCH) {
    const { error } = await supabase.from(table).upsert(rows.slice(i, i + BATCH), { onConflict, ignoreDuplicates: true })
    if (error) { console.error(`\n  Error at ${i}: ${error.message}`); errors++ }
    else total += Math.min(BATCH, rows.length - i)
    process.stdout.write(`\r  ${i + BATCH}/${rows.length}`)
    await sleep(200)
  }
  console.log(`\n  Done: ${total} rows, ${errors} errors`)
  return total
}

async function main() {
  const artists = readCsv(ARTIST_CSV)
  const artworks = readCsv(ARTWORK_CSV)
  console.log(`Artists: ${artists.length}, Artworks: ${artworks.length}`)
  console.log(`First artist: id="${artists[0]?.id}" name="${artists[0]?.name}"`)

  const aRows = artists.filter(a => a.id).map(a => ({
    source_id: 'tate', source_artist_id: a.id,
    preferred_name: a.name || 'Unknown',
    forward_name: a.name ? a.name.split(',').reverse().join(' ').trim() : null,
    last_name: a.name ? a.name.split(',')[0].trim() : null,
    display_date: a.dates || null,
    begin_year: parseInt(a.yearOfBirth) || null,
    end_year: parseInt(a.yearOfDeath) || null,
    artist_type: 'individual', raw_data: a,
  }))
  console.log(`\nImporting ${aRows.length} artists…`)
  const artistCount = await upsertBatches('collection_artists', aRows, 'source_id,source_artist_id')

  const oRows = artworks.filter(a => a.id).map(a => ({
    source_id: 'tate', source_object_id: a.id,
    accession_num: a.accession_number || null,
    title: a.title || 'Untitled',
    display_date: a.dateText || null,
    begin_year: parseInt(a.year) || null,
    medium: a.medium || null, dimensions: a.dimensions || null,
    classification: 'Art', attribution: a.artist || null,
    credit_line: a.creditLine || null, thumb_url: a.thumbnailUrl || null,
    raw_data: a,
  }))
  console.log(`\nImporting ${oRows.length} artworks…`)
  const objectCount = await upsertBatches('collection_objects', oRows, 'source_id,source_object_id')

  console.log('\nBuilding junctions…')
  const valid = artworks.filter(a => a.id && a.artistId)
  const artistMap = new Map()
  const objectMap = new Map()
  for (let i = 0; i < valid.length; i += 500) {
    const chunk = valid.slice(i, i + 500)
    const aIds = [...new Set(chunk.map(a => a.artistId))]
    const oIds = [...new Set(chunk.map(a => a.id))]
    const [{ data: ad }, { data: od }] = await Promise.all([
      supabase.from('collection_artists').select('id,source_artist_id').eq('source_id','tate').in('source_artist_id', aIds),
      supabase.from('collection_objects').select('id,source_object_id').eq('source_id','tate').in('source_object_id', oIds),
    ])
    ;(ad||[]).forEach(a => artistMap.set(a.source_artist_id, a.id))
    ;(od||[]).forEach(o => objectMap.set(o.source_object_id, o.id))
    await sleep(100)
  }
  const junctions = valid.map(a => ({ object_id: objectMap.get(a.id), artist_id: artistMap.get(a.artistId), role: a.artistRole || 'artist' })).filter(j => j.object_id && j.artist_id)
  console.log(`${junctions.length} junctions`)
  await upsertBatches('collection_object_artists', junctions, 'object_id,artist_id')

  await supabase.from('collection_sources').update({ artist_count: artistCount, object_count: objectCount, last_imported_at: new Date().toISOString() }).eq('id', 'tate')
  console.log(`\nComplete: ${artistCount} artists, ${objectCount} objects`)
}

main().catch(err => { console.error('Fatal:', err); process.exit(1) })
