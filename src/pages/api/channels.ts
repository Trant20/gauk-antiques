import type { APIRoute } from 'astro'
import { supabase } from '../../lib/supabase'

const SITE_ID = 'add6d12c-ecd8-4517-b2e5-0f4977603744'
const PAGE_SIZE = 24

export const GET: APIRoute = async ({ url }) => {
  const page = parseInt(url.searchParams.get('page') || '1')
  const category = url.searchParams.get('category') || ''
  const search = url.searchParams.get('search') || ''
  const offset = (page - 1) * PAGE_SIZE

  let query = supabase
    .from('publishers')
    .select('id, name, slug, logo_url, description, default_category', { count: 'exact' })
    .eq('has_youtube', true)
    .eq('active', true)
    .order('name')
    .range(offset, offset + PAGE_SIZE - 1)

  if (category) {
    query = query.eq('default_category', category)
  }

  if (search) {
    query = query.ilike('name', `%${search}%`)
  }

  const { data: channels, count, error } = await query

  if (error) {
    return new Response(JSON.stringify({ error: error.message }), {
      status: 500,
      headers: { 'Content-Type': 'application/json' }
    })
  }

  // Get video counts for this page of channels
  const channelIds = (channels || []).map(c => c.id)
  const videoCounts: Record<string, number> = {}

  if (channelIds.length > 0) {
    const { data: counts } = await supabase
      .from('external_articles')
      .select('publisher_id')
      .eq('site_id', SITE_ID)
      .eq('content_type', 'video')
      .eq('is_public', true)
      .in('publisher_id', channelIds)

    counts?.forEach(r => {
      videoCounts[r.publisher_id] = (videoCounts[r.publisher_id] || 0) + 1
    })
  }

  // Get distinct categories for filter
  const { data: catRows } = await supabase
    .from('publishers')
    .select('default_category')
    .eq('has_youtube', true)
    .eq('active', true)
    .not('default_category', 'is', null)

  const categories = [...new Set(catRows?.map(r => r.default_category).filter(Boolean))].sort()

  const result = (channels || []).map(c => ({
    ...c,
    video_count: videoCounts[c.id] || 0
  }))

  return new Response(JSON.stringify({
    channels: result,
    total: count || 0,
    page,
    hasMore: offset + PAGE_SIZE < (count || 0),
    categories
  }), {
    headers: { 'Content-Type': 'application/json' }
  })
}
