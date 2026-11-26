"""Inline src/ into site/index.html (standalone) and, optionally, an Artifact body fragment."""
import pathlib, sys
root = pathlib.Path(__file__).resolve().parent.parent
page = (root / 'src/page.html').read_text()
page = page.replace('/*@garments*/', (root.parent / 'concepts/src/garments.js').read_text())
page = page.replace('/*@app*/', (root / 'src/app.js').read_text())
cut = page.index('</style>') + len('</style>')
doc = ('<!doctype html>\n<html lang="en">\n<head>\n<meta charset="utf-8">\n'
       '<meta name="viewport" content="width=device-width, initial-scale=1, viewport-fit=cover">\n'
       + page[:cut] + '\n</head>\n<body>' + page[cut:] + '</body>\n</html>\n')
(root / 'index.html').write_text(doc)
if len(sys.argv) > 1:
    pathlib.Path(sys.argv[1]).write_text(page)
print('built', len(doc) // 1024, 'KB')
