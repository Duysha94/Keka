# KEKA, The Rail (concept)

A new structure for keka.design, not based on the current theme. White ground, black type; colour comes only from the runway photography. Font: Geist.

The whole site is one clothes rail:

1. The page opens on a full-screen runway film (16:9 on desktop, 9:16 on phones).
2. On scroll the film shrinks and hangs itself on the rail as its first piece.
3. Vertical scroll then carries the rail sideways: a TRACE disc (like a size divider on a shop rail), the TRACE pieces, a Tudor disc, the Tudor pieces, and the brand's hang-tag with "Clothing, as a language."
4. Under the rail, the name of whatever hangs at the centre line, with price and two actions: Fitting room and Add to look.
5. Fitting room: the full runway photo, sizes, "Add to your look", and "Wear it with" suggestions from the same collection.
6. Your look replaces the usual cart: the pieces you composed, the total, and "Notify me" until the store opens.
7. Index: every piece listed by collection, for visitors who prefer a list.
8. After the rail: the designer's quote, newsletter, links.

Reduced motion: no pinning and no film flight; the rail scrolls sideways on its own.

Placeholders: product names, fabrics and prices (marked as samples). Real: logo, runway photos, collection facts and quote from keka.design.

Open `index.html` through a static server (`python3 -m http.server` in this folder). Rebuild after editing `src/`: `python3 tools/build.py`.
