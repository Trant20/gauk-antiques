import type { APIRoute } from 'astro'
import { createClient } from '@supabase/supabase-js'
import { env } from 'cloudflare:workers'
import { ANTIQUES_SITE_ID } from '../../lib/constants'
import type { CloudflareEnv } from '../../lib/constants'


function getSupabase() {
  return createClient(
    (env as unknown as CloudflareEnv).PUBLIC_SUPABASE_URL,
    (env as unknown as CloudflareEnv).SUPABASE_SERVICE_ROLE_KEY
  )
}

function errorResponse(message: string, status = 400) {
  return new Response(JSON.stringify({ error: message }), {
    status, headers: { 'Content-Type': 'application/json' },
  })
}

function jsonResponse(data: unknown) {
  return new Response(JSON.stringify(data), {
    headers: { 'Content-Type': 'application/json' },
  })
}

async function resolveUserId(request: Request): Promise<string | null> {
  const auth = request.headers.get('Authorization')
  if (!auth?.startsWith('Bearer ')) return null
  const token = auth.slice(7)
  const supabase = getSupabase()
  const { data: { user } } = await supabase.auth.getUser(token)
  return user?.id || null
}

/** GET /api/feed?limit=8 — returns videos from followed channels + you might also like */
export const GET: APIRoute = async ({ request, url }) => {
  const userId = await resolveUserId(request)
  if (!userId) return errorResponse('Unauthorised', 401)

  const limit = Number.parseInt(url.searchParams.get('limit') ?? '8', 10)
  const categorySlug = url.searchParams.get('category') || ''
  const supabase = getSupabase()

  // Get followed channel IDs and their categories
  const { data: follows } = await supabase
    .from('user_channels')
    .select('publisher_id')
    .eq('user_id', userId)
    .eq('site_id', ANTIQUES_SITE_ID)

  if (!follows?.length) return jsonResponse({ videos: [], suggested: [] })

  const publisherIds = follows.map(f => f.publisher_id)

  // Get followed channels categories for suggestions
  const { data: publishers } = await supabase
    .from('publishers')
    .select('id, default_category')
    .in('id', publisherIds)
    .not('default_category', 'is', null)

  const followedCategories = [...new Set(
    (publishers || []).map(p => p.default_category).filter(Boolean)
  )]

  // Resolve category name from slug if filtered
  let categoryFilter: string | null = null
  if (categorySlug) {
    const { data: catSetting } = await supabase
      .from('site_settings')
      .select('value')
      .eq('site_id', ANTIQUES_SITE_ID)
      .eq('key', 'categories')
      .single()
    const allCats: string[] = catSetting?.value ? JSON.parse(catSetting.value) : []
    categoryFilter = allCats.find(c =>
      c.toLowerCase().replaceAll('&', 'and').replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '') === categorySlug
    ) || null
  }

  // Build base queries
  let feedQuery = supabase
    .from('external_articles')
    .select('id, title, video_id, thumbnail_url, published_at, source_name, publisher_id')
    .eq('site_id', ANTIQUES_SITE_ID)
    .eq('content_type', 'video')
    .eq('is_public', true)
    .in('publisher_id', publisherIds)
    .order('published_at', { ascending: false })
    .limit(limit)

  let suggestQuery = followedCategories.length > 0
    ? supabase
        .from('external_articles')
        .select('id, title, video_id, thumbnail_url, published_at, source_name, publisher_id')
        .eq('site_id', ANTIQUES_SITE_ID)
        .eq('content_type', 'video')
        .eq('is_public', true)
        .not('publisher_id', 'in', `(${publisherIds.join(',')})`)
        .overlaps('categories', followedCategories)
        .order('published_at', { ascending: false })
        .limit(8)
    : null

  if (categoryFilter) {
    feedQuery = feedQuery.contains('categories', [categoryFilter])
    if (suggestQuery) suggestQuery = suggestQuery.contains('categories', [categoryFilter])
  }

  // Run feed and suggestions queries in parallel
  const [
    { data: videos },
    { data: suggested },
  ] = await Promise.all([
    feedQuery,
    suggestQuery ?? Promise.resolve({ data: [] }),
  ])

  return jsonResponse({ videos: videos || [], suggested: suggested || [] })
}
