/**
 * migrate-institutions.mjs
 * Moves corporate entities from gauk_artists into gauk_institutions.
 * Updates collection_artists.gauk_id references to point to new GAUK-INS- IDs.
 * Safe to re-run — upsert on slug.
 */

import { createClient } from '@supabase/supabase-js'

import 'dotenv/config'

const SUPABASE_URL = process.env.PUBLIC_SUPABASE_URL
const SUPABASE_SERVICE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY

if (!SUPABASE_URL || !SUPABASE_SERVICE_KEY) {
  throw new Error('Missing SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY in environment')
}

const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_KEY)
const sleep = ms => new Promise(r => setTimeout(r, ms))
const BATCH = 200

function toSlug(name) {
  return name.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '')
}

function uniqueSlug(base, existing) {
  if (!existing.has(base)) return base
  let i = 2
  while (existing.has(`${base}-${i}`)) i++
  return `${base}-${i}`
}

function guessInstitutionType(name) {
  const n = name.toLowerCase()
  if (n.includes('auction') || n.includes('sotheby') || n.includes('christie') || n.includes('bonham') || n.includes('phillips')) return 'auction_house'
  if (n.includes('museum') || n.includes('gallery') && n.includes('national')) return 'museum'
  if (n.includes('gallery') || n.includes('galerie') || n.includes('galleria')) return 'gallery'
  if (n.includes('foundation') || n.includes('trust') || n.includes('society')) return 'foundation'
  if (n.includes('estate') || n.includes('collection of')) return 'estate'
  if (n.includes('press') || n.includes('publisher')) return 'publisher'
  if (n.includes('church') || n.includes('cathedral') || n.includes('abbey')) return 'institution'
  return 'dealer'
}

async function main() {
  console.log('Fetching corporate entities from gauk_artists…')

  // Fetch all corporate records via collection_artists join
  // Paginate to get all corporate records
  const corpCollectionArtists = []
  let lastCaId = '00000000-0000-0000-0000-000000000000'
  while (true) {
    const { data, error: caErr } = await supabase
      .from('collection_artists')
      .select('id,gauk_id,preferred_name,source_artist_id,source_id,raw_data')
      .eq('artist_type', 'corporate')
      .not('gauk_id', 'is', null)
      .gt('id', lastCaId)
      .order('id', { ascending: true })
      .limit(500)
    if (caErr) throw new Error(caErr.message)
    corpCollectionArtists.push(...data)
    lastCaId = data[data.length - 1].id
    if (data.length < 500) break
    await sleep(200)
  }
  const caErr = null

  if (caErr) throw new Error(caErr.message)
  console.log(`Found ${corpCollectionArtists.length} corporate collection_artists`)

  // Get corresponding gauk_artists records
  const gaukIds = [...new Set(corpCollectionArtists.map(a => a.gauk_id))]
  console.log(`Unique gauk_ids: ${gaukIds.length}`)

  const gaukArtists = []
  for (let i = 0; i < gaukIds.length; i += 500) {
    const { data } = await supabase
      .from('gauk_artists')
      .select('gauk_id,preferred_name,external_ids,sources,data_quality')
      .in('gauk_id', gaukIds.slice(i, i + 500))
    gaukArtists.push(...(data || []))
    await sleep(100)
  }
  console.log(`Fetched ${gaukArtists.length} gauk_artist records`)

  // Build institution rows
  const usedSlugs = new Set()

  const institutionRows = gaukArtists.map(ga => {
    const slug = uniqueSlug(toSlug(ga.preferred_name || 'unknown'), usedSlugs)
    usedSlugs.add(slug)
    return {
      name: ga.preferred_name,
      slug,
      institution_type: guessInstitutionType(ga.preferred_name || ''),
      external_ids: ga.external_ids || {},
      sources: ga.sources || [],
      data_quality: ga.data_quality || 0,
      verified: false,
    }
  })

  console.log(`\nInserting ${institutionRows.length} institutions…`)
  let inserted = 0
  let errors = 0
  const oldGaukIdToNewGaukId = new Map()

  for (let i = 0; i < institutionRows.length; i += BATCH) {
    const batch = institutionRows.slice(i, i + BATCH)
    const oldIds = gaukArtists.slice(i, i + BATCH).map(ga => ga.gauk_id)

    const { data, error } = await supabase
      .from('gauk_institutions')
      .upsert(batch, { onConflict: 'slug', ignoreDuplicates: false })
      .select('gauk_id,slug')

    if (error) {
      console.error(`\n  Batch error: ${error.message}`)
      errors++
    } else {
      data.forEach((inst, idx) => {
        oldGaukIdToNewGaukId.set(oldIds[idx], inst.gauk_id)
      })
      inserted += batch.length
    }
    process.stdout.write(`\r  ${i + BATCH}/${institutionRows.length}…`)
    await sleep(300)
  }
  console.log(`\n  Done — ${inserted} inserted, ${errors} errors`)

  // Update collection_artists.gauk_id to point to new GAUK-INS- IDs
  console.log('\nUpdating collection_artists gauk_id references…')
  let updated = 0
  const entries = [...oldGaukIdToNewGaukId.entries()]

  for (let i = 0; i < entries.length; i += BATCH) {
    const chunk = entries.slice(i, i + BATCH)
    await Promise.all(chunk.map(([oldId, newId]) =>
      supabase.from('collection_artists').update({ gauk_id: newId }).eq('gauk_id', oldId)
    ))
    updated += chunk.length
    process.stdout.write(`\r  ${updated}/${entries.length}…`)
    await sleep(100)
  }
  console.log(`\n  Done — ${updated} references updated`)

  // Delete from gauk_artists
  console.log('\nRemoving corporate records from gauk_artists…')
  const oldIds = [...oldGaukIdToNewGaukId.keys()]
  let deleted = 0

  for (let i = 0; i < oldIds.length; i += BATCH) {
    const { error } = await supabase
      .from('gauk_artists')
      .delete()
      .in('gauk_id', oldIds.slice(i, i + BATCH))
    if (!error) deleted += Math.min(BATCH, oldIds.length - i)
    await sleep(100)
  }
  console.log(`  Done — ${deleted} removed from gauk_artists`)

  console.log('\n── COMPLETE ─────────────────────────────────────')
  console.log(`Institutions created: ${inserted}`)
  console.log(`gauk_artists remaining: ${27491 - deleted}`)
}

try {
  await main()
} catch (err) {
  console.error('Fatal:', err)
  process.exit(1)
}
