import re

path = '/users/hardone/gauk-antiques/src/pages/index.astro'

with open(path, 'r') as f:
    src = f.read()

original = src

# 1. Remove .site-header / .site-logo / .header-actions / .header-link CSS block
src = re.sub(
    r'\s*\.site-header \{[^}]+\}\s*\.site-header\.hidden \{[^}]+\}\s*\.site-logo \{[^}]+\}\s*\.site-logo span \{[^}]+\}\s*\.header-actions \{[^}]+\}\s*\.header-link \{[^}]+\}\s*\.header-link:hover \{[^}]+\}',
    '',
    src
)

# 2. Remove bottom nav CSS block (comment through last nav media query)
src = re.sub(
    r'\s*/\* ─── BOTTOM NAV ─── \*/\s*\.bottom-nav \{[^}]+\}\s*\.nav-tab \{[^}]+\}\s*\.nav-tab\.active, \.nav-tab:hover \{[^}]+\}\s*@media \(min-width: 768px\) \{ \.bottom-nav \{ display: none; \} \}\s*@media \(max-width: 767px\) \{ \.site-header \.header-actions \{ display: none; \} \}',
    '',
    src
)

# 3. Remove the mobile media query for site-header if it survived separately
src = re.sub(
    r'\s*@media \(max-width: 767px\) \{ \.site-header \.header-actions \{ display: none; \} \}',
    '',
    src
)

# 4. Remove the bottom nav HTML block
src = re.sub(
    r'\s*<nav class="bottom-nav">.*?</nav>',
    '',
    src,
    flags=re.DOTALL
)

# 5. Remove site-header JS (hide on login)
src = re.sub(
    r'\s*// Hide logged-out header\s*\n\s*const header = document\.getElementById\(\'site-header\'\) as HTMLElement\s*\n\s*if \(header\) header\.classList\.add\(\'hidden\'\)\s*\n',
    '\n',
    src
)

# 6. Remove account-tab JS (now handled in PublicShell)
src = re.sub(
    r'\s*const accountTab = document\.getElementById\(\'account-tab\'\)\s*\n\s*if \(accountTab\) accountTab\.setAttribute\(\'href\', \'/account\'\)\s*\n',
    '\n',
    src
)

if src == original:
    print('WARNING: No changes made — patterns may not have matched.')
else:
    with open(path, 'w') as f:
        f.write(src)
    print('Done. index.astro patched successfully.')
