import pathlib, re
PUBLIC = pathlib.Path(r'e:\网站\sendafunupdate\public')
FILES = ['pricing.html', 'about.html', 'contact.html', 'terms.html', 'privacy.html', 'cookies.html']

PICKER_HTML = '''
      <!-- DOC §169: Top-bar permanent language selector (4 langs: EN/ES/FR/PT) -->
      <label for="safLangPicker" style="display:inline-flex;align-items:center;gap:0.35rem;font-size:0.9rem;color:#4b5563;white-space:nowrap;margin-left:0.9rem;" aria-label="Select your language">
        <span aria-hidden="true">🌐</span>
        <select id="safLangPicker"
                onchange="try{window.location.href='/api/lang/set?lang='+this.value}catch(e){}"
                style="min-height:40px;min-width:82px;padding:0.4rem 0.5rem;border-radius:0.6rem;border:1px solid rgba(148,163,184,0.5);background:rgba(255,255,255,0.9);color:#334155;font-size:0.86rem;-webkit-appearance:none;appearance:none;cursor:pointer;"
                aria-label="Choose language">
          <option value="en" selected>EN</option>
          <option value="es">ES</option>
          <option value="fr">FR</option>
          <option value="pt">PT</option>
        </select>
      </label>
'''

for name in FILES:
    fp = PUBLIC / name
    if not fp.exists():
        print(f'SKIP {name}: not found')
        continue
    html = fp.read_text(encoding='utf-8')
    if 'safLangPicker' in html:
        print(f'  OK   {name}: already has §169 picker (skipped)')
        continue
    # Find the nav structure: most pages have right-side links div with 3 links ending
    # with </div>\n</nav> or similar. We insert picker before the final </nav>.
    #
    # Common pattern in pricing/about/contact/...:
    #   <div style="display:flex;gap:0.9rem;...">
    #     <a ...>Pricing</a>
    #     <a ...>About</a>
    #     <a ...>Contact</a>
    #   </div>
    # </nav>
    # We inject PICKER_HTML right before the closing </nav> tag.
    m = re.search(r'(\s*)</nav>', html)
    if not m:
        print(f'FAIL {name}: could not find </nav> closing tag')
        continue
    # Insert picker whitespace-aware
    insert_pt = m.start()
    indent = m.group(1) if m.group(1) else '\n'
    new_html = html[:insert_pt] + PICKER_HTML + indent + '</nav>' + html[m.end():]
    fp.write_text(new_html, encoding='utf-8')
    print(f'  DONE {name}: injected §169 picker')
