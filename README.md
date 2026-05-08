# gauk-antiques

Public-facing antiques identification site. Part of the GAUK Network.

## Stack
- Astro 6 + Cloudflare Pages adapter
- Tailwind CSS v4 (Vite plugin)
- Cloudflare R2 (image storage)
- Supabase gauk-network (shared GAUK database)
- Claude Vision API (identification engine)
- site_id: add6d12c-ecd8-4517-b2e5-0f4977603744

## Local Dev
Uses Node adapter locally (Cloudflare adapter requires macOS 13.5+).

```bash
npm install
npm run dev
```

Runs at http://localhost:4321

## Deploy
Cloudflare Pages. Connected to main branch. CF_PAGES env var switches adapter to Cloudflare on build.

## Live URLs
- Production: https://gaukantiques.com
- Worker: https://gauk-antiques.gauk-media.workers.dev

## Shells
Every page uses one of two layouts. No exceptions, no inline navs.

PublicShell — all public-facing pages. Provides fixed nav, mobile hamburger drawer, bottom mobile nav (Identify / Library / Account), footer, canonical URL, OG meta.

AppShell — authenticated pages only (identify, library, account, valuation). Provides SideNav with hamburger on mobile.

Never use bare Layout.astro directly in a page.

## UI Standards

Colours — all defined in Layout.astro :root. Never hardcode hex values, use the tokens.
- Background: #EFE7D9 — parchment
- Dark surface: #1C1810 — hero sections and interrupts
- Gold: #7A5C20 — links, accents, active states
- Gold highlight: #C8A060 — eyebrows, labels
- Border: #C4B49E
- Text primary: #1C1810
- Text secondary: #5C5040
- Text muted: #8A7A66

Typography
- Display headings: Playfair Display, italic, font-weight 400
- Body and UI: Prata, Georgia, serif
- Eyebrows and labels: Prata, 9–11px, letter-spacing 3–4px, text-transform uppercase
- Never use font sizes below 9px

Spacing
- Section padding desktop: 64px 32px
- Section padding mobile: 48px 16px
- Hero content padding desktop: 60px 40px
- Hero content padding mobile: 80px 16px 40px (80px top clears the fixed nav)
- Page max-width: 1100px for full-width sections, 800px for article and content pages
- Never use side padding of 40px without a @media (max-width: 767px) override at 16px

Grids — every grid needs a mobile override, no exceptions
- 4-column → 2-column at 767px
- 3-column → 2-column at 768px, 1-column at 480px
- 2-column → 1-column at 600px or 480px depending on content density

Mobile breakpoints
- 767px — primary breakpoint for layout changes
- 480px — small phone override for grids and tight components
- 400px — only for very specific single-column overrides

## SEO and Structured Data
Every new public page needs a JSON-LD block in the head slot.
- Article pages — Article schema
- Category and collection pages — CollectionPage schema
- Tool and feature pages — WebApplication schema
- Artist pages — Person schema
- Object pages — VisualArtwork schema

PublicShell auto-generates canonical URL and og:url from Astro.url.pathname against gaukantiques.com. Every page must pass a description prop to PublicShell.

Sitemap available at /sitemap.xml — dynamically generated from Supabase categories and articles.
Robots.txt at /robots.txt — blocks auth, account, library, identify, API routes.

## New Page Checklist
Before shipping any new page:
- Uses PublicShell or AppShell, never bare Layout
- All grids have mobile overrides
- No side padding of 40px without a 16px mobile override at 767px
- JSON-LD schema block in head slot
- Description prop passed to PublicShell

## Unified Collection Schema
All museum/collection data lives in unified tables in gauk-network (deyqcxujxweiwmsiscsz):

- collection_sources — nga, tate, vam, christies, sothebys
- collection_artists — all artists from all sources, wikidata_id links across sources
- collection_objects — all objects from all sources
- collection_object_artists — junction table
- collection_manufacturers — manufacturers with founding dates, locations, logos

Source data stays in nga_* tables for backward compatibility. New sources go directly into collection_* tables.

Current sources:
- NGA: 24,068 artists, 116,069 objects — imported 2026-05-08
- Tate: 3,532 artists, 69,201 objects — imported 2026-05-08

## Wikidata Knowledge Spine
Every artist with a wikidata_id is linked to wikidata_entities.
- wikidata_entities stores: label, description, portrait_url, signature_url, birth/death dates and places, movements, occupations, influenced_by_ids, notable_work_ids
- nga_constituents has portrait_url and signature_url back-filled for zero-join display
- nga_constituents has slug column for direct URL routing
- Enrichment script: scripts/enrich-wikidata.mjs — reads from collection_artists, writes to wikidata_entities, back-fills collection_artists and nga_constituents
- Matching script: /opt/gauk-wikidata/match-wikidata.mjs on Hetzner VPS (77.42.86.1)

## Profile Pages
- Artist profiles: /artists/[slug] — nga_constituents + wikidata_entities + nga_objects
- Object profiles: /collection/[slug] — slug is accession_num with dots replaced by hyphens
- Object pages accept ?from=[artist-slug] param for correct breadcrumb trail
- Both pages have Person / VisualArtwork JSON-LD schema

## Scripts
- scripts/enrich-wikidata.mjs — enriches matched artists from collection_artists
- scripts/migrate-nga.mjs — migrated NGA data to unified collection_ tables (run once)
- scripts/import-tate.mjs — imports Tate CSV data into collection_ tables

## Tech Debt
- collections.astro is 812 lines — split into separate files
- Dark theme CSS tokens duplicated across collections.astro, artists/[slug].astro, collection/[slug].astro
- Panel HTML in collections.astro built as concatenated template strings
- wikidata_entities RLS — add explicit deny on insert/update/delete for anon
- publishers.type column redundant — has_rss and has_youtube replace it
- Artist/object profile pages still read from nga_* tables — migrate to collection_* tables
- Full Sync in GMC runs matching against all sources — needs source selector per dataset

## Session Log
- Session 1: Scaffold — Astro 6, Tailwind v4, Node/Cloudflare dual adapter, pushed to GitHub
- Session 2: Supabase client connected and verified, R2 bucket created (gauk-antiques-images), wrangler project name fixed
- Session 3: Image upload pipeline complete — FormData upload via Worker to R2, deployed and tested in production
- Session 4: Claude Vision identification pipeline complete — R2 fetch, base64 encoding, structured JSON response, result card rendering. Tested successfully with Moorcroft pottery vase.
- Session 5: Supabase Auth enabled, sign-in and sign-up pages built, user_id attached to identification records, identifications table created with RLS policies
- Sessions 7-10: Full valuation card built — parchment design, 4 condition gauges, grade bar, market value SVG chart, desirability index, maker/manufacturer/mark/glaze/firing sections, expert notes, timeline, comparables, your options. Vision card on index with typewriter description and blur gate. Enrichment switched to Haiku. Audit completed and CSS conflicts resolved.
- Session 11 (2026-05-06): Full mobile UI audit and SEO pass. Bottom nav moved into PublicShell, duplicate homepage nav removed, category hero mobile padding fixed. AppShell duplicate CSS removed, sidebar flash fixed. Valuation page header overlap, gauges grid and safe area inset fixed. Mobile padding and grid overrides applied across all pages. Canonical URLs and og:url added to PublicShell. OG descriptions added to index, explore, pricing. Article schema on learn pages, WebApplication schema on homepage, CollectionPage schema on articles/explore/category pages. Dynamic sitemap and robots.txt added. UI standards documented.
- Session 12 (2026-05-08): Wikidata knowledge spine built. wikidata_entities table, enrichment and matching scripts. 11,426+ NGA artists matched, enrichment running on Hetzner (2,300+ enriched, 1,361 portraits, 261 signatures). Artist profile pages /artists/[slug] and object profile pages /collection/[slug] built with portrait, signature, movements, works grid, JSON-LD schema. Unified collection_ schema designed and built. NGA data migrated (24K artists, 116K objects). Tate collection imported (3,532 artists, 69,201 artworks). Hetzner Jobs API server deployed as systemd service on port 4000. GMC Wikidata admin built at /scrapers/wikidata — status, job controls, live log streaming, progress bars, entity browser, search importer.
