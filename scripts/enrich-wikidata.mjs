/**
 * enrich-wikidata.mjs
 * Fetches Wikidata facts for all nga_constituents with a wikidata_id.
 * Stores results in wikidata_entities and back-fills portrait_url / signature_url
 * on nga_constituents for zero-join display.
 *
 * Usage: node enrich-wikidata.mjs
 */

import { createClient } from '@supabase/supabase-js'

const SUPABASE_URL = 'https://deyqcxujxweiwmsiscsz.supabase.co'
const SUPABASE_SERVICE_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImRleXFjeHVqeHdlaXdtc2lzY3N6Iiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc3NjEwODM5MiwiZXhwIjoyMDkxNjg0MzkyfQ.bhc9AuOvH-uqAG8lrM1iXNE7j6OEUS4vTXNHDLn3cag'

const SPARQL_ENDPOINT = 'https://query.wikidata.org/sparql'
const BATCH_SIZE = 50
const DELAY_MS = 1200 // Wikidata rate limit — stay well under

const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_KEY)

/** Build SPARQL query for a batch of Q-IDs */
function buildSparql(qids) {
  const values = qids.map(q => `wd:${q}`).join(' ')
  return `
SELECT ?entity ?entityLabel ?entityDescription
  ?portrait ?signature
  ?birthDate ?deathDate
  ?birthPlaceLabel ?deathPlaceLabel
  ?movementLabel ?occupationLabel
  ?influencedByLabel ?notableWorkLabel
WHERE {
  VALUES ?entity { ${values} }

  OPTIONAL { ?entity wdt:P18  ?portrait. }
  OPTIONAL { ?entity wdt:P109 ?signature. }
  OPTIONAL { ?entity wdt:P569 ?birthDate. }
  OPTIONAL { ?entity wdt:P570 ?deathDate. }
  OPTIONAL { ?entity wdt:P19  ?birthPlace.  ?birthPlace rdfs:label ?birthPlaceLabel.  FILTER(LANG(?birthPlaceLabel)  = "en") }
  OPTIONAL { ?entity wdt:P20  ?deathPlace.  ?deathPlace rdfs:label ?deathPlaceLabel.  FILTER(LANG(?deathPlaceLabel)  = "en") }
  OPTIONAL { ?entity wdt:P135 ?movement.    ?movement   rdfs:label ?movementLabel.    FILTER(LANG(?movementLabel)    = "en") }
  OPTIONAL { ?entity wdt:P106 ?occupation.  ?occupation rdfs:label ?occupationLabel.  FILTER(LANG(?occupationLabel)  = "en") }
  OPTIONAL { ?entity wdt:P737 ?influencedBy.?influencedBy rdfs:label ?influencedByLabel. FILTER(LANG(?influencedByLabel) = "en") }
  OPTIONAL { ?entity wdt:P800 ?notableWork. ?notableWork rdfs:label ?notableWorkLabel. FILTER(LANG(?notableWorkLabel) = "en") }

  SERVICE wikibase:label { bd:serviceParam wikibase:language "en". }
}
`
}

/** Fetch SPARQL results from Wikidata */
async function querySparql(sparql) {
  const url = `${SPARQL_ENDPOINT}?query=${encodeURIComponent(sparql)}&format=json`
  const res = await fetch(url, {
    headers: {
      'Accept': 'application/sparql-results+json',
      'User-Agent': 'GAUKAntiques/1.0 (https://gaukantiques.com; contact@gaukmedia.com)',
    },
  })
  if (!res.ok) {
    const text = await res.text()
    throw new Error(`SPARQL error ${res.status}: ${text.slice(0, 200)}`)
  }
  return res.json()
}

/** Convert Wikimedia Commons image URL (from SPARQL) to direct file URL */
function toDirectImageUrl(wikimediaUrl) {
  if (!wikimediaUrl) return null
  // SPARQL returns e.g. http://commons.wikimedia.org/wiki/Special:FilePath/John_Singer_Sargent.jpg
  // That URL already resolves via redirect — use it directly
  return wikimediaUrl
}

/** Collapse SPARQL rows into one entity record per Q-ID */
function collapseResults(rows) {
  const map = new Map()

  for (const row of rows) {
    const qid = row.entity?.value?.split('/').pop()
    if (!qid) continue

    if (!map.has(qid)) {
      map.set(qid, {
        wikidata_id: qid,
        label: row.entityLabel?.value || null,
        description: row.entityDescription?.value || null,
        entity_type: 'artist',
        portrait_url: null,
        signature_url: null,
        birth_date: null,
        death_date: null,
        birth_place: null,
        death_place: null,
        movements: [],
        occupations: [],
        influenced_by_ids: [],
        notable_work_ids: [],
        properties: {},
        enriched_at: new Date().toISOString(),
      })
    }

    const e = map.get(qid)

    if (row.portrait?.value && !e.portrait_url) e.portrait_url = toDirectImageUrl(row.portrait.value)
    if (row.signature?.value && !e.signature_url) e.signature_url = toDirectImageUrl(row.signature.value)
    if (row.birthDate?.value && !e.birth_date) e.birth_date = row.birthDate.value.slice(0, 10)
    if (row.deathDate?.value && !e.death_date) e.death_date = row.deathDate.value.slice(0, 10)
    if (row.birthPlaceLabel?.value && !e.birth_place) e.birth_place = row.birthPlaceLabel.value
    if (row.deathPlaceLabel?.value && !e.death_place) e.death_place = row.deathPlaceLabel.value

    if (row.movementLabel?.value && !e.movements.includes(row.movementLabel.value))
      e.movements.push(row.movementLabel.value)

    if (row.occupationLabel?.value && !e.occupations.includes(row.occupationLabel.value))
      e.occupations.push(row.occupationLabel.value)

    if (row.influencedByLabel?.value && !e.influenced_by_ids.includes(row.influencedByLabel.value))
      e.influenced_by_ids.push(row.influencedByLabel.value)

    if (row.notableWorkLabel?.value && !e.notable_work_ids.includes(row.notableWorkLabel.value))
      e.notable_work_ids.push(row.notableWorkLabel.value)
  }

  return [...map.values()]
}

/** Upsert a batch into wikidata_entities and back-fill nga_constituents */
async function upsertBatch(entities) {
  const { error } = await supabase
    .from('wikidata_entities')
    .upsert(entities, { onConflict: 'wikidata_id' })

  if (error) throw new Error(`Supabase upsert error: ${error.message}`)

  // Back-fill portrait_url and signature_url on nga_constituents
  for (const e of entities) {
    if (!e.portrait_url && !e.signature_url) continue
    const update = {}
    if (e.portrait_url) update.portrait_url = e.portrait_url
    if (e.signature_url) update.signature_url = e.signature_url
    const { error: upErr } = await supabase
      .from('nga_constituents')
      .update(update)
      .eq('wikidata_id', e.wikidata_id)
    if (upErr) console.error(`  Back-fill failed for ${e.wikidata_id}: ${upErr.message}`)
  }
}

/** Sleep helper */
const sleep = ms => new Promise(resolve => setTimeout(resolve, ms))

/** Main */
async function main() {
  console.log('Fetching nga_constituents with wikidata_id…')

  const { data: constituents, error } = await supabase
    .from('nga_constituents')
    .select('constituent_id, wikidata_id, preferred_name')
    .not('wikidata_id', 'is', null)
    .order('constituent_id', { ascending: true })

  if (error) throw new Error(`Supabase fetch error: ${error.message}`)

  console.log(`Found ${constituents.length} constituents with Wikidata IDs`)

  const batches = []
  for (let i = 0; i < constituents.length; i += BATCH_SIZE) {
    batches.push(constituents.slice(i, i + BATCH_SIZE))
  }

  console.log(`Processing ${batches.length} batches of up to ${BATCH_SIZE}…\n`)

  let totalEnriched = 0
  let totalPortraits = 0
  let totalSignatures = 0

  for (let b = 0; b < batches.length; b++) {
    const batch = batches[b]
    const qids = batch.map(c => c.wikidata_id)
    process.stdout.write(`Batch ${b + 1}/${batches.length} (${qids.length} entities)… `)

    try {
      const sparql = buildSparql(qids)
      const result = await querySparql(sparql)
      const rows = result.results?.bindings || []
      const entities = collapseResults(rows)

      await upsertBatch(entities)

      const portraits = entities.filter(e => e.portrait_url).length
      const signatures = entities.filter(e => e.signature_url).length
      totalEnriched += entities.length
      totalPortraits += portraits
      totalSignatures += signatures

      console.log(`✓ ${entities.length} enriched, ${portraits} portraits, ${signatures} signatures`)
    } catch (err) {
      console.error(`✗ ${err.message}`)
      // Continue — don't abort entire run on one bad batch
    }

    if (b < batches.length - 1) await sleep(DELAY_MS)
  }

  console.log(`\nDone.`)
  console.log(`Total enriched: ${totalEnriched}`)
  console.log(`Total portraits: ${totalPortraits}`)
  console.log(`Total signatures: ${totalSignatures}`)
}

main().catch(err => {
  console.error('Fatal:', err)
  process.exit(1)
})
