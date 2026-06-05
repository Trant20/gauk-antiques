import type { APIRoute } from 'astro'
import { env } from 'cloudflare:workers'
import type { CloudflareEnv } from '../../lib/constants'

const ALLOWED_TYPES = new Set(['image/jpeg', 'image/png', 'image/gif', 'image/webp'])
const MAX_SIZE_BYTES = 10 * 1024 * 1024 // 10MB

function json(data: unknown, status = 200) {
  return new Response(JSON.stringify(data), {
    status, headers: { 'Content-Type': 'application/json' }
  })
}

export const POST: APIRoute = async ({ request }) => {
  try {
    const formData = await request.formData()
    const file = formData.get('file') as File | null
    if (!file) return json({ error: 'No file provided' }, 400)

    // Validate file size
    if (file.size > MAX_SIZE_BYTES) return json({ error: 'File too large. Maximum size is 10MB.' }, 413)

    // Validate MIME type server-side — do not trust client-supplied type alone
    const arrayBuffer = await file.arrayBuffer()
    const bytes = new Uint8Array(arrayBuffer)

    // Detect type from magic bytes
    let detectedType = 'image/jpeg'
    if (bytes[0] === 0x89 && bytes[1] === 0x50) detectedType = 'image/png'
    else if (bytes[0] === 0x47 && bytes[1] === 0x49) detectedType = 'image/gif'
    else if (bytes[0] === 0x52 && bytes[1] === 0x49) detectedType = 'image/webp'
    else if (bytes[0] === 0xFF && bytes[1] === 0xD8) detectedType = 'image/jpeg'

    if (!ALLOWED_TYPES.has(detectedType)) {
      return json({ error: 'Invalid file type. Only JPEG, PNG, GIF and WebP are accepted.' }, 415)
    }

    const bucket = (env as unknown as CloudflareEnv).gauk_antiques_images
    if (!bucket) return json({ error: 'Storage not available' }, 500)

    // UUID-only key — no user-supplied filename
    const ext = detectedType.split('/')[1].replace('jpeg', 'jpg')
    const key = `uploads/${crypto.randomUUID()}.${ext}`

    await bucket.put(key, arrayBuffer, {
      httpMetadata: { contentType: detectedType }
    })

    return json({ key })

  } catch (err: any) {
    return json({ error: err.message }, 500)
  }
}
