import type { APIRoute } from 'astro'

export const POST: APIRoute = async ({ request, locals }) => {
  try {
    const formData = await request.formData()
    const file = formData.get('file') as File

    if (!file) {
      return new Response(JSON.stringify({ error: 'No file provided' }), {
        status: 400,
        headers: { 'Content-Type': 'application/json' }
      })
    }

    const key = `uploads/${crypto.randomUUID()}-${file.name}`
    const bucket = (locals as any).runtime?.env?.gauk_antiques_images

    if (!bucket) {
      return new Response(JSON.stringify({ error: 'R2 binding not available' }), {
        status: 500,
        headers: { 'Content-Type': 'application/json' }
      })
    }

    const arrayBuffer = await file.arrayBuffer()

    await bucket.put(key, arrayBuffer, {
      httpMetadata: { contentType: file.type }
    })

    return new Response(JSON.stringify({ key }), {
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
