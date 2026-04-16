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

## Session Log
- Session 1: Scaffold — Astro 6, Tailwind v4, Node/Cloudflare dual adapter, pushed to GitHub
- Session 2: Supabase client connected and verified, R2 bucket created (gauk-antiques-images), wrangler project name fixed
- Session 3: Image upload pipeline complete — FormData upload via Worker to R2, deployed and tested in production
