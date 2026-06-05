import type { APIRoute } from 'astro'
import { env } from 'cloudflare:workers'
import type { CloudflareEnv } from '../../lib/constants'
import { ANTIQUES_SITE_ID } from '../../lib/constants'

const BATCH = 12

export const GET: APIRoute = async ({ request }) => {
  try {
    const params = new URL(request.url).searchParams
    const category = params.get('category')
    const offset = parseInt(params.get('offset') ?? '0', 10)

    if (!category) return new Response(JSON.stringify({ error: 'Missing category' }), { status: 400, headers: { 'Content-Type': 'application/json' } })

    const supabase = await import('@supabase/supabase-js').then(m =>
      m.createClient((env as unknown as CloudflareEnv).PUBLIC_SUPABASE_URL, (env as unknown as CloudflareEnv).SUPABASE_SERVICE_ROLE_KEY)
    )

    const { data, error } = await supabase
      .from('articles')
      .select('id, title, slug, excerpt, image_url, published_at')
      .eq('site_id', ANTIQUES_SITE_ID)
      .eq('category', category)
      .eq('published', true)
      .order('published_at', { ascending: false })
      .range(offset, offset + BATCH - 1)

    if (error) return new Response(JSON.stringify({ error: error.message }), { status: 500, headers: { 'Content-Type': 'application/json' } })

    return new Response(JSON.stringify({ data: data ?? [] }), {
      status: 200, headers: { 'Content-Type': 'application/json' }
    })
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : 'Unknown error'
    return new Response(JSON.stringify({ error: message }), { status: 500, headers: { 'Content-Type': 'application/json' } })
  }
}
