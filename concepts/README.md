# KEKA site concepts

Three working prototypes for the new keka.design: brand site and store in one page, each opening on a full-screen film, with an interactive wardrobe rail, product sheets and a bag.

Open `index.html` through any static server (for example `python3 -m http.server` in this folder) and switch concepts with the pill at the bottom, or by hash:

| Hash | Concept | Idea |
|---|---|---|
| `#conveyor` | Conveyor | The shop is a garment-care conveyor: pieces hang in covers on a looping steel rail; call one to the counter by ticket number; tickets, stamp and LED counter. |
| `#backstage` | Backstage | The dressers' rail before a show: each look on a hanger with its look card and runway polaroid; the running order drives the rail. |
| `#showroom` | Showroom | The classic fashion-store version of the hanger trend: oak hangers on a brass rail, serif type, product drawer. |

## What is real and what is a placeholder

- Real, from keka.design: logo, brand copy, runway photography (TRACE 2026, Tudor AW25-26), show dates and news links.
- Placeholder: garment drawings (based on runway looks), product names, fabrics, prices (marked "sample"), sizes, checkout (disabled; the live store is "coming soon").
- Films: cut from the runway photographs by `tools/render_films.py`. Replace `media/*-desktop.mp4` (16:9) and `media/*-mobile.mp4` (9:16) with campaign footage; keep them muted H.264 so they autoplay on phones.

## Editing

Source lives in `src/` (`page.html`, `app.js`, `garments.js`). Rebuild `index.html` with:

```
python3 tools/build.py
```

The product list is `CATALOG` in `src/garments.js`. For production, the same rail can be fed from WooCommerce or Shopify product data, with product cut-out photos on transparent backgrounds in place of the drawings.
