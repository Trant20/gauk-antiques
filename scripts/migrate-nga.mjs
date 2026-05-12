/**
 * migrate-nga.mjs
 * Migrates nga_objects and nga_constituents into unified collection_ tables.
 * Safe to re-run — uses upsert with unique(source_id, source_object_id).
 *
 * Usage: node scripts/migrate-nga.mjs
 */

import { createClient } from '@supabase/supabase-js'

import 'dotenv/config'

const SUPABASE_URL = process.env.PUBLIC_SUPABASE_URL
const SUPABASE_SERVICE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY

if (!SUPABASE_URL || !SUPABASE_SERVICE_KEY) {
  throw new Error('Missing SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY in environment')
}

const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_KEY)
const BATCH = 200
const sleep = ms => new Promise(r => setTimeout(r, ms))

async function migrateArtists() {
  console.log('\n── ARTISTS ──────────────────────────────────────')
  let offset = 0
  let total = 0
  let errors = 0

  while (true) {
    const { data, error } = await supabase
      .from('nga_constituents')
      .select('constituent_id,uuid,ulan_id,wikidata_id,preferred_name,forward_name,last_name,display_date,begin_year,end_year,nationality,constituent_type,portrait_url,signature_url,slug')
      .range(offset, offset + BATCH - 1)
      .order('constituent_id', { ascending: true })

    if (error) throw new Error(`Fetch error: ${error.message}`)
    if (!data.length) break

    const rows = data.map(a => ({
      source_id: 'nga',
      source_artist_id: String(a.constituent_id),
      wikidata_id: a.wikidata_id || null,
      slug: a.slug || null,
      preferred_name: a.preferred_name || 'Unknown',
      forward_name: a.forward_name || null,
      last_name: a.last_name || null,
      display_date: a.display_date || null,
      begin_year: a.begin_year || null,
      end_year: a.end_year || null,
      nationality: a.nationality || null,
      artist_type: a.constituent_type || 'individual',
      ulan_id: a.ulan_id || null,
      portrait_url: a.portrait_url || null,
      signature_url: a.signature_url || null,
      raw_data: a,
    }))

    const { error: upsertErr } = await supabase
      .from('collection_artists')
      .upsert(rows, { onConflict: 'source_id,source_artist_id' })

    if (upsertErr) {
      console.error(`  Batch error at offset ${offset}: ${upsertErr.message}`)
      errors++
    } else {
      total += rows.length
      process.stdout.write(`\r  Migrated ${total} artists…`)
    }

    offset += BATCH
    if (data.length < BATCH) break
    await sleep(300)
  }

  console.log(`\n  Done — ${total} artists, ${errors} errors`)
  return total
}

async function migrateObjects() {
  console.log('\n── OBJECTS ──────────────────────────────────────')
  let offset = 0
  let total = 0
  let errors = 0

  while (true) {
    const { data, error } = await supabase
      .from('nga_objects')
      .select('object_id,uuid,accession_num,title,display_date,begin_year,end_year,medium,dimensions,classification,subclassification,department_abbr,attribution,credit_line,provenance_text,nga_image_url,nga_thumb_url,on_view,wikidata_id')
      .range(offset, offset + BATCH - 1)
      .order('object_id', { ascending: true })

    if (error) throw new Error(`Fetch error: ${error.message}`)
    if (!data.length) break

    const rows = data.map(o => ({
      source_id: 'nga',
      source_object_id: String(o.object_id),
      wikidata_id: o.wikidata_id || null,
      accession_num: o.accession_num || null,
      title: o.title || 'Untitled',
      display_date: o.display_date || null,
      begin_year: o.begin_year || null,
      end_year: o.end_year || null,
      medium: o.medium || null,
      dimensions: o.dimensions || null,
      classification: o.classification || null,
      subclassification: o.subclassification || null,
      department: o.department_abbr || null,
      attribution: o.attribution || null,
      credit_line: o.credit_line || null,
      provenance_text: o.provenance_text || null,
      image_url: o.nga_image_url ? o.nga_image_url + '/full/!1200,1200/0/default.jpg' : null,
      thumb_url: o.nga_thumb_url || null,
      on_view: o.on_view || false,
      raw_data: o,
    }))

    const { error: upsertErr } = await supabase
      .from('collection_objects')
      .upsert(rows, { onConflict: 'source_id,source_object_id', ignoreDuplicates: true })

    if (upsertErr) {
      console.error(`  Batch error at offset ${offset}: ${upsertErr.message}`)
      errors++
    } else {
      total += rows.length
      process.stdout.write(`\r  Migrated ${total} objects…`)
    }

    offset += BATCH
    if (data.length < BATCH) break
    await sleep(100)
  }

  console.log(`\n  Done — ${total} objects, ${errors} errors`)
  return total
}

async function migrateJunctions() {
  console.log('\n── OBJECT-ARTIST LINKS ──────────────────────────')
  let offset = 0
  let total = 0
  let errors = 0

  while (true) {
    const { data, error } = await supabase
      .from('nga_object_constituents')
      .select('object_id,constituent_id,role')
      .range(offset, offset + BATCH - 1)
      .order('object_id', { ascending: true })

    if (error) throw new Error(`Fetch error: ${error.message}`)
    if (!data.length) break

    // Resolve UUIDs for each pair
    const objectIds = [...new Set(data.map(r => String(r.object_id)))]
    const artistIds = [...new Set(data.map(r => String(r.constituent_id)))]

    const [{ data: objects }, { data: artists }] = await Promise.all([
      supabase.from('collection_objects').select('id,source_object_id').eq('source_id', 'nga').in('source_object_id', objectIds),
      supabase.from('collection_artists').select('id,source_artist_id').eq('source_id', 'nga').in('source_artist_id', artistIds),
    ])

    const objectMap = new Map((objects || []).map(o => [o.source_object_id, o.id]))
    const artistMap = new Map((artists || []).map(a => [a.source_artist_id, a.id]))

    const rows = data
      .map(r => ({
        object_id: objectMap.get(String(r.object_id)),
        artist_id: artistMap.get(String(r.constituent_id)),
        role: r.role || 'artist',
      }))
      .filter(r => r.object_id && r.artist_id)

    if (rows.length) {
      const { error: upsertErr } = await supabase
        .from('collection_object_artists')
        .upsert(rows, { onConflict: 'object_id,artist_id' })

      if (upsertErr) {
        console.error(`  Batch error at offset ${offset}: ${upsertErr.message}`)
        errors++
      } else {
        total += rows.length
        process.stdout.write(`\r  Migrated ${total} links…`)
      }
    }

    offset += BATCH
    if (data.length < BATCH) break
    await sleep(100)
  }

  console.log(`\n  Done — ${total} links, ${errors} errors`)
  return total
}

async function updateSourceCounts(artistCount, objectCount) {
  await supabase
    .from('collection_sources')
    .update({
      artist_count: artistCount,
      object_count: objectCount,
      last_imported_at: new Date().toISOString(),
    })
    .eq('id', 'nga')
  console.log('\n── SOURCE COUNTS UPDATED ────────────────────────')
}

async function main() {
  console.log('NGA → collection_ migration')
  console.log('Safe to re-run — upsert on conflict\n')

  const artistCount = await migrateArtists()
  const objectCount = await migrateObjects()
  await migrateJunctions()
  await updateSourceCounts(artistCount, objectCount)

  console.log('\n── COMPLETE ─────────────────────────────────────')
  console.log(`Artists: ${artistCount}`)
  console.log(`Objects: ${objectCount}`)
}

main().catch(err => {
  console.error('Fatal:', err)
  process.exit(1)
})
