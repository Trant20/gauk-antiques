path = '/users/hardone/gauk-antiques/src/layouts/Layout.astro'

with open(path, 'r') as f:
    src = f.read()
original = src

# Add IBM Plex Mono to the Google Fonts link
src = src.replace(
    '<link href="https://fonts.googleapis.com/css2?family=Playfair+Display:ital,wght@0,400;0,500;1,400;1,500&family=Prata&display=swap" rel="stylesheet" />',
    '<link href="https://fonts.googleapis.com/css2?family=IBM+Plex+Mono:wght@400;500&family=Playfair+Display:ital,wght@0,400;0,500;1,400;1,500&family=Prata&display=swap" rel="stylesheet" />'
)

# Add --mono token to :root
src = src.replace(
    "        --display:  'Playfair Display', Didot, Georgia, serif;",
    "        --display:  'Playfair Display', Didot, Georgia, serif;\n        --mono:     'IBM Plex Mono', monospace;"
)

if src == original:
    print('WARNING: Layout.astro — no changes made.')
else:
    with open(path, 'w') as f:
        f.write(src)
    print('Done. Layout.astro patched.')
