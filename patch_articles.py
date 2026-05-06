path = '/users/hardone/gauk-antiques/src/pages/articles.astro'

with open(path, 'r') as f:
    src = f.read()

original = src

# Fix 1 — hero content padding
src = src.replace(
    '.art-idx-hero-content { position: relative; z-index: 2; width: 100%; max-width: 1100px; margin: 0 auto; padding: 60px 40px; }',
    '.art-idx-hero-content { position: relative; z-index: 2; width: 100%; max-width: 1100px; margin: 0 auto; padding: 60px 40px; }\n  @media (max-width: 767px) { .art-idx-hero-content { padding: 80px 16px 40px; } }'
)

# Fix 2 — 4-col latest grid: add mobile overrides
src = src.replace(
    '.art-latest-inner { max-width: 1100px; margin: 0 auto; display: grid; grid-template-columns: repeat(4,1fr); }',
    '.art-latest-inner { max-width: 1100px; margin: 0 auto; display: grid; grid-template-columns: repeat(4,1fr); }\n  @media (max-width: 767px) { .art-latest-inner { grid-template-columns: repeat(2,1fr); } }\n  @media (max-width: 400px) { .art-latest-inner { grid-template-columns: 1fr; } }'
)

# Fix 3 — category section padding
src = src.replace(
    '.art-cat-section { max-width: 1100px; margin: 0 auto; padding: 56px 40px; border-bottom: 1px solid #C4B49E; }',
    '.art-cat-section { max-width: 1100px; margin: 0 auto; padding: 56px 40px; border-bottom: 1px solid #C4B49E; }\n  @media (max-width: 767px) { .art-cat-section { padding: 40px 16px; } }'
)

# Fix 4 — CTA section padding
src = src.replace(
    '.art-idx-cta { background: #1C1810; padding: 56px 40px; text-align: center; }',
    '.art-idx-cta { background: #1C1810; padding: 56px 40px; text-align: center; }\n  @media (max-width: 767px) { .art-idx-cta { padding: 40px 16px; } }'
)

if src == original:
    print('WARNING: No changes made — patterns may not have matched.')
else:
    with open(path, 'w') as f:
        f.write(src)
    print('Done. articles.astro patched successfully.')
