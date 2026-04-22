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
      model: 'claude-opus-4-5',
      max_tokens: 2048,
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
