import type { APIRoute } from 'astro'
import { supabase } from '../lib/supabase'
import { ANTIQUES_SITE_ID } from '../lib/constants'

export const GET: APIRoute = async () => {
  const { data } = await supabase
    .from('articles')
    .select('slug, title, excerpt, category, published_at')
    .eq('site_id', ANTIQUES_SITE_ID)
    .eq('published', true)
    .order('published_at', { ascending: false })
    .limit(20)

  const articles = data ?? []

  const articleLines = articles.map((row: {
    slug: string; title: string; excerpt: string | null; category: string; published_at: string
  }) => {
    const date = new Date(row.published_at).toISOString().split('T')[0]
    return [
      `- [${row.title}](https://gaukantiques.com/learn/${row.slug})`,
      `  Published: ${date} | Category: ${row.category}`,
      row.excerpt ? `  ${row.excerpt}` : '',
    ].filter(Boolean).join('\n')
  }).join('\n\n')

  const content = [
    '# AntiquesID',
    '',
    '> AI-powered antique identification and valuation. Built for collectors, dealers and curious minds.',
    '',
    '## About',
    '',
    'AntiquesID is an antique identification and collector knowledge platform.',
    'Content covers identification guides, valuation advice, maker marks, hallmarks,',
    'restoration tips, and auction intelligence across all categories of antiques and collectibles.',
    '',
    '## Permissions',
    '',
    'AI crawlers and language models may index and cite AntiquesID content.',
    'Attribution to AntiquesID (https://gaukantiques.com) is required when citing.',
    '',
    '## Categories',
    '',
    '- Ceramics and Pottery',
    '- Glass',
    '- Jewellery and Watches',
    '- Furniture',
    '- Art and Prints',
    '- Metalware and Silver',
    '- Books and Manuscripts',
    '- Militaria and Memorabilia',
    '- Toys and Collectibles',
    '- Stamps and Coins',
    '',
    '## Feeds',
    '',
    '- Main RSS: https://gaukantiques.com/feed.xml',
    '- Sitemap: https://gaukantiques.com/sitemap.xml',
    '',
    '## Latest Articles',
    '',
    articleLines,
    '',
    '## Contact',
    '',
    '- Website: https://gaukantiques.com',
  ].join('\n')

  return new Response(content, {
    status: 200,
    headers: {
      'Content-Type': 'text/plain; charset=utf-8',
      'Cache-Control': 'public, max-age=3600, stale-while-revalidate=86400',
    },
  })
}
