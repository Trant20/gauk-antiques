# GAUK Antiques — Tech Debt & Known Issues
Last updated: 2026-06-05 (Security & Quality Audit Session)

## Architecture Notes (intentional decisions)
- Supabase singleton at `src/lib/supabase.ts` for server-side, `src/lib/supabase-browser.ts` for client
- `/category/[slug]/articles` route (not `/categories/`) — Astro routing conflict
- Collections at `/categories/collections.astro` — not dynamic route
- No RLS on gauk-network tables (except `user_channels`, `gauk_sources`) — service role key server-side
- `usd_exchange_rate` hardcoded in `currency.ts` — currency switcher + geolocation planned
- PostHog API key in source — move to env var (M28)
- PostHog installed in `Layout.astro` — covers all public pages
- `/explore` redirects 301 to `/` — content superseded by home page
- `pending_claims` table handles cross-browser identification claiming after email confirmation
- Currency symbols (`$` for GBP) intentional until currency switcher built (H4 deferred)

## Fixed This Session
- C1: grant-credits now requires JWT — user_id from token only
- C2: identify + enrich now auth-gated with server-side credit deduction before AI call
- C3: all client-side deduct-credits calls removed (4 locations)
- C4: enrichment deduction atomic via RPC, no more client-side loops
- C5: claim-identification now requires JWT — user_id from token only
- C6: pending-claim has try/catch, UUID validation, existence check, server-side SITE_ID
- C7: upload-url has magic byte type detection, 10MB size limit, UUID-only keys
- C8: stripe webhook hard fails if STRIPE_WEBHOOK_SECRET missing
- H1: invoice.payment_succeeded handled — subscription renewals now grant credits
- H2: resolved by C2 — enrich deducts before AI call
- H3: valuation page consolidated to single script block with ownership check
- H5: welcome page credit cost copy now dynamic from site_settings
- H6: library identifications query now filters by site_id
- H7: duplicate CSS rules removed from index.astro
- H8: /identify removed from robots.txt disallow list
- H9: dead video modal script + CSS removed from categories/[category].astro
- H10: escapeHtml applied to all innerHTML injections in library, feed, channels/index, category/articles
- H11: set:html replaced with set:text + decodeTitle in videos, videos/[id], channels/[slug]
- H12: email escaped before innerHTML injection in signup + forgot-password
- H13: resolved by C1
- H14: password validation regex forward slash escaped in signup + update-password
- Added src/lib/utils.ts with escapeHtml and slugify (canonical — import everywhere)
- Guest identify rate limit: 2 per 24h via Cloudflare KV (SESSION namespace)
- Guest limit gate: warm typewriter UX on index.astro (guest-limit-reached event)

## Remaining Medium Priority (M items)
- M1: SITE_ID hardcoded 41 times — create src/lib/constants.ts, import everywhere
- M2: slugify duplicated 14 times — now in utils.ts, needs importing everywhere
- M3: getPromptConfig duplicated in identify.ts and ask.ts — extract to src/lib/ai.ts
- M4: Supabase client created multiple times per request in some routes
- M5: dynamic import anti-pattern on Supabase in older routes (ask.ts uses direct import now)
- M6: (env as any) throughout — create shared CloudflareEnv type
- M7: token cost magic numbers (0.003/0.015) duplicated — add to constants.ts
- M8: enrich.ts prompt hardcoded in source — should be in ai_prompts table
- M9: identification-complete handler duplicated between index.astro and categories/[category].astro
- M10: result card HTML duplicated between index.astro and categories/[category].astro
- M11: formatValueRange not used in library.astro, index.astro — reimplemented inline
- M12: R2 CDN URL hardcoded 5 times — add to constants.ts
- M13: videos.astro fires 22 parallel DB queries — needs GROUP BY aggregation
- M14: articles.astro fires 22 parallel DB queries — needs GROUP BY aggregation
- M15: PublicShell.astro has 2 sequential blocking DB queries — parallelise
- M16: articles.astro has 4 sequential site_settings queries — combine with .in()
- M17: video/channel counts fetched by pulling all rows — needs COUNT query
- M18: decodeHtml duplicated — now in utils.ts as decodeTitle, needs consolidating
- M19: auth pages duplicate 30 lines CSS — extract AuthShell.astro layout
- M20: three CSS variable systems — Layout.astro tokens ignored in most components
- M21: scrolled CSS class toggled in PublicShell but never defined
- M22: 8 files over 200-line limit
- M23: ask.ts guest credit bypass — server-side rate limiting needed
- M24: ask-session generates weak session IDs — use crypto.randomUUID()
- M25: ask session IDs not validated by ask.ts — session system unused
- M26: direct Supabase REST calls in category/articles and collections client scripts
- M27: valuation/[id] script blocks consolidated (done) ✅
- M28: PostHog key in source — move to env var
- M29: Supabase credentials in HTML meta tags — remove
- M30: forgot-password redirectTo hardcoded production URL
- M31: /makers/[slug] links are live 404s on category pages

## Remaining Low Priority (L items)
- See audit document GAUK_ANTIQUES_AUDIT.md for full L1-L47 list

## Future Features (not debt)
- Public valuation sharing route /report/[id] with blur gate for non-owners
- Currency switcher + geolocation for correct currency display
- Stripe subscription renewal testing with CLI webhook simulator
- /makers/[slug] route build
- Mobile responsive audit pass
