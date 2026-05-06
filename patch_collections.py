path = '/users/hardone/gauk-antiques/src/pages/categories/collections.astro'

with open(path, 'r') as f:
    src = f.read()

original = src

# Fix 1 — hero content padding
src = src.replace(
    '.col-hero-content { position: relative; z-index: 2; width: 100%; max-width: 800px; margin: 0 auto; padding: 60px 40px; text-align: center; }',
    '.col-hero-content { position: relative; z-index: 2; width: 100%; max-width: 800px; margin: 0 auto; padding: 60px 40px; text-align: center; }\n  @media (max-width: 767px) { .col-hero-content { padding: 80px 16px 40px; } }'
)

# Fix 2 — stats grid: 3-col has no mobile override
src = src.replace(
    '.col-stats { display: grid; grid-template-columns: repeat(3,1fr); gap: 12px; margin-bottom: 24px; }',
    '.col-stats { display: grid; grid-template-columns: repeat(3,1fr); gap: 12px; margin-bottom: 24px; }\n  @media (max-width: 480px) { .col-stats { grid-template-columns: 1fr; gap: 8px; } }'
)

if src == original:
    print('WARNING: No changes made — patterns may not have matched.')
else:
    with open(path, 'w') as f:
        f.write(src)
    print('Done. collections.astro patched successfully.')
