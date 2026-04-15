import type { APIRoute } from 'astro'

export const POST: APIRoute = async ({ request, locals }) => {
  const { filename, contentType } = await request.json()

  if (!filename || !contentType) {
    return new Response(JSON.stringify({ error: 'filename and contentType required' }), {
      status: 400,
      headers: { 'Content-Type': 'application/json' }
    })
  }

  const key = `uploads/${crypto.randomUUID()}-${filename}`

  const bucket = (locals.runtime?.env as any)?.gauk_antiques_images

  if (!bucket) {
    return new Response(JSON.stringify({ error: 'R2 binding not available' }), {
      status: 500,
      headers: { 'Content-Type': 'application/json' }
    })
  }

  const url = await bucket.createPresignedUrl('PUT', key, {
    expiresIn: 300,
    httpMetadata: { contentType }
  })

  return new Response(JSON.stringify({ url, key }), {
    status: 200,
    headers: { 'Content-Type': 'application/json' }
  })
}
