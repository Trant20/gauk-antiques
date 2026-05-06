import type { APIRoute } from 'astro'

const DOMAIN = 'https://gaukantiques.com'

export const GET: APIRoute = () => {
  const content = [
    'User-agent: *',
    'Allow: /',
    '',
    '# Auth and account pages — no indexing needed',
    'Disallow: /auth/',
    'Disallow: /account',
    'Disallow: /library',
    'Disallow: /identify',
    'Disallow: /welcome',
    '',
    '# API routes',
    'Disallow: /api/',
    '',
    `Sitemap: ${DOMAIN}/sitemap.xml`,
  ].join('\n')

  return new Response(content, {
    headers: {
      'Content-Type': 'text/plain',
      'Cache-Control': 'public, max-age=86400',
    },
  })
}
