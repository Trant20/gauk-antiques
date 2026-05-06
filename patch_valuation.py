path = '/users/hardone/gauk-antiques/src/pages/valuation/[id].astro'

with open(path, 'r') as f:
    src = f.read()

original = src

# Fix 1 — card-header: add mobile left padding to clear hamburger
src = src.replace(
    '  .card-header {\n    position: sticky; top: 0; z-index: 50;\n    display: flex; align-items: center; justify-content: space-between;\n    padding: 14px 20px;\n    background: rgba(239,231,217,.96); backdrop-filter: blur(16px);\n    border-bottom: 1px solid #C4B49E;\n  }',
    '  .card-header {\n    position: sticky; top: 0; z-index: 50;\n    display: flex; align-items: center; justify-content: space-between;\n    padding: 14px 20px;\n    background: rgba(239,231,217,.96); backdrop-filter: blur(16px);\n    border-bottom: 1px solid #C4B49E;\n  }\n  @media (max-width: 767px) { .card-header { padding-left: 56px; } }'
)

# Fix 2 — gauges: 2-column on mobile
src = src.replace(
    '  .gauges { display: grid; grid-template-columns: 1fr 1fr 1fr 1fr; gap: 12px; margin-bottom: 20px; }',
    '  .gauges { display: grid; grid-template-columns: 1fr 1fr 1fr 1fr; gap: 12px; margin-bottom: 20px; }\n  @media (max-width: 480px) { .gauges { grid-template-columns: 1fr 1fr; gap: 16px; } }'
)

# Fix 3 — sticky actions: add safe area inset for iPhone home indicator
src = src.replace(
    '  .sticky-actions {\n    position: fixed; bottom: 0; left: 0; right: 0; z-index: 100;\n    max-width: 100%; margin: 0 auto;\n    background: rgba(239,231,217,.96); backdrop-filter: blur(20px);\n    border-top: 1px solid #C4B49E;\n    padding: 12px 20px 24px;\n    display: flex; gap: 8px;\n  }',
    '  .sticky-actions {\n    position: fixed; bottom: 0; left: 0; right: 0; z-index: 100;\n    max-width: 100%; margin: 0 auto;\n    background: rgba(239,231,217,.96); backdrop-filter: blur(20px);\n    border-top: 1px solid #C4B49E;\n    padding: 12px 20px calc(24px + env(safe-area-inset-bottom));\n    display: flex; gap: 8px;\n  }'
)

if src == original:
    print('WARNING: No changes made — patterns may not have matched.')
else:
    with open(path, 'w') as f:
        f.write(src)
    print('Done. valuation/[id].astro patched successfully.')
