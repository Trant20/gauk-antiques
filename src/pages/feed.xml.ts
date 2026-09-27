import type { APIRoute } from 'astro'
import { supabase } from '../lib/supabase'
import { ANTIQUES_SITE_ID } from '../lib/constants'

function xml(str: string): string {
  return str.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;').replace(/'/g, '&apos;')
}

function rfc822(iso: string): string {
  return new Date(iso).toUTCString()
}

export const GET: APIRoute = async () => {
  const { data, error } = await supabase
    .from('articles')
    .select('slug, title, excerpt, body, category, author, image_url, published_at, tags')
    .eq('site_id', ANTIQUES_SITE_ID)
    .eq('published', true)
    .order('published_at', { ascending: false })
    .limit(50)

  if (error) return new Response('Internal Server Error', { status: 500 })

  const rows = data ?? []

  const items = rows.map((row: {
    slug: string; title: string; excerpt: string | null; body: string | null
    category: string; author: string | null; image_url: string | null
    published_at: string; tags: string[] | null
  }) => {
    const url = `https://gaukantiques.com/learn/${row.slug}`
    const cats = Array.isArray(row.tags) && row.tags.length > 0 ? row.tags : [row.category].filter(Boolean)
    const catTags = cats.map((c: string) => `    <category>${xml(c)}</category>`).join('\n')
    const imageTag = row.image_url ? `    <media:content url="${xml(row.image_url)}" medium="image" />` : ''
    const bodyContent = row.body ? `    <content:encoded><![CDATA[${row.body}]]></content:encoded>` : ''
    return [
      '  <item>',
      `    <title>${xml(row.title)}</title>`,
      `    <link>${url}</link>`,
      `    <guid isPermaLink="true">${url}</guid>`,
      `    <pubDate>${rfc822(row.published_at)}</pubDate>`,
      `    <author>editorial@gaukantiques.com (${xml(row.author ?? 'AntiquesID')})</author>`,
      `    <description>${xml(row.excerpt ?? '')}</description>`,
      catTags,
      imageTag,
      bodyContent,
      '  </item>',
    ].filter(Boolean).join('\n')
  })

  const lastBuildDate = rows.length > 0 ? rfc822(rows[0].published_at) : rfc822(new Date().toISOString())

  const xml_out = [
    '<?xml version="1.0" encoding="UTF-8"?>',
    '<rss version="2.0"',
    '  xmlns:content="http://purl.org/rss/1.0/modules/content/"',
    '  xmlns:dc="http://purl.org/dc/elements/1.1/"',
    '  xmlns:media="http://search.yahoo.com/mrss/"',
    '  xmlns:atom="http://www.w3.org/2005/Atom">',
    '  <channel>',
    '    <title>AntiquesID</title>',
    '    <link>https://gaukantiques.com</link>',
    '    <description>Antique identification, valuation and collector guides.</description>',
    '    <language>en-gb</language>',
    '    <managingEditor>editorial@gaukantiques.com (AntiquesID)</managingEditor>',
    `    <lastBuildDate>${lastBuildDate}</lastBuildDate>`,
    '    <ttl>60</ttl>',
    '    <atom:link href="https://gaukantiques.com/feed.xml" rel="self" type="application/rss+xml" />',
    ...items,
    '  </channel>',
    '</rss>',
  ].join('\n')

  return new Response(xml_out, {
    status: 200,
    headers: {
      'Content-Type': 'application/rss+xml; charset=utf-8',
      'Cache-Control': 'public, max-age=900, stale-while-revalidate=3600',
    },
  })
}
