# GAUK Antiques — Tech Debt
Last updated: 2026-06-05

## Architecture & Patterns

### SITE_ID Hardcoded (28 files) — PRIORITY
Every file hardcodes `const SITE_ID = 'add6d12c-ecd8-4517-b2e5-0f4977603744'`
Fix: single constant in `src/lib/constants.ts`, imported everywhere.
Files affected: all pages and API routes.

### Inline Supabase createClient in API routes
Several API routes use `await import('@supabase/supabase-js').then(m => m.createClient(...))`
Fix: use `import { createClient } from '@supabase/supabase-js'` at top of file consistently.

### Articles array hardcoded in explore.astro
explore.astro (now 301 redirect) had hardcoded article slugs — now moot but pattern should not recur.

---

## Code Quality

### AskChat.ts — any type on SpineMark (line 57)
`identificationResult` typed as object shape — verify this matches actual API response shape.

### Migration scripts in /scripts
`migrate-to-gauk.mjs`, `patch-artist-*.mjs` — one-time scripts, SonarCloud flags them.
Decision: keep for reference, add `.sonarignore` entry to suppress warnings.

### Duplicate Supabase client in client-side scripts
Some `<script>` tags create their own Supabase client instead of importing `supabase-browser.ts`.
Fix: audit all client-side scripts and ensure they import from `src/lib/supabase-browser.ts`.

### PublicShell.astro — categories fetched on every page load
Every public page load hits Supabase for the categories list.
Fix: cache in a server-side module or use Cloudflare KV.

---

## Missing Features / Incomplete

### /makers/[slug] pages — 404
Category pages link to maker profiles but the route does not exist.

### Mobile responsive audit
No dedicated mobile pass has been done. Bottom nav exists but content pages need review.

### Stripe webhook end-to-end test
Webhook tested locally but not verified on production `gaukantiques.com` with real subscription.

### Rate limiting on /api/identify
No rate limiting beyond Arcjet. Vision API calls are expensive — add per-IP limits.

### NGA image mirror
`r2_image_url` is null on all NGA objects — images still served from NGA servers.
Risk: NGA could remove images. Should mirror to R2.

### Article WordPress shortcodes
Some article bodies may still contain `[caption]` and other WordPress shortcodes.
Audit: `SELECT COUNT(*) FROM articles WHERE body LIKE '%[caption%'`

### Article HTML entities
Some excerpts may have unrendered HTML entities (&amp; etc).

---

## Performance

### Image optimisation
Full-size images served without resizing. Cloudflare Images binding exists but not used for article images.

### PublicShell category fetch
See Architecture above — every page load fetches categories from Supabase.

### Collections initial load
Collections page fetches 50 objects on load — consider reducing to 24.

---

## Security

### Anthropic API key rotation needed
Key was exposed in a session — must be rotated at console.anthropic.com and updated in:
- `/opt/gauk-rss/.env` (Hetzner VPS)
- `/opt/gauk-article-gen/.env` (Hetzner VPS)
- Cloudflare Workers secrets

---

## Decisions Taken (do not revisit without reason)
- `is:global` required on all styles in pages with dynamically injected HTML
- `python3 -` heredoc required for file writes over 50 lines — `cat >` fails silently
- Supabase singleton at `src/lib/supabase.ts` for server-side, `src/lib/supabase-browser.ts` for client
- `/category/[slug]/articles` route (not `/categories/`) — Astro routing conflict
- Collections at `/categories/collections.astro` — not dynamic route
- No RLS on gauk-network tables (except `user_channels`, `gauk_sources`) — service role key server-side
- Credits deducted after successful AI calls, not before
- `usd_exchange_rate` stored in `site_settings` — display only, not dynamic
- PostHog installed in `Layout.astro` — covers all public pages
- `/explore` redirects 301 to `/` — content superseded by home page
- `pending_claims` table handles cross-browser identification claiming after email confirmation
