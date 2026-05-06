path = '/users/hardone/gauk-antiques/src/pages/categories/[category].astro'

with open(path, 'r') as f:
    src = f.read()

original = src

# Fix 1 — reduce base side padding on hero content (40px → 20px, safe on all sizes)
src = src.replace(
    '.cat-hero-content { position: relative; z-index: 2; width: 100%; max-width: 800px; margin: 0 auto; padding: 60px 40px; text-align: center; }',
    '.cat-hero-content { position: relative; z-index: 2; width: 100%; max-width: 800px; margin: 0 auto; padding: 60px 20px; text-align: center; }'
)

# Fix 2 — add mobile overrides after .cat-hero-count rule
mobile_overrides = """
  @media (max-width: 767px) {
    .cat-hero-content { padding: 80px 16px 40px; }
    .cat-hero-title { font-size: clamp(28px,8vw,48px); }
    .cat-hero-sub { font-size: 15px; }
    .cat-anchor-nav { padding: 0 8px; }
    .cat-anchor-link { padding: 14px 12px; font-size: 8px; }
    .cat-section { padding: 48px 16px; }
  }"""

target = '  .cat-hero-count { font-family: \'Prata\', Georgia, serif; font-size: 10px; letter-spacing: 3px; text-transform: uppercase; color: #C8A060; margin-bottom: 32px; }'

if mobile_overrides.strip() not in src:
    src = src.replace(target, target + '\n' + mobile_overrides)

if src == original:
    print('WARNING: No changes made — patterns may not have matched.')
else:
    with open(path, 'w') as f:
        f.write(src)
    print('Done. [category].astro patched successfully.')
