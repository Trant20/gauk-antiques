import type { APIRoute } from 'astro'
import { env } from 'cloudflare:workers'
import Anthropic from '@anthropic-ai/sdk'

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
    const { key } = await request.json()

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

    const client = new Anthropic({
      apiKey: (env as any).ANTHROPIC_API_KEY
    })

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
  "value_range_low": number (GBP),
  "value_range_high": number (GBP),
  "confidence": "High | Medium | Low",
  "confidence_notes": "string explaining confidence level",
  "category_specific": {
    "note": "Include fields relevant to the category. For Pottery: maker_mark, pattern, firing_type. For Jewellery: metal, stones, hallmarks, weight_estimate. For Furniture: wood_type, style, provenance. For Silverware: hallmarks, weight_estimate, assay_office. For Art: medium, subject, signed. Omit irrelevant fields."
  }
}`,
      messages: [
        {
          role: 'user',
          content: [
            {
              type: 'image',
              source: {
                type: 'base64',
                media_type: contentType as any,
                data: base64
              }
            },
            {
              type: 'text',
              text: 'Please identify and value this antique. Return only the JSON object.'
            }
          ]
        }
      ]
    })

    const raw = response.content[0].type === 'text' ? response.content[0].text : ''
    const clean = raw.replace(/```json|```/g, '').trim()
    const result = JSON.parse(clean)

    return new Response(JSON.stringify({ result }), {
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
