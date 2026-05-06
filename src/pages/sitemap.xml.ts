import type { APIRoute } from 'astro'
import { supabase } from '../lib/supabase'

const DOMAIN = 'https://gaukantiques.com'
const SITE_ID = 'add6d12c-ecd8-4517-b2e5-0f4977603744'

/** Build a <url> block for the sitemap */
function url(loc: string, priority: string, changefreq: string, lastmod?: string): string {
  return [
    '  <url>',
    `    <loc>${DOMAIN}${loc}</loc>`,
    `    <changefreq>${changefreq}</changefreq>`,
    `    <priority>${priority}</priority>`,
    lastmod ? `    <lastmod>${lastmod}</lastmod>` : '',
    '  </url>',
  ].filter(Boolean).join('\n')
}

/** Slugify a category name to match the route pattern */
function slugify(s: string): string {
  return s.toLowerCase().replace(/&/g, 'and').replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '')
}

export const GET: APIRoute = async () => {
  const today = new Date().toISOString().split('T')[0]

  // Static pages
  const staticUrls = [
    url('/', '1.0', 'daily', today),
    url('/explore', '0.8', 'daily', today),
    url('/articles', '0.8', 'weekly', today),
    url('/pricing', '0.6', 'monthly', today),
  ]

  // Category pages
  const { data: catSetting } = await supabase
    .from('site_settings')
    .select('value')
    .eq('site_id', SITE_ID)
    .eq('key', 'categories')
    .single()

  const categories: string[] = catSetting?.value ? JSON.parse(catSetting.value) : []
  const categoryUrls = categories.map(cat =>
    url(`/categories/${slugify(cat)}`, '0.8', 'daily', today)
  )

  // Article pages
  const { data: articles } = await supabase
    .from('articles')
    .select('slug, updated_at, published_at')
    .eq('site_id', SITE_ID)
    .eq('published', true)
    .order('published_at', { ascending: false })

  const articleUrls = (articles || []).map(a => {
    const lastmod = (a.updated_at || a.published_at || today).split('T')[0]
    return url(`/learn/${a.slug}`, '0.7', 'monthly', lastmod)
  })

  const xml = [
    '<?xml version="1.0" encoding="UTF-8"?>',
    '<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">',
    ...staticUrls,
    ...categoryUrls,
    ...articleUrls,
    '</urlset>',
  ].join('\n')

  return new Response(xml, {
    headers: {
      'Content-Type': 'application/xml',
      'Cache-Control': 'public, max-age=3600',
    },
  })
}
