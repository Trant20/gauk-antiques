path = '/users/hardone/gauk-antiques/src/pages/videos.astro'

with open(path, 'r') as f:
    src = f.read()
original = src

# Wrap the filter nav in a relative container with a fade gradient on the right
src = src.replace(
    '  .vid-filter { background: #1C1810; border-top: 1px solid rgba(255,255,255,.08); padding: 0 32px; display: flex; gap: 0; overflow-x: auto; scrollbar-width: none; }',
    '  .vid-filter-wrap { position: relative; background: #1C1810; border-top: 1px solid rgba(255,255,255,.08); }\n  .vid-filter-wrap::after { content: \'\'; position: absolute; top: 0; right: 0; bottom: 0; width: 60px; background: linear-gradient(to right, transparent, #1C1810); pointer-events: none; z-index: 1; }\n  .vid-filter { padding: 0 32px; display: flex; gap: 0; overflow-x: auto; scrollbar-width: none; }'
)

src = src.replace(
    '  .vid-filter::-webkit-scrollbar { display: none; }',
    '  .vid-filter::-webkit-scrollbar { display: none; }\n  @media (max-width: 767px) { .vid-filter { padding: 0 8px; } .vid-filter-link { padding: 14px 10px; font-size: 8px; } }'
)

# Remove the duplicate mobile media query for vid-filter that's now handled above
src = src.replace(
    '  @media (max-width: 767px) { .vid-filter { padding: 0 8px; } .vid-filter-link { padding: 14px 10px; font-size: 8px; } }\n  @media (max-width: 767px) { .vid-filter { padding: 0 8px; } .vid-filter-link { padding: 14px 10px; font-size: 8px; } }',
    '  @media (max-width: 767px) { .vid-filter { padding: 0 8px; } .vid-filter-link { padding: 14px 10px; font-size: 8px; } }'
)

# Wrap the nav element in the new container div
src = src.replace(
    '  <!-- CATEGORY FILTER -->\n  <nav class="vid-filter">',
    '  <!-- CATEGORY FILTER -->\n  <div class="vid-filter-wrap">\n  <nav class="vid-filter">'
)

src = src.replace(
    '  </nav>\n\n  <!-- CHANNELS STRIP',
    '  </nav>\n  </div>\n\n  <!-- CHANNELS STRIP'
)

if src == original:
    print('WARNING: No changes made — patterns may not have matched.')
else:
    with open(path, 'w') as f:
        f.write(src)
    print('Done. videos.astro patched.')
