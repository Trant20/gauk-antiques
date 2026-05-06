import re

# Fix learn/[slug].astro — breadcrumb padding
path_learn = '/users/hardone/gauk-antiques/src/pages/learn/[slug].astro'
with open(path_learn, 'r') as f:
    src = f.read()
original = src

src = src.replace(
    '.art-breadcrumb-inner { max-width: 800px; margin: 0 auto; padding: 12px 40px; display: flex; align-items: center; gap: 8px; flex-wrap: wrap; }',
    '.art-breadcrumb-inner { max-width: 800px; margin: 0 auto; padding: 12px 40px; display: flex; align-items: center; gap: 8px; flex-wrap: wrap; }\n  @media (max-width: 767px) { .art-breadcrumb-inner { padding: 12px 16px; } }'
)

if src == original:
    print('WARNING: learn/[slug].astro — no changes made.')
else:
    with open(path_learn, 'w') as f:
        f.write(src)
    print('Done. learn/[slug].astro patched.')

# Fix category/[slug]/articles.astro — hero, inner section, breadcrumb padding
path_cat = '/users/hardone/gauk-antiques/src/pages/category/[slug]/articles.astro'
with open(path_cat, 'r') as f:
    src = f.read()
original = src

# Hero content padding
src = src.replace(
    '.cat-art-hero-content { position: relative; z-index: 2; width: 100%; max-width: 1100px; margin: 0 auto; padding: 48px 40px; }',
    '.cat-art-hero-content { position: relative; z-index: 2; width: 100%; max-width: 1100px; margin: 0 auto; padding: 48px 40px; }\n  @media (max-width: 767px) { .cat-art-hero-content { padding: 80px 16px 32px; } }'
)

# Inner section padding
src = src.replace(
    '.cat-art-inner { max-width: 1100px; margin: 0 auto; padding: 56px 40px; }',
    '.cat-art-inner { max-width: 1100px; margin: 0 auto; padding: 56px 40px; }\n  @media (max-width: 767px) { .cat-art-inner { padding: 40px 16px; } }'
)

# Breadcrumb padding
src = src.replace(
    '.cat-art-breadcrumb-inner { max-width: 1100px; margin: 0 auto; padding: 12px 40px; display: flex; align-items: center; gap: 8px; }',
    '.cat-art-breadcrumb-inner { max-width: 1100px; margin: 0 auto; padding: 12px 40px; display: flex; align-items: center; gap: 8px; }\n  @media (max-width: 767px) { .cat-art-breadcrumb-inner { padding: 12px 16px; } }'
)

if src == original:
    print('WARNING: category/[slug]/articles.astro — no changes made.')
else:
    with open(path_cat, 'w') as f:
        f.write(src)
    print('Done. category/[slug]/articles.astro patched.')
