import type { APIRoute } from 'astro'
import { env } from 'cloudflare:workers'
import Anthropic from '@anthropic-ai/sdk'

function arrayBufferToBase64(buffer: ArrayBuffer): string {
  const bytes = new Uint8Array(buffer)
  let binary = ''
  const chunkSize = 8192
  for (let i = 0; i < bytes.length; i += chunkSize) {
    const chunk = bytes.subarray(i, i + chunkSize)
    binary += String.fromCodePoint(...chunk)
  }
  return btoa(binary)
}

export const POST: APIRoute = async ({ request }) => {
  try {
    const { key, secondary_key, user_id } = await request.json()

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
    const rawContentType = object.httpMetadata?.contentType || 'image/jpeg'
    const allowed = new Set(['image/jpeg', 'image/png', 'image/gif', 'image/webp'])
    const contentType = allowed.has(rawContentType) ? rawContentType : 'image/jpeg'

    // Optional second image (back, base, maker mark)
    let secondary: { base64: string; contentType: string } | null = null
    if (secondary_key) {
      const secObject = await bucket.get(secondary_key)
      if (secObject) {
        const secBuffer = await secObject.arrayBuffer()
        const secRaw = secObject.httpMetadata?.contentType || 'image/jpeg'
        secondary = {
          base64: arrayBufferToBase64(secBuffer),
          contentType: allowed.has(secRaw) ? secRaw : 'image/jpeg'
        }
      }
    }

    const client = new Anthropic({ apiKey: (env as any).ANTHROPIC_API_KEY })

    const response = await client.messages.create({
      model: 'claude-sonnet-4-6',
      max_tokens: 2048,
      system: `You are a senior antiques appraiser with 40 years of experience across all categories. Analyse the image and return ONLY a valid JSON object — no markdown, no explanation, just the JSON.

Return this exact structure:
{
  "category": "one of: Pottery, Ceramics, Glass, Jewellery, Silver, Furniture, Art, Clocks, Textiles, Books, Toys, Militaria, Other",
  "subcategory": "specific item type e.g. Art Pottery Vase, Georgian Silver Teapot",
  "maker": "maker or artist name, null if unknown",
  "manufacturer": "manufacturing company if different from maker, null if unknown",
  "period": "period name e.g. Victorian, Art Deco, Georgian, Mid-Century Modern",
  "circa": "date estimate e.g. c.1890-1910, null if unknown",
  "country_of_origin": "country name, null if unknown",
  "condition": "one of: Mint, Excellent, Good, Fair, Poor",
  "condition_notes": "specific observations about condition — chips, cracks, wear, restoration, marks",
  "description": "3-4 sentences. Lead with what makes this piece distinctive. Include style, decoration, form and any notable features. Write for a collector audience.",
  "value_range_low": integer in GBP,
  "value_range_high": integer in GBP,
  "confidence": "one of: High, Medium, Low",
  "confidence_notes": "why confidence is at this level — what visual evidence supports or limits the identification",
  "rarity_score": integer 0-100 where 100 is extremely rare. Base on maker reputation, period, pattern, form and typical survival rates for this type of piece,
  "tags": ["4-6 short keyword tags for this piece e.g. Art Deco, Hand-painted, Staffordshire"],
  "category_specific": {
    "POTTERY/CERAMICS — include if applicable": {
      "maker_mark": "description of any marks, signatures or stamps visible",
      "pattern_name": "pattern name if identifiable",
      "glaze_type": "e.g. crystalline, flambe, majolica, slip-glazed",
      "firing_type": "e.g. earthenware, stoneware, porcelain, bone china",
      "shape_number": "shape or mould number if visible"
    },
    "GLASS — include if applicable": {
      "glass_type": "e.g. lead crystal, pressed, blown, art glass",
      "technique": "e.g. cameo, acid-etched, hand-painted, iridescent",
      "colour": "colour description"
    },
    "JEWELLERY — include if applicable": {
      "metal": "e.g. 18ct gold, sterling silver, base metal",
      "stones": "gemstone types and cuts if present",
      "hallmarks": "any hallmarks visible",
      "weight_estimate": "estimated weight if determinable"
    },
    "SILVER/METALWARE — include if applicable": {
      "hallmarks": "all visible hallmarks described",
      "assay_office": "assay office if identifiable",
      "weight_estimate": "estimated weight",
      "form": "functional description"
    },
    "FURNITURE — include if applicable": {
      "wood_type": "primary wood species",
      "construction": "e.g. hand-cut dovetails, machine cut, veneered",
      "style": "furniture style e.g. Chippendale, Arts and Crafts",
      "provenance_notes": "any provenance indicators"
    },
    "ART — include if applicable": {
      "medium": "e.g. oil on canvas, watercolour, lithograph",
      "subject": "subject matter description",
      "signed": "signature details if visible",
      "framed": "frame description if notable"
    }
  }
}

Only include the relevant category_specific sub-object for the identified category. Omit irrelevant ones. Be precise and authoritative. If you cannot determine something, use null rather than guessing.`,
      messages: [
        {
          role: 'user',
          content: [
            {
              type: 'image',
              source: { type: 'base64' as const, media_type: contentType as 'image/jpeg' | 'image/png' | 'image/gif' | 'image/webp', data: base64 }
            },
            ...(secondary ? [{
              type: 'image' as const,
              source: { type: 'base64' as const, media_type: secondary.contentType as 'image/jpeg' | 'image/png' | 'image/gif' | 'image/webp', data: secondary.base64 }
            }] : []),
            {
              type: 'text',
              text: secondary
                ? 'Identify and appraise this antique. The first image shows the front or main view. The second image shows the back, base, or maker mark. Use both images together for the most accurate identification. Return only the JSON.'
                : 'Identify and appraise this antique. Return only the JSON.'
            }
          ]
        }
      ]
    })

    const raw = response.content[0].type === 'text' ? response.content[0].text : ''
    const clean = raw.replaceAll('```json', '').replaceAll('```', '').trim()
    const result = JSON.parse(clean)

    const supabase = await import('@supabase/supabase-js').then(m =>
      m.createClient(
        (env as any).PUBLIC_SUPABASE_URL,
        (env as any).SUPABASE_SERVICE_ROLE_KEY
      )
    )

    const { data: record, error: dbError } = await supabase
      .from('identifications')
      .insert({
        site_id: 'add6d12c-ecd8-4517-b2e5-0f4977603744',
        user_id: user_id || null,
        image_key: key,
        secondary_image_key: secondary_key || null,
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

    if (dbError) console.error('DB write error:', dbError)

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
