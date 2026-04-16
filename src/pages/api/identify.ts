import type { APIRoute } from 'astro'
import { env } from 'cloudflare:workers'
import Anthropic from '@anthropic-ai/sdk'
import { createClient } from '@supabase/supabase-js'

function arrayBufferToBase64(buffer: ArrayBuffer): string {
  const bytes = new Uint8Array(buffer)
  let binary = ''
  const chunkSize = 8192
  for (let i = 0; i < bytes.length; i += chunkSize) {
    const chunk = bytes.subarray(i, i + chunkSize)
    binary += String.fromCharCode(...chunk)
  }
  return btoa(binary)
}

export const POST: APIRoute = async ({ request }) => {
  try {
    const { key, user_id } = await request.json()

    if (!key) {
      return new Response(JSON.stringify({ error: 'No image key provided' }), {
        status: 400,
        headers: { 'Content-Type': 'application/json' }
      })
    }

    const bucket = (env as any).gauk_antiques_images
    const object = await bucket.get(key)

    if (!object) {
      return new Response(JSON.stringify({ error: 'Image not found in R2' }), {
        status: 404,
        headers: { 'Content-Type': 'application/json' }
      })
    }

    const arrayBuffer = await object.arrayBuffer()
    const base64 = arrayBufferToBase64(arrayBuffer)
    const contentType = object.httpMetadata?.contentType || 'image/jpeg'

    const client = new Anthropic({ apiKey: (env as any).ANTHROPIC_API_KEY })

    const response = await client.messages.create({
      model: 'claude-opus-4-5',
      max_tokens: 1024,
      system: `You are an expert antiques appraiser with decades of experience across all categories.
Analyse the provided image and return ONLY a valid JSON object with no additional text.
The JSON must follow this structure exactly:
{
  "category": "string (e.g. Pottery, Jewellery, Furniture, Silverware, Art, Books, Clocks, Glass, Textiles, Other)",
  "subcategory": "string (more specific type)",
  "maker": "string or null",
  "period": "string (e.g. Victorian, Art Deco, 18th Century)",
  "circa": "string or null (e.g. c.1890)",
  "country_of_origin": "string or null",
  "condition": "Excellent | Good | Fair | Poor",
  "condition_notes": "string describing any damage or wear",
  "description": "string (2-3 sentences describing the item)",
  "value_range_low": number,
  "value_range_high": number,
  "confidence": "High | Medium | Low",
  "confidence_notes": "string explaining confidence level",
  "category_specific": {}
}`,
      messages: [
        {
          role: 'user',
          content: [
            {
              type: 'image',
              source: { type: 'base64', media_type: contentType as any, data: base64 }
            },
            { type: 'text', text: 'Please identify and value this antique. Return only the JSON object.' }
          ]
        }
      ]
    })

    const raw = response.content[0].type === 'text' ? response.content[0].text : ''
    const clean = raw.replace(/```json|```/g, '').trim()
    const result = JSON.parse(clean)

    const supabase = createClient(
      (env as any).PUBLIC_SUPABASE_URL || import.meta.env.PUBLIC_SUPABASE_URL,
      (env as any).SUPABASE_SERVICE_ROLE_KEY || import.meta.env.SUPABASE_SERVICE_ROLE_KEY
    )

    const { data: record, error: dbError } = await supabase
      .from('identifications')
      .insert({
        site_id: 'add6d12c-ecd8-4517-b2e5-0f4977603744',
        user_id: user_id || null,
        image_key: key,
        result_json: result,
        category: result.category,
        maker: result.maker,
        period: result.period,
        value_range_low: result.value_range_low,
        value_range_high: result.value_range_high,
        confidence: result.confidence
      })
      .select()
      .single()

    if (dbError) {
      console.error('DB write error:', dbError)
    }

    return new Response(JSON.stringify({ result, id: record?.id || null }), {
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
