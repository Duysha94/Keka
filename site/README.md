# KEKA storefront (clean version)

The direction chosen after the three concepts in `../concepts`: one clear site in the owner's established style. The interface is black and white, colour comes only from the photography, and the type is Manrope, the font of the current keka.design.

Open `index.html` through a static server (`python3 -m http.server` in this folder). `media` is a link to `../concepts/media`.

Sections: full-screen runway film (separate desktop 16:9 and phone 9:16 files), the wardrobe (garments on hangers with names and prices, with Rail and Grid views and filters by type), product drawer with the full runway photo, size and add to bag, bag drawer, collections (TRACE, Tudor), about with the designer's quote, runway shows, and the newsletter footer.

Real material from keka.design: logo, brand copy, runway photography, show dates and links. Placeholders: product names, fabrics, prices (marked as samples) and checkout (disabled; the store is "coming soon").

Rebuild after editing `src/`:

```
python3 tools/build.py
```
