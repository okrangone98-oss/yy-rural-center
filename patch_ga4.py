import os
import glob
import re

ga4_snippet = """
  <!-- Google tag (gtag.js) GA4 -->
  <script async src="https://www.googletagmanager.com/gtag/js?id=G-XXXXXXXXXX"></script>
  <script>
    window.dataLayer = window.dataLayer || [];
    function gtag(){dataLayer.push(arguments);}
    gtag('js', new Date());
    gtag('config', 'G-XXXXXXXXXX');
  </script>
</head>"""

html_files = glob.glob('*.html')

for filepath in html_files:
    # Skip admin.html if it exists, or don't. Admin tracking is optional but okay.
    with open(filepath, 'r', encoding='utf-8') as f:
        content = f.read()

    # If already has gtag, skip
    if 'googletagmanager.com/gtag' in content:
        continue

    # Insert right before </head>
    patched_content = content.replace('</head>', ga4_snippet)

    # Some files might have different casing, handle with regex if needed
    if '</head>' not in content:
        patched_content = re.sub(r'</head>', ga4_snippet, content, flags=re.IGNORECASE)

    with open(filepath, 'w', encoding='utf-8') as f:
        f.write(patched_content)
    
    print(f"Injected GA4 into {filepath}")
