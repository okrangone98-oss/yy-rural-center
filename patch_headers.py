import re
import os

with open('index.html', 'r', encoding='utf-8') as f:
    text = f.read()

header_idx = text.find('<header>')
header_end_idx = text.find('</header>') + len('</header>')
header_content = text[header_idx:header_end_idx]

def patch_file(filepath):
    if not os.path.exists(filepath):
        return

    with open(filepath, 'r', encoding='utf-8') as f:
        content = f.read()
    
    notice_head_idx = content.find('<header>')
    notice_head_end = content.find('</header>') + len('</header>')
    if notice_head_idx != -1:
        new_content = content[:notice_head_idx] + header_content + content[notice_head_end:]
        for anchor in ['#about', '#programs', '#teachers', '#gallery', '#video-preview', '#contact']:
            new_content = new_content.replace(f'href="{anchor}"', f'href="index.html{anchor}"')
            new_content = new_content.replace(f"location.href='{anchor}'", f"location.href='index.html{anchor}'")
        with open(filepath, 'w', encoding='utf-8') as f:
            f.write(new_content)
        print(f'Patched {filepath}')

patch_file('notice.html')
patch_file('qna.html')

