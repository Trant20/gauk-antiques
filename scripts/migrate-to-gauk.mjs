/**
 * migrate-to-gauk.mjs
 * Migrates collection_artists and collection_objects into gauk_artists and gauk_objects.
 * 
 * Artist deduplication strategy:
 * 1. Same wikidata_id across sources = one gauk_artist
 * 2. Same name (case-insensitive) with no wikidata_id = one gauk_artist
 * 3. Everything else = separate gauk_artists
 *
 * Objects: no deduplication — each source record = one gauk_object
 *
 * Usage: node scripts/migrate-to-gauk.mjs
 */

import { createClient } from '@supabase/supabase-js'
import { readFileSync } from 'fs'

import 'dotenv/config'

const SUPABASE_URL = process.env.PUBLIC_SUPABASE_URL
const SUPABASE_SERVICE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY

if (!SUPABASE_URL || !SUPABASE_SERVICE_KEY) {
  throw new Error('Missing SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY in environment')
}

const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_KEY)
const sleep = ms => new Promise(r => setTimeout(r, ms))
const BATCH = 200

/** Generate a URL-safe slug from a name */
function toSlug(name) {
  return name.toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-|-$/g, '')
}

/** Make a slug unique by appending a suffix */
function uniqueSlug(base, existing) {
  if (!existing.has(base)) return base
  let i = 2
  while (existing.has(`${base}-${i}`)) i++
  return `${base}-${i}`
}

/** Compute data quality score 0-100 */
function dataQuality(a) {
  let score = 0
  if (a.preferred_name) score += 10
  if (a.birth_year || a.begin_year) score += 10
  if (a.wikidata_id) score += 20
  if (a.portrait_url) score += 20
  if (a.signature_url) score += 10
  if (a.nationality) score += 10
  if (a.description) score += 10
  if (a.gauk_categories?.length) score += 10
  return Math.min(score, 100)
}

/** Map classification string to GAUK category slugs */
const CLASSIFICATION_RULES = [
  { terms: ['painting'], sources: ['c'], cats: ['art', 'oil-paintings'] },
  { terms: ['oil', 'acrylic'], sources: ['m'], cats: ['art', 'oil-paintings'] },
  { terms: ['watercolour', 'watercolor'], sources: ['c', 'm'], cats: ['art', 'watercolours'] },
  { terms: ['drawing', 'graphic'], sources: ['c'], cats: ['art', 'drawings'] },
  { terms: ['print', 'etching', 'lithograph', 'engraving'], sources: ['c', 'm'], cats: ['art', 'prints'] },
  { terms: ['sculpture', 'three-dimensional'], sources: ['c'], cats: ['art', 'sculpture'] },
  { terms: ['photograph'], sources: ['c'], cats: ['art', 'photography'] },
  { terms: ['ceramic', 'pottery', 'porcelain', 'earthenware', 'stoneware'], sources: ['c'], cats: ['ceramics'] },
  { terms: ['porcelain'], sources: ['m'], cats: ['ceramics', 'porcelain'] },
  { terms: ['earthenware'], sources: ['m'], cats: ['ceramics', 'earthenware'] },
  { terms: ['stoneware'], sources: ['m'], cats: ['ceramics', 'stoneware'] },
  { terms: ['glass'], sources: ['c'], cats: ['glass'] },
  { terms: ['silver'], sources: ['c', 'm'], cats: ['silver'] },
  { terms: ['jewel', 'jewelry'], sources: ['c'], cats: ['jewellery'] },
  { terms: ['furniture'], sources: ['c'], cats: ['furniture'] },
  { terms: ['textile', 'fabric', 'wool', 'silk'], sources: ['c', 'm'], cats: ['textiles'] },
]

function classificationToCategories(classification, medium) {
  const c = (classification || '').toLowerCase()
  const m = (medium || '').toLowerCase()
  const cats = []

  for (const rule of CLASSIFICATION_RULES) {
    const matched = rule.terms.some(t =>
      (rule.sources.includes('c') && c.includes(t)) ||
      (rule.sources.includes('m') && m.includes(t))
    )
    if (matched) cats.push(...rule.cats)
  }

  if (cats.length === 0 && c.includes('decorative')) cats.push('ceramics')

  return [...new Set(cats)]
}

async function fetchAllArtists() {
  console.log('Fetching all collection_artists…')
  const all = []
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
    process.stdout.write(`\r  Fetched ${all.length} artists…`)
    await sleep(200)
  }
  console.log(`\n  Total: ${all.length}`)
  return all
}

async function fetchAllObjects() {
  console.log('Fetching all collection_objects…')
  const all = []
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
    process.stdout.write(`\r  Fetched ${all.length} objects…`)
    await sleep(200)
  }
  console.log(`\n  Total: ${all.length}`)
  return all
}


/** Build a merged artist record from a wikidata group */
function buildWikidataArtist(wikidataId, group, usedSlugs) {
  const primary = group.find(a => a.portrait_url) || group[0]
  const externalIds = {}
  group.forEach(a => { externalIds[a.source_id] = a.source_artist_id })
  if (wikidataId) externalIds.wikidata = wikidataId
  const slug = uniqueSlug(primary.slug || toSlug(primary.preferred_name), usedSlugs)
  usedSlugs.add(slug)
  return {
    preferred_name: primary.preferred_name,
    slug,
    birth_year: primary.begin_year || null,
    death_year: primary.end_year || null,
    nationality: primary.nationality || null,
    portrait_url: primary.portrait_url || null,
    signature_url: primary.signature_url || null,
    external_ids: externalIds,
    sources: [...new Set(group.map(a => a.source_id))],
    data_quality: dataQuality(primary),
    verified: false,
    _collection_ids: group.map(a => a.id),
  }
}

/** Build a merged artist record from a name group */
function buildNamedArtist(group, usedSlugs) {
  const primary = group.find(a => a.portrait_url) || group[0]
  const externalIds = {}
  group.forEach(a => { externalIds[a.source_id] = a.source_artist_id })
  const slug = uniqueSlug(primary.slug || toSlug(primary.preferred_name), usedSlugs)
  usedSlugs.add(slug)
  return {
    preferred_name: primary.preferred_name,
    slug,
    birth_year: primary.begin_year || null,
    death_year: primary.end_year || null,
    nationality: primary.nationality || null,
    portrait_url: primary.portrait_url || null,
    signature_url: primary.signature_url || null,
    external_ids: externalIds,
    sources: [...new Set(group.map(a => a.source_id))],
    data_quality: dataQuality(primary),
    verified: false,
    _collection_ids: group.map(a => a.id),
  }
}

/** Build a record for an anonymous or unmatched artist */
function buildAnonymousArtist(a, usedSlugs) {
  const slug = uniqueSlug(`anonymous-${a.source_id}-${a.source_artist_id}`, usedSlugs)
  usedSlugs.add(slug)
  return {
    preferred_name: a.preferred_name || 'Unknown',
    slug,
    birth_year: a.begin_year || null,
    death_year: a.end_year || null,
    external_ids: { [a.source_id]: a.source_artist_id },
    sources: [a.source_id],
    data_quality: 0,
    verified: false,
    _collection_ids: [a.id],
  }
}

async function migrateArtists(artists) {
  console.log('\n── DEDUPLICATING ARTISTS ────────────────────────')

  // Group by wikidata_id first, then by normalised name
  const wikidataGroups = new Map() // wikidata_id → [artists]
  const nameGroups = new Map()     // normalised_name → [artists]
  const noMatch = []               // anonymous, no wikidata, no usable name

  for (const a of artists) {
    if (a.artist_type === 'anonymous' || !a.preferred_name || a.preferred_name === 'Unknown') {
      noMatch.push(a)
      continue
    }
    if (a.wikidata_id) {
      if (!wikidataGroups.has(a.wikidata_id)) wikidataGroups.set(a.wikidata_id, [])
      wikidataGroups.get(a.wikidata_id).push(a)
    } else {
      const key = a.preferred_name.toLowerCase().trim()
      if (!nameGroups.has(key)) nameGroups.set(key, [])
      nameGroups.get(key).push(a)
    }
  }

  console.log(`  Wikidata groups: ${wikidataGroups.size}`)
  console.log(`  Name groups: ${nameGroups.size}`)
  console.log(`  No match: ${noMatch.length}`)

  // Build merged artist records
  const gaukArtists = []
  const usedSlugs = new Set()

  for (const [wikidataId, group] of wikidataGroups) {
    gaukArtists.push(buildWikidataArtist(wikidataId, group, usedSlugs))
  }

  for (const [, group] of nameGroups) {
    gaukArtists.push(buildNamedArtist(group, usedSlugs))
  }

  for (const a of noMatch) {
    gaukArtists.push(buildAnonymousArtist(a, usedSlugs))
  }

  console.log(`\n  Total gauk_artists to create: ${gaukArtists.length}`)
  console.log(`  Deduplication saved: ${artists.length - gaukArtists.length} records`)

  // Insert in batches
  console.log('\n── INSERTING GAUK ARTISTS ───────────────────────')
  let inserted = 0
  let errors = 0
  const collectionIdToGaukId = new Map() // collection_artists.id → gauk_artists.gauk_id

  for (let i = 0; i < gaukArtists.length; i += BATCH) {
    const batch = gaukArtists.slice(i, i + BATCH)
    const rows = batch.map(a => {
      const { _collection_ids, ...row } = a
      return row
    })

    const { data, error } = await supabase
      .from('gauk_artists')
      .upsert(rows, { onConflict: 'slug', ignoreDuplicates: false })
      .select('gauk_id,slug')

    if (error) {
      console.error(`\n  Batch error at ${i}: ${error.message}`)
      errors++
    } else {
      // Build collection_id → gauk_id map for back-fill
      data.forEach((ga, idx) => {
        batch[idx]._collection_ids.forEach(cid => {
          collectionIdToGaukId.set(cid, ga.gauk_id)
        })
      })
      inserted += rows.length
    }
    process.stdout.write(`\r  ${i + BATCH}/${gaukArtists.length}…`)
    await sleep(300)
  }
  console.log(`\n  Done — ${inserted} inserted, ${errors} errors`)

  // Back-fill gauk_id onto collection_artists
  console.log('\n── BACK-FILLING COLLECTION_ARTISTS ──────────────')
  let backfilled = 0
  const entries = [...collectionIdToGaukId.entries()]
  for (let i = 0; i < entries.length; i += BATCH) {
    const chunk = entries.slice(i, i + BATCH)
    await Promise.all(chunk.map(([cid, gaukId]) =>
      supabase.from('collection_artists').update({ gauk_id: gaukId }).eq('id', cid)
    ))
    backfilled += chunk.length
    process.stdout.write(`\r  ${backfilled}/${entries.length}…`)
    await sleep(100)
  }
  console.log(`\n  Done — ${backfilled} back-filled`)

  return inserted
}

async function migrateObjects(objects) {
  console.log('\n── INSERTING GAUK OBJECTS ───────────────────────')
  console.log(`  ${objects.length} objects — no deduplication`)

  const usedSlugs = new Set()
  let inserted = 0
  let errors = 0
  const collectionIdToGaukId = new Map()

  for (let i = 0; i < objects.length; i += BATCH) {
    const batch = objects.slice(i, i + BATCH)
    const rows = batch.map(o => {
      const baseSlug = o.accession_num
        ? `${o.source_id}-${o.accession_num.replace(/[^a-z0-9]+/gi, '-').toLowerCase()}`
        : `${o.source_id}-${o.source_object_id}`
      const slug = uniqueSlug(baseSlug, usedSlugs)
      usedSlugs.add(slug)

      const categories = classificationToCategories(o.classification, o.medium)
      const externalIds = { [o.source_id]: o.source_object_id }
      if (o.wikidata_id) externalIds.wikidata = o.wikidata_id

      return {
        title: o.title || 'Untitled',
        slug,
        display_date: o.display_date || null,
        date_from: o.begin_year || null,
        date_to: o.end_year || null,
        medium: o.medium || null,
        dimensions: o.dimensions || null,
        classification: o.classification || null,
        image_url: o.image_url || null,
        thumb_url: o.thumb_url || null,
        provenance: o.provenance_text || null,
        credit_line: o.credit_line || null,
        on_view: o.on_view || false,
        external_ids: externalIds,
        gauk_categories: categories.length ? categories : null,
        sources: [o.source_id],
        data_quality: [o.title, o.medium, o.thumb_url, o.wikidata_id].filter(Boolean).length * 20,
        verified: false,
        _collection_id: o.id,
      }
    })

    const insertRows = rows.map(({ _collection_id, ...r }) => r)

    const { data, error } = await supabase
      .from('gauk_objects')
      .upsert(insertRows, { onConflict: 'slug', ignoreDuplicates: false })
      .select('gauk_id,slug')

    if (error) {
      console.error(`\n  Batch error at ${i}: ${error.message}`)
      errors++
    } else {
      data.forEach((go, idx) => {
        collectionIdToGaukId.set(rows[idx]._collection_id, go.gauk_id)
      })
      inserted += insertRows.length
    }
    process.stdout.write(`\r  ${i + BATCH}/${objects.length}…`)
    await sleep(300)
  }
  console.log(`\n  Done — ${inserted} inserted, ${errors} errors`)

  // Back-fill gauk_id onto collection_objects
  console.log('\n── BACK-FILLING COLLECTION_OBJECTS ──────────────')
  let backfilled = 0
  const entries = [...collectionIdToGaukId.entries()]
  for (let i = 0; i < entries.length; i += BATCH) {
    const chunk = entries.slice(i, i + BATCH)
    await Promise.all(chunk.map(([cid, gaukId]) =>
      supabase.from('collection_objects').update({ gauk_id: gaukId }).eq('id', cid)
    ))
    backfilled += chunk.length
    process.stdout.write(`\r  ${backfilled}/${entries.length}…`)
    await sleep(100)
  }
  console.log(`\n  Done — ${backfilled} back-filled`)

  return inserted
}

async function main() {
  console.log('GAUK Knowledge Spine — Full Migration')
  console.log('collection_artists + collection_objects → gauk_artists + gauk_objects\n')

  const artists = await fetchAllArtists()
  const objects = await fetchAllObjects()

  const artistCount = await migrateArtists(artists)
  const objectCount = await migrateObjects(objects)

  console.log('\n── COMPLETE ─────────────────────────────────────')
  console.log(`gauk_artists: ${artistCount}`)
  console.log(`gauk_objects: ${objectCount}`)
  console.log(`Deduplication: ${artists.length} → ${artistCount} artists`)
}

main().catch(err => { console.error('Fatal:', err); process.exit(1) })
