import type { APIRoute } from 'astro'
import { env } from 'cloudflare:workers'
import Anthropic from '@anthropic-ai/sdk'

export const POST: APIRoute = async ({ request }) => {
  try {
    const { identification_id, result } = await request.json()

    if (!result) {
      return new Response(JSON.stringify({ error: 'No identification result provided' }), {
        status: 400,
        headers: { 'Content-Type': 'application/json' }
      })
    }

    const client = new Anthropic({ apiKey: (env as any).ANTHROPIC_API_KEY })

    const response = await client.messages.create({
      model: 'claude-haiku-4-5-20251001',
      max_tokens: 4096,
      system: `You are a senior antiques specialist writing a professional valuation report. Based on the identification data provided, generate enrichment content for the report. Return ONLY valid JSON, no markdown.

Return this exact structure:
{
  "expert_notes": [
    "First paragraph — what makes this piece significant, its place in the maker's output or the broader decorative arts context. 2-3 sentences.",
    "Second paragraph — market context, collector demand, what drives value for this type of piece. 2-3 sentences.",
    "Third paragraph — what to look for, authentication points, how to care for or display this piece. 2-3 sentences."
  ],
  "maker_timeline": [
    { "year": "YYYY or YYYY-YYYY", "event": "brief description", "highlight": true or false }
  ],
  "your_options": [
    { "action": "action title", "detail": "specific detail with estimated figures", "recommended": true or false },
    { "action": "action title", "detail": "specific detail", "recommended": false },
    { "action": "action title", "detail": "specific detail", "recommended": false },
    { "action": "action title", "detail": "specific detail", "recommended": false }
  ],
  "comparable_sales": [
    { "title": "similar item description", "detail": "condition and year", "value": "£X,XXX" },
    { "title": "similar item description", "detail": "condition and year", "value": "£X,XXX" },
    { "title": "similar item description", "detail": "condition and year", "value": "£X,XXX" }
  ],
  "market_insight": "One paragraph on the current market for this category — trends, demand, outlook. 2-3 sentences.",
  "maker_detail": {
    "bio": "2-3 sentences on the maker or designer — who they were, their significance, their working period",
    "notable_works": "what they are best known for, key patterns or pieces, why collectors value their work"
  },
  "manufacturer_detail": {
    "history": "2-3 sentences on the manufacturing company — when founded, their reputation, key periods",
    "relationship_to_maker": "how the maker and manufacturer worked together if different people, or omit if same"
  },
  "maker_mark_explanation": "If a mark is visible or described: explain exactly what it means, the date range it was used, and what it tells us about authenticity and period. If no mark is present or visible: describe exactly what mark genuine examples should carry, where it appears on the piece, and what to look for.",
  "pattern_detail": "If a pattern name is known: its history, when introduced, design influences, variants, and why collectors seek it. If unknown: describe what the decorative style suggests about period and origin.",
  "glaze_detail": "Explain this glaze type — how it was achieved, what the technical process involved, what condition issues are typical, and what to look for in high quality examples.",
  "firing_detail": "Explain what this firing type means for the piece — how it affects appearance, durability, value and what to watch for when assessing condition.",
  "price_history": [
    { "year": 2010, "value": integer },
    { "year": 2012, "value": integer },
    { "year": 2014, "value": integer },
    { "year": 2016, "value": integer },
    { "year": 2018, "value": integer },
    { "year": 2020, "value": integer },
    { "year": 2022, "value": integer },
    { "year": 2024, "value": integer }
  ],
  "price_peak": { "year": integer, "value": integer },
  "price_context": "One sentence — what drove price movement for this maker or category over this period.",
  "desirability_index": [
    { "name": "comparable pattern, maker or style name", "score": integer 0-100, "this_piece": false },
    { "name": "comparable pattern, maker or style name", "score": integer 0-100, "this_piece": false },
    { "name": "name of this piece pattern or type", "score": integer 0-100, "this_piece": true },
    { "name": "comparable pattern, maker or style name", "score": integer 0-100, "this_piece": false },
    { "name": "comparable pattern, maker or style name", "score": integer 0-100, "this_piece": false }
  ],
  "desirability_context": "One sentence explaining what the index measures and why these comparisons matter.",
  "condition_score": integer 0-100 derived from the condition field,
  "desirability_score": integer 0-100 based on maker, period, category and rarity
}

For maker_timeline: include 5-8 key dates. Mark the estimated date of this piece as highlight: true.
For your_options: always include sell at auction, private sale, insure it, and hold. Mark the best option as recommended: true.
For comparable_sales: provide 3 realistic comparable items with plausible auction values based on the identification.
Be authoritative and specific. Use real knowledge about makers, periods and markets. Flag AI-generated estimates where appropriate.`,
      messages: [
        {
          role: 'user',
          content: `Generate enrichment content for this antique identification:\n\n${JSON.stringify(result, null, 2)}`
        }
      ]
    })

    const raw = response.content[0].type === 'text' ? response.content[0].text : ''
    const clean = raw.replace(/```json|```/g, '').trim()
    const enrichment = JSON.parse(clean)

    if (identification_id) {
      const supabase = await import('@supabase/supabase-js').then(m =>
        m.createClient(
          (env as any).PUBLIC_SUPABASE_URL,
          (env as any).SUPABASE_SERVICE_ROLE_KEY
        )
      )
      await supabase
        .from('identifications')
        .update({ enrichment_json: enrichment })
        .eq('id', identification_id)
    }

    return new Response(JSON.stringify({ enrichment }), {
      status: 200,
      headers: { 'Content-Type': 'application/json' }
    })

  } catch (err: any) {
    return new Response(JSON.stringify({ error: err.message }), {
      status: 500,
      headers: { 'Content-Type': 'application/json' }
    })
  }
}
