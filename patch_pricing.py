path = '/users/hardone/gauk-antiques/src/pages/pricing.astro'

with open(path, 'r') as f:
    src = f.read()

original = src

# Fix — plan-card: allow wrap on mobile so price doesn't squeeze against name
src = src.replace(
    '.plan-card { background: #E6DCCB; border: 1px solid #C4B49E; padding: 28px 24px; margin-bottom: 12px; display: flex; align-items: center; justify-content: space-between; gap: 20px; }',
    '.plan-card { background: #E6DCCB; border: 1px solid #C4B49E; padding: 28px 24px; margin-bottom: 12px; display: flex; align-items: center; justify-content: space-between; gap: 20px; }\n  @media (max-width: 480px) { .plan-card { flex-direction: column; align-items: flex-start; gap: 16px; } .plan-right { text-align: left; } }'
)

if src == original:
    print('WARNING: No changes made — pattern may not have matched.')
else:
    with open(path, 'w') as f:
        f.write(src)
    print('Done. pricing.astro patched successfully.')
