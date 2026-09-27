import type { APIRoute } from 'astro'

const DOMAIN = 'https://gaukantiques.com'

export const GET: APIRoute = () => {
  const content = [
    'User-agent: *',
    'Allow: /',
    '',
    'User-agent: Googlebot-News',
    'Allow: /',
    '',
    'User-agent: Bingbot',
    'Allow: /',
    '',
    'User-agent: PerplexityBot',
    'Allow: /',
    '',
    'User-agent: GPTBot',
    'Allow: /',
    '',
    'User-agent: ClaudeBot',
    'Allow: /',
    '',
    '# Auth and account pages — no indexing needed',
    'Disallow: /auth/',
    'Disallow: /account',
    'Disallow: /library',
    'Disallow: /welcome',
    '',
    '# API routes',
    'Disallow: /api/',
    '',
    `Sitemap: ${DOMAIN}/sitemap.xml`,
    `Sitemap: ${DOMAIN}/sitemap-news.xml`,
  ].join('\n')

  return new Response(content, {
    headers: {
      'Content-Type': 'text/plain',
      'Cache-Control': 'public, max-age=86400',
    },
  })
}
