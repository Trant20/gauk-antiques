import type { APIRoute } from 'astro'
import { supabase } from '../lib/supabase'
import { ANTIQUES_SITE_ID } from '../lib/constants'

export const GET: APIRoute = async () => {
  const cutoff = new Date(Date.now() - 48 * 60 * 60 * 1000).toISOString()

  const { data, error } = await supabase
    .from('articles')
    .select('slug, title, published_at')
    .eq('site_id', ANTIQUES_SITE_ID)
    .eq('published', true)
    .gte('published_at', cutoff)
    .order('published_at', { ascending: false })
    .limit(1000)

  if (error) return new Response('Internal Server Error', { status: 500 })

  const rows = data ?? []

  const items = rows.map((row: { slug: string; title: string; published_at: string }) => {
    const safeTitle = row.title
      .replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;').replace(/'/g, '&apos;')
    return [
      '  <url>',
      `    <loc>https://gaukantiques.com/learn/${row.slug}</loc>`,
      '    <news:news>',
      '      <news:publication>',
      '        <news:name>AntiquesID</news:name>',
      '        <news:language>en</news:language>',
      '      </news:publication>',
      `      <news:publication_date>${new Date(row.published_at).toISOString()}</news:publication_date>`,
      `      <news:title>${safeTitle}</news:title>`,
      '    </news:news>',
      '  </url>',
    ].join('\n')
  })

  const xml = [
    '<?xml version="1.0" encoding="UTF-8"?>',
    '<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9"',
    '  xmlns:news="http://www.google.com/schemas/sitemap-news/0.9">',
    ...items,
    '</urlset>',
  ].join('\n')

  return new Response(xml, {
    status: 200,
    headers: {
      'Content-Type': 'application/xml; charset=utf-8',
      'Cache-Control': 'no-cache, no-store, must-revalidate',
    },
  })
}
