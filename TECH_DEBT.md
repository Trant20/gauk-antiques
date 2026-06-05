# GAUK Antiques — Tech Debt & Known Issues
Last updated: 2026-06-05 (Post-audit reconciliation)

## Architecture Notes (intentional decisions)
- Supabase singleton at `src/lib/supabase.ts` for server-side, `src/lib/supabase-browser.ts` for client
- `/category/[slug]/articles` route (not `/categories/`) — Astro routing conflict
- Collections at `/categories/collections.astro` — not dynamic route
- No RLS on gauk-network tables (except `user_channels`, `gauk_sources`) — service role key server-side
- `usd_exchange_rate` hardcoded in `currency.ts` — currency switcher + geolocation planned
- `/explore` redirects 301 to `/` — content superseded by home page
- `pending_claims` table handles cross-browser identification claiming after email confirmation
- Currency symbols (`$` for GBP) intentional until currency switcher built (H4 deferred)
- Client `<script>` blocks cannot import from `src/lib/constants.ts` — values must be local consts, define:vars, or API fetch

## Completed (Security & Quality Audit)
- C1: grant-credits requires JWT — user_id from token only
- C2: identify + enrich auth-gated, server-side credit deduction before AI call
- C3: all client-side deduct-credits calls removed (4 locations)
- C4: enrichment deduction atomic via RPC
- C5: claim-identification requires JWT
- C6: pending-claim has try/catch, UUID validation, existence check, server-side SITE_ID
- C7: upload-url has magic byte type detection, 10MB limit, UUID-only keys
- C8: stripe webhook hard fails if STRIPE_WEBHOOK_SECRET missing
- H1: invoice.payment_succeeded handled — subscription renewals grant credits
- H3: valuation page consolidated to single script block with ownership check
- H5: welcome page credit cost copy dynamic from site_settings
- H6: library identifications query filters by site_id
- H7: duplicate CSS removed from index.astro
- H8: /identify removed from robots.txt
- H9: dead video modal removed from categories/[category].astro
- H10: escapeHtml on all innerHTML injections
- H11: set:html replaced with set:text + decodeTitle
- H12: email escaped in auth pages
- H14: password regex fixed
- M1: ANTIQUES_SITE_ID centralised in src/lib/constants.ts, imported server-side everywhere
- M2: slugify centralised in src/lib/utils.ts
- M3: getPromptConfig extracted to src/lib/ai.ts
- M6: CloudflareEnv type in constants.ts, (env as any) removed
- M7: token cost constants in constants.ts
- M8: enrich prompt DB-driven from ai_prompts table
- M9/M10: IdentificationResult.astro component + identification-handler.ts
- M11: formatValueRange in currency.ts
- M12: R2_CDN centralised in src/lib/constants.ts
- M18: decodeTitle in utils.ts
- M19: AuthShell.astro layout
- M21: dead scrolled class removed
- M23: guest ask rate limit via KV
- M24: crypto.randomUUID() for session IDs
- M25: ask-session system removed
- M27: valuation/[id] consolidated to single script block
- M28: PostHog removed
- M29: Supabase meta tags removed
- M30: forgot-password uses window.location.origin
- CLIENT SCOPE FIX: ANTIQUES_SITE_ID + R2_CDN local consts added to library.astro, account.astro, SideNav.astro client scripts; ANTIQUES_SITE_ID added to valuation/[id].astro define:vars; broken template literals fixed in valuation/[id].astro lines 27-28

## Remaining Medium Priority
- M4: SideNav.astro uses shared supabase-browser.ts singleton ✅
- M13: videos.astro single query + JS grouping ✅
- M14: articles.astro 26 queries → 2 parallel queries ✅
- M15: PublicShell.astro queries parallelised ✅
- M16: articles.astro site_settings combined with .in() ✅
- M17: video/channel counts fetched by pulling all rows — needs COUNT query
- M20: three CSS variable systems — Layout.astro tokens ignored in most components
- M22: files over 200-line limit:
    - src/pages/valuation/[id].astro — 814 lines
    - src/pages/categories/collections.astro — 537 lines
    - src/pages/categories/[category].astro — 521 lines
    - src/components/AIHeroWidget.astro — 522 lines
    - src/pages/videos.astro — 498 lines
    - src/layouts/PublicShell.astro — 434 lines
    - src/pages/channels/index.astro — 421 lines
    - src/components/AskChat.ts — 239 lines
    - src/components/SideNav.astro — 181 lines (borderline)
- M26: category/articles uses /api/articles endpoint; collections deferred (full rebuild required) ✅
- M31: broken /makers links removed from category pages; route build deferred to future feature ✅

## Remaining Low Priority
- L1: Layout.astro CSS tokens unused — components use hardcoded hex values
- L2: PublicShell.astro bottom nav active state uses JS — could be CSS :local-link
- L3: No loading state on feed.astro channel filter
- L4: No error boundary on AskChat — silent failure if API down
- L5: articles.astro has no empty state UI
- L6: channels/index.astro pulls all videos to count — wasteful
- L7: videos/[id].astro related videos query pulls 6 but only shows 3
- L8: SideNav hamburger state not restored on back navigation
- L9: No skeleton loader on valuation/[id].astro enrichment section
- L10: identify.astro image preview has no remove/reset option
- L11: No pagination on library.astro — will degrade at scale
- L12: account.astro transaction history limited to 10 — no load more
- L13: 404.astro pulls recent identifications — unnecessary DB call on error page
- L14: learn/[slug].astro has no 404 handling if article not found
- L15: feed.astro personalisation only filters videos — articles unfiltered
- L16: PublicShell search input has no debounce
- L17: No sitemap entry for /feed, /library, /account
- L18: OG images are static — no dynamic OG for valuation pages
- L19: No canonical tag on paginated or filtered views
- L20: videos.astro category filter state lost on page refresh

## Future Features (not debt)
- Public valuation sharing route /report/[id] with blur gate for non-owners
- Currency switcher + geolocation for correct currency display
- Stripe subscription renewal testing with CLI webhook simulator
- /makers/[slug] route build
- Mobile responsive audit pass
- Freemium monetisation via Stripe (tiers defined in memory)
