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

## Wikidata Knowledge Spine
Every nga_constituent and nga_object with a wikidata_id is linked to the wikidata_entities table.
- wikidata_entities stores: label, description, portrait_url, signature_url, birth/death dates and places, movements, occupations, influenced_by_ids, notable_work_ids
- nga_constituents has portrait_url and signature_url back-filled for zero-join display
- nga_constituents has slug column for direct URL routing
- Enrichment script: scripts/enrich-wikidata.mjs — run locally or on Hetzner
- Matching script: /opt/gauk-wikidata/match-wikidata.mjs on Hetzner VPS (77.42.86.1) — matches unmatched constituents by name, runs with --resume flag, loops via run-all.sh

## Profile Pages
- Artist profiles: /artists/[slug] — pulls from nga_constituents + wikidata_entities + nga_objects
- Object profiles: /collection/[slug] — slug is accession_num with dots replaced by hyphens (1963.15.26 → 1963-15-26)
- Object pages accept ?from=[artist-slug] param to build correct breadcrumb trail
- Both pages have Person / VisualArtwork JSON-LD schema

## Museum Collection
- NGA dataset: 116,069 objects, 24,068 artists
- Tables: nga_objects, nga_constituents, nga_object_constituents, nga_object_terms, nga_object_texts, nga_object_dimensions, nga_object_historical, nga_constituent_altnames, nga_constituent_texts
- nga_objects.wikidata_id and nga_constituents.wikidata_id pre-populated from NGA source data
- Collections browser at /categories/collections — objects and artists tabs, search, alphabet filter, detail panels

## Tech Debt
- collections.astro is 812 lines — needs splitting: frontmatter, CSS, render functions, fetch functions
- Dark theme CSS tokens duplicated across collections.astro, artists/[slug].astro, collection/[slug].astro — consolidate into Layout.astro
- Panel HTML in collections.astro built as concatenated template strings — extract into render functions
- wikidata_entities RLS: add explicit deny on insert/update/delete for anon role
- publishers.type column redundant — has_rss and has_youtube replace it, remove from DB and API once stable

## Session Log
- Session 1: Scaffold — Astro 6, Tailwind v4, Node/Cloudflare dual adapter, pushed to GitHub
- Session 2: Supabase client connected and verified, R2 bucket created (gauk-antiques-images), wrangler project name fixed
- Session 3: Image upload pipeline complete — FormData upload via Worker to R2, deployed and tested in production
- Session 4: Claude Vision identification pipeline complete — R2 fetch, base64 encoding, structured JSON response, result card rendering. Tested successfully with Moorcroft pottery vase.
- Session 5: Supabase Auth enabled, sign-in and sign-up pages built, user_id attached to identification records, identifications table created with RLS policies
- Sessions 7-10: Full valuation card built — parchment design, 4 condition gauges, grade bar, market value SVG chart, desirability index, maker/manufacturer/mark/glaze/firing sections, expert notes, timeline, comparables, your options. Vision card on index with typewriter description and blur gate. Enrichment switched to Haiku. Audit completed and CSS conflicts resolved.
- Session 11 (2026-05-06): Full mobile UI audit and SEO pass. Bottom nav moved into PublicShell, duplicate homepage nav removed, category hero mobile padding fixed. AppShell duplicate CSS removed, sidebar flash fixed. Valuation page header overlap, gauges grid and safe area inset fixed. Mobile padding and grid overrides applied across all pages. Canonical URLs and og:url added to PublicShell. OG descriptions added to index, explore, pricing. Article schema on learn pages, WebApplication schema on homepage, CollectionPage schema on articles/explore/category pages. Dynamic sitemap and robots.txt added. UI standards documented.
- Session 12 (2026-05-07): Wikidata knowledge spine built. wikidata_entities table created with RLS. Enrichment script ran — 1,000 artists enriched, 690 portraits and 164 signatures stored. nga_constituents back-filled with portrait_url, signature_url, slug columns. Artist and object profile pages built (/artists/[slug], /collection/[slug]). Breadcrumb trail with ?from= param. Collections page updated — portraits in artist list and detail panels, signatures in detail panels, View Full Profile and View Object links. Wikidata name matching script deployed to Hetzner VPS, running overnight against 11,837 unmatched constituents.
