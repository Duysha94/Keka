"""Inline src/ into the deliverables.

concepts/index.html  standalone document (open locally or host anywhere)
<artifact path>      body fragment for the claude.ai Artifact viewer, which adds its own skeleton
"""
import pathlib, sys
root = pathlib.Path(__file__).resolve().parent.parent
page = (root / 'src/page.html').read_text()
page = page.replace('/*@garments*/', (root / 'src/garments.js').read_text())
page = page.replace('/*@app*/', (root / 'src/app.js').read_text())
head_end = page.index('</style>') + len('</style>')
head, body = page[:head_end], page[head_end:]
doc = ('<!doctype html>\n<html lang="en">\n<head>\n<meta charset="utf-8">\n'
       '<meta name="viewport" content="width=device-width, initial-scale=1, viewport-fit=cover">\n'
       + head + '\n</head>\n<body>' + body + '</body>\n</html>\n')
(root / 'index.html').write_text(doc)
if len(sys.argv) > 1:
    pathlib.Path(sys.argv[1]).write_text(page)
print('built', len(doc) // 1024, 'KB')
