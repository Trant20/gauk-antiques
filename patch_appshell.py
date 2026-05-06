path = '/users/hardone/gauk-antiques/src/layouts/AppShell.astro'

with open(path, 'r') as f:
    src = f.read()

original = src

# Remove the duplicate snav-layout and snav-main rules from AppShell
# These are already defined in SideNav.astro
src = src.replace(
    '  .snav-layout { display: flex; min-height: 100vh; }\n  .snav-main { margin-left: 220px; flex: 1; min-width: 0; width: calc(100% - 220px); }\n  @media (max-width: 767px) { .snav-main { margin-left: 0; width: 100%; } }\n',
    ''
)

if src == original:
    print('WARNING: No changes made — pattern may not have matched.')
else:
    with open(path, 'w') as f:
        f.write(src)
    print('Done. AppShell.astro patched successfully.')
