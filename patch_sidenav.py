path = '/users/hardone/gauk-antiques/src/components/SideNav.astro'

with open(path, 'r') as f:
    src = f.read()

original = src

# 1. Change sidebar base from display:none to display:flex
#    Mobile overrides via transform:translateX(-100%) so it stays hidden there
src = src.replace(
    '    display: none; flex-direction: column;\n    transform: translateX(0);',
    '    display: flex; flex-direction: column;\n    transform: translateX(0);'
)

# 2. Remove .snav-sidebar.visible rule — no longer needed
src = src.replace(
    '  .snav-sidebar.visible { display: flex; }\n',
    ''
)

# 3. Remove the JS lines that manually show the sidebar
src = src.replace(
    "  sidebar.classList.add('visible')\n  sidebar.style.display = 'flex'\n",
    ''
)

if src == original:
    print('WARNING: No changes made — patterns may not have matched.')
else:
    with open(path, 'w') as f:
        f.write(src)
    print('Done. SideNav.astro patched successfully.')
