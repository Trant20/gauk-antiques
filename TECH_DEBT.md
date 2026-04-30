# GAUK Antiques — Tech Debt

Last updated: 2026-04-30

## Known Issues

### Code Quality
- [ ] `is:global` on all styles in collections.astro — scoping risk if class names clash
- [ ] Collections page JS is very long — should be split into modules
- [ ] Article page has inline script blocks that duplicate Supabase client logic
- [ ] Some pages still use inline createClient in `<script>` tags (client-side only — acceptable but note it)

### Content
- [ ] Some article excerpts still may have unrendered HTML entities — spot check needed
- [ ] Article body may still contain `[caption]` and other WordPress shortcodes — audit needed
- [ ] Some articles have no image — affects category page thumbnail display

### Architecture  
- [ ] No error handling on failed Supabase queries in Astro frontmatter — throws 500
- [ ] PublicShell loads categories on every page request — should be cached
- [ ] No sitemap.xml generated
- [ ] No robots.txt configured
- [ ] Canonical URLs point to gaukantiques.com but site is on gauk-media.workers.dev

### Performance
- [ ] NGA image mirror job not built — all images still on NGA servers (r2_image_url null)
- [ ] No image optimisation — full size images served without resizing
- [ ] Collections page initial load fetches 50 objects — consider reducing to 24

### Missing
- [ ] /makers/[slug] pages — linked from category pages but return 404
- [ ] Mobile responsive pass — whole site needs dedicated session
- [ ] Stripe webhook not end-to-end tested
- [ ] Rate limiting on vision/identify endpoint

## Decisions Taken (do not revisit without reason)
- Astro is:global required for dynamically injected HTML in script tags
- python3 heredoc required for file writes — cat heredocs fail on long files
- Supabase singleton at src/lib/supabase.ts for all server-side frontmatter
- /category/[slug]/articles route (not /categories/[category]/articles) — Astro routing conflict
- Collections at standalone /categories/collections.astro — not dynamic route
