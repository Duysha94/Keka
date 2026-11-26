/* KEKA garment flats.
   Technical flats drawn from TRACE (2026) and Tudor (AW25-26) runway looks.
   Each garment renders into a 200 x 420 viewBox; the hanger hook tip sits at (100, 4)
   and the shoulder line at y ~ 56. */
(function () {
  const W = 200, CX = 100;

  // --- path helpers --------------------------------------------------------
  // A half-outline is a list of points on the LEFT side, from the top centre,
  // down and around to the bottom centre. A point is [x, y] or
  // ['q', cx, cy, x, y] (quadratic curve from the previous point).
  function mx(x) { return 2 * CX - x; }
  function sym(half) {
    const pts = half.map(p => (p[0] === 'q' ? p : ['l', p[0], p[1]]));
    let d = `M${pts[0][1]},${pts[0][2]}`;
    for (let i = 1; i < pts.length; i++) {
      const p = pts[i];
      d += p[0] === 'q' ? ` Q${p[1]},${p[2]} ${p[3]},${p[4]}` : ` L${p[1]},${p[2]}`;
    }
    // walk back up the mirrored side
    for (let i = pts.length - 1; i > 0; i--) {
      const p = pts[i], prev = pts[i - 1];
      const px = prev[0] === 'q' ? prev[3] : prev[1];
      const py = prev[0] === 'q' ? prev[4] : prev[2];
      d += p[0] === 'q' ? ` Q${mx(p[1])},${p[2]} ${mx(px)},${py}` : ` L${mx(px)},${py}`;
    }
    return d + ' Z';
  }
  function both(fn) { return fn(false) + fn(true); }
  const X = (x, m) => (m ? mx(x) : x);

  function shade(hex, k) {
    const n = parseInt(hex.slice(1), 16);
    let r = (n >> 16) & 255, g = (n >> 8) & 255, b = n & 255;
    const f = c => Math.max(0, Math.min(255, Math.round(k < 0 ? c * (1 + k) : c + (255 - c) * k)));
    return '#' + [f(r), f(g), f(b)].map(v => v.toString(16).padStart(2, '0')).join('');
  }

  // --- patterns --------------------------------------------------------------
  function patternDefs(id, g) {
    const c = g.color, line = g.line;
    switch (g.pattern) {
      case 'tartan':
        return `<pattern id="${id}" width="28" height="28" patternUnits="userSpaceOnUse">
          <rect width="28" height="28" fill="${c}"/>
          <rect y="9" width="28" height="7" fill="${g.c2}" opacity=".55"/>
          <rect x="9" width="7" height="28" fill="${g.c2}" opacity=".55"/>
          <rect y="21" width="28" height="1.2" fill="${g.c3}" opacity=".9"/>
          <rect x="21" width="1.2" height="28" fill="${g.c3}" opacity=".9"/>
          <rect y="3" width="28" height="2" fill="${shade(c, -0.35)}" opacity=".6"/>
          <rect x="3" width="2" height="28" fill="${shade(c, -0.35)}" opacity=".6"/>
        </pattern>`;
      case 'pinstripe':
        return `<pattern id="${id}" width="7" height="10" patternUnits="userSpaceOnUse">
          <rect width="7" height="10" fill="${c}"/><rect x="3" width=".9" height="10" fill="${g.c2}" opacity=".8"/></pattern>`;
      case 'check':
        return `<pattern id="${id}" width="8" height="8" patternUnits="userSpaceOnUse">
          <rect width="8" height="8" fill="${c}"/><rect width="4" height="4" fill="${g.c2}" opacity=".45"/>
          <rect x="4" y="4" width="4" height="4" fill="${g.c2}" opacity=".45"/></pattern>`;
      case 'sequin':
        return `<pattern id="${id}" width="6" height="5.2" patternUnits="userSpaceOnUse">
          <rect width="6" height="5.2" fill="${c}"/><circle cx="1.5" cy="1.3" r="1.25" fill="${g.c2}"/>
          <circle cx="4.5" cy="3.9" r="1.25" fill="${g.c2}"/><circle cx="1.1" cy="1" r=".4" fill="#fff" opacity=".55"/>
          <circle cx="4.1" cy="3.6" r=".4" fill="#fff" opacity=".55"/></pattern>`;
      case 'corset':
        return `<pattern id="${id}" width="26" height="20" patternUnits="userSpaceOnUse">
          <rect width="26" height="20" fill="${c}"/><path d="M0 0 L26 20 M26 0 L0 20" stroke="${g.c3}" stroke-width=".5" opacity=".7"/></pattern>`;
      default:
        return '';
    }
  }

  // --- building blocks -----------------------------------------------------
  // Jacket / coat / shirt outline from a few proportions.
  function topOutline(o) {
    const ny = o.neckY ?? 50;
    const sh = [CX - o.shoulder, ny + (o.drop ?? 12)];
    const sleeveTopOut = [sh[0] - (o.capOut ?? 6), sh[1] + 12];
    const cuffOut = [CX - o.shoulder - o.spread, o.sleeveEnd];
    const cuffIn = [cuffOut[0] + o.cuff, o.sleeveEnd + 2];
    const arm = [CX - o.body, o.armY];
    const half = [
      [CX, ny + (o.backNeck ?? 2)],
      [CX - o.neck, ny - 2],
      sh,
      sleeveTopOut,
    ];
    if (o.balloon) half.push(['q', cuffOut[0] - o.balloon, (sleeveTopOut[1] + cuffOut[1]) / 2, cuffOut[0], cuffOut[1]]);
    else half.push(cuffOut);
    half.push(cuffIn);
    if (o.balloon) half.push(['q', cuffIn[0] + o.balloon * 0.2, (cuffIn[1] + arm[1]) / 2 + 10, arm[0], arm[1]]);
    else half.push(arm);
    if (o.waistY) half.push([CX - o.waist, o.waistY]);
    half.push([CX - o.hem, o.hemY]);
    if (o.hemCurve) half.push(['q', CX - o.hem * 0.5, o.hemY + o.hemCurve, CX, o.hemY + o.hemCurve * 0.6]);
    else half.push([CX, o.hemY + (o.hemDip ?? 2)]);
    return { d: sym(half), cuffOut, cuffIn, arm, sh, ny };
  }

  function buttons(xs, ys, r, fill, stroke) {
    let s = '';
    for (const y of ys) for (const x of xs) s += `<circle cx="${x}" cy="${y}" r="${r}" fill="${fill}" stroke="${stroke}" stroke-width=".8"/>`;
    return s;
  }
  function cuffLine(t, line, offset = 14) {
    return both(m => {
      const a = t.cuffOut, b = t.cuffIn;
      return `<path d="M${X(a[0] + 1, m)},${a[1] - offset} L${X(b[0] + 1, m)},${b[1] - offset}" stroke="${line}" fill="none"/>`;
    });
  }

  // --- garments --------------------------------------------------------------
  const DRAW = {
    trench(g, F) {
      const t = topOutline({ neck: 16, shoulder: 60, drop: 13, spread: 12, sleeveEnd: 262, cuff: 28, body: 47, armY: 118, waist: 47, waistY: 196, hem: 66, hemY: 398, hemDip: 2 });
      const L = g.line;
      const lapel = both(m => `<path d="M${X(84, m)},48 L${X(58, m)},70 L${X(66, m)},82 L${X(58, m)},96 L${X(m ? 88 : 112, m)},${m ? 156 : 150}" fill="${F}" stroke="${L}"/>`);
      return `<path d="${t.d}" fill="${F}" stroke="${L}"/>
        <path d="M112,150 L112,398" stroke="${L}" fill="none"/>
        ${lapel}
        <path d="M100,52 L84,48 L100,64 L116,48 Z" fill="${shade(g.color, -0.25)}" stroke="${L}"/>
        ${both(m => `<path d="M${X(62, m)},66 L${X(44, m)},72 L${X(46, m)},80 L${X(64, m)},74 Z" fill="${F}" stroke="${L}"/>`)}
        ${cuffLine(t, L, 22)}
        <rect x="${CX - 50}" y="186" width="100" height="14" fill="${F}" stroke="${L}"/>
        <rect x="70" y="183" width="16" height="20" rx="1.5" fill="none" stroke="${g.hardware || L}" stroke-width="2"/>
        <path d="M150,193 Q166,210 158,236" stroke="${L}" fill="${F}" stroke-width="7" stroke-linecap="round" opacity=".9"/>
        ${buttons([92, 132], [116, 140, 166], 3.2, g.hardware || shade(g.color, -0.4), L)}
        ${both(m => `<path d="M${X(60, m)},248 L${X(70, m)},300" stroke="${L}" fill="none"/>`)}
        <path d="M100,212 L100,398" stroke="${L}" opacity=".5" stroke-dasharray="3 3" fill="none"/>`;
    },
    coat(g, F) { // double-breasted long coat, peak lapels
      const t = topOutline({ neck: 15, shoulder: 58, drop: 10, spread: 10, sleeveEnd: 258, cuff: 28, body: 46, armY: 116, waist: 46, waistY: 200, hem: 58, hemY: 394 });
      const L = g.line;
      const lapel = both(m => `<path d="M${X(85, m)},47 L${X(56, m)},74 L${X(48, m)},70 L${X(56, m)},94 L${X(m ? 90 : 110, m)},${m ? 172 : 168}" fill="${F}" stroke="${L}"/>`);
      return `<path d="${t.d}" fill="${F}" stroke="${L}"/>
        <path d="M100,52 L85,47 L100,62 L115,47 Z" fill="${shade(g.color, -0.3)}" stroke="${L}"/>
        ${lapel}
        <path d="M110,168 L110,394" stroke="${L}" fill="none"/>
        ${buttons([86, 128], [180, 216, 252], 3.4, shade(g.color, -0.45), L)}
        ${both(m => `<path d="M${X(52, m)},262 L${X(82, m)},262" stroke="${L}" fill="none"/><path d="M${X(52, m)},262 L${X(52, m)},268 L${X(82, m)},268 L${X(82, m)},262" fill="${F}" stroke="${L}"/>`)}
        ${cuffLine(t, L, 18)}`;
    },
    jacket(g, F) { // tailored, double-breasted, slightly cropped
      const len = g.cropped ? 214 : 246;
      const t = topOutline({ neck: 15, shoulder: g.cropped ? 62 : 58, drop: 9, spread: 8, sleeveEnd: g.cropped ? 252 : 250, cuff: 27, body: 47, armY: 116, waist: 45, waistY: 180, hem: 49, hemY: len });
      const L = g.line;
      const collar = g.cropped
        ? both(m => `<path d="M${X(84, m)},47 L${X(48, m)},70 L${X(46, m)},96 L${X(m ? 92 : 108, m)},134" fill="${F}" stroke="${L}"/>`)
        : both(m => `<path d="M${X(85, m)},47 L${X(60, m)},72 L${X(68, m)},80 L${X(58, m)},92 L${X(m ? 92 : 108, m)},${m ? 150 : 146}" fill="${F}" stroke="${L}"/>`);
      return `<path d="${t.d}" fill="${F}" stroke="${L}"/>
        <path d="M100,52 L85,47 L100,62 L115,47 Z" fill="${shade(g.color, -0.35)}" stroke="${L}"/>
        ${collar}
        <path d="M108,${g.cropped ? 134 : 146} L108,${len}" stroke="${L}" fill="none"/>
        ${buttons([88, 126], g.cropped ? [150, 178] : [160, 196], 3.2, shade(g.color, -0.5), L)}
        ${g.cropped ? '' : both(m => `<path d="M${X(56, m)},210 L${X(84, m)},210" stroke="${L}" fill="none"/>`)}
        ${both(m => `<path d="M${X(64, m)},112 L${X(80, m)},112" stroke="${L}" fill="none"/>`)}
        ${cuffLine(t, L, 16)}`;
    },
    waistcoat(g, F) {
      const L = g.line;
      const d = sym([[100, 56], [84, 48], [62, 58], ['q', 66, 92, 54, 112], [55, 214], [76, 232], [100, 222]]);
      return `<path d="M84,48 Q100,58 116,48 L116,60 Q100,70 84,60 Z" fill="${shade(g.color, -0.35)}" stroke="${L}"/>
        <path d="${d}" fill="${F}" stroke="${L}"/>
        ${both(m => `<path d="M${X(84, m)},48 L${X(m ? 92 : 108, m)},150" stroke="${L}" fill="none"/>`)}
        <path d="M108,150 L108,226" stroke="${L}" fill="none"/>
        ${buttons([90, 126], [162, 186, 208], 2.8, shade(g.color, -0.5), L)}
        ${both(m => `<path d="M${X(62, m)},196 L${X(82, m)},194" stroke="${L}" fill="none"/>`)}`;
    },
    knit(g, F) { // oversized drop-shoulder crew
      const t = topOutline({ neck: 18, shoulder: 70, drop: 26, capOut: 4, spread: 6, sleeveEnd: 278, cuff: 30, body: 64, armY: 150, hem: 66, hemY: 250, hemDip: 0 });
      const L = g.line;
      let ribs = '';
      for (let x = 38; x <= 162; x += 5) ribs += `<path d="M${x},234 L${x},252" stroke="${L}" opacity=".55"/>`;
      let cuffRibs = '';
      both(m => { for (let k = 0; k < 6; k++) { const x0 = t.cuffOut[0] + 3 + k * 4.6; cuffRibs += `<path d="M${X(x0, m)},${t.cuffOut[1] - 16} L${X(x0 + 1, m)},${t.cuffOut[1]}" stroke="${L}" opacity=".55"/>`; } return ''; });
      return `<path d="${t.d}" fill="${F}" stroke="${L}"/>
        <path d="M82,48 Q100,66 118,48 Q100,58 82,48 Z" fill="${shade(g.color, -0.35)}"/>
        <path d="M82,48 Q100,70 118,48" stroke="${L}" fill="none"/><path d="M78,47 Q100,76 122,47" stroke="${L}" fill="none"/>
        <path d="M34,234 L166,234" stroke="${L}" fill="none"/>${ribs}${cuffRibs}
        ${both(m => `<path d="M${X(34, m)},76 Q${X(40, m)},120 ${X(36, m)},150" stroke="${L}" fill="none" opacity=".6"/>`)}`;
    },
    tank(g, F) {
      const L = g.line;
      const d = sym([[100, 92], ['q', 84, 92, 76, 50], [66, 50], ['q', 66, 96, 50, 116], [52, 252], [100, 256]]);
      return `<path d="${d}" fill="${F}" stroke="${L}"/>
        <path d="M76,50 Q84,96 100,96 Q116,96 124,50" stroke="${L}" fill="none" opacity=".5"/>
        <path d="M52,240 L148,244" stroke="${L}" fill="none" opacity=".5"/>`;
    },
    shirt(g, F) { // organza shirt with balloon sleeves
      const t = topOutline({ neck: 14, shoulder: 54, drop: 14, spread: 18, sleeveEnd: 258, cuff: 24, body: 46, armY: 118, hem: 48, hemY: 262, hemCurve: 10, balloon: 26 });
      const L = g.line;
      return `<path d="${t.d}" fill="${F}" stroke="${L}"/>
        <path d="M100,56 L100,268" stroke="${L}" fill="none"/>
        ${buttons([104], [80, 112, 144, 176, 208, 240], 2.1, '#fff', L)}
        ${both(m => `<path d="M${X(t.cuffOut[0], m)},${t.cuffOut[1] - 14} L${X(t.cuffIn[0], m)},${t.cuffIn[1] - 14}" stroke="${L}" fill="none"/>`)}
        ${ruffPath(100, 50, 30, 11, g.c2 || '#fff', L, 26)}`;
    },
    trouser(g, F) { // pleated wide trouser on a clip hanger
      const L = g.line;
      const wide = g.wide ?? 64;
      const d = sym([[100, 60], [52, 60], ['q', 46, 110, 48, 170], [100 - wide, 398], [100 - wide + 50, 400], [100, 176]]);
      let pleats = '';
      both(m => { pleats += `<path d="M${X(80, m)},74 L${X(74, m)},180" stroke="${L}" fill="none"/><path d="M${X(70, m)},74 L${X(62, m)},140" stroke="${L}" fill="none" opacity=".7"/>`; return ''; });
      return `<path d="${d}" fill="${F}" stroke="${L}"/>
        <rect x="52" y="60" width="96" height="14" fill="${F}" stroke="${L}"/>
        <path d="M100,74 L100,130" stroke="${L}" fill="none"/>
        ${pleats}
        ${both(m => `<path d="M${X(58, m)},76 Q${X(64, m)},92 ${X(54, m)},104" stroke="${L}" fill="none"/>`)}
        ${both(m => `<path d="M${X(100 - wide + 25, m)},180 L${X(100 - wide + 25, m)},398" stroke="${L}" opacity=".35" fill="none"/>`)}`;
    },
    culotte(g, F) { // stitched-pleat culottes that read as a skirt
      const L = g.line;
      const d = sym([[100, 60], [56, 60], ['q', 46, 130, 30, 300], [100, 304]]);
      let pleats = '';
      for (let k = -3; k <= 3; k++) {
        const x0 = 100 + k * 12, x1 = 100 + k * 22;
        pleats += `<path d="M${x0},74 L${x0},130" stroke="${L}" stroke-dasharray="2.4 2" fill="none"/><path d="M${x0},130 L${x1},302" stroke="${L}" fill="none" opacity=".75"/>`;
      }
      return `<path d="${d}" fill="${F}" stroke="${L}"/>
        <rect x="56" y="60" width="88" height="14" fill="${F}" stroke="${L}"/>${pleats}
        <path d="M30,300 Q100,314 170,300" stroke="${L}" fill="none" opacity=".5"/>`;
    },
    corset(g, F) {
      const L = g.line;
      const d = sym([[100, 104], ['q', 92, 84, 78, 82], ['q', 62, 82, 56, 96], ['q', 66, 160, 62, 220], [100, 252]]);
      let bones = '';
      for (const x of [66, 78, 90, 110, 122, 134]) bones += `<path d="M${x},${86 + Math.abs(100 - x) * 0.08} Q${x + (x < 100 ? 3 : -3)},170 ${x + (x < 100 ? 5 : -5)},${236 - Math.abs(100 - x) * 0.55}" stroke="${g.c2}" stroke-width="2.2" fill="none"/>`;
      return `${both(m => `<path d="M${X(70, m)},40 L${X(72, m)},84" stroke="${L}" stroke-width="1.4" fill="none"/>`)}
        <path d="${d}" fill="${F}" stroke="${L}"/>${bones}
        <path d="M100,104 L100,252" stroke="${L}" fill="none"/>`;
    },
    pinafore(g, F) { // satin pinafore dress with straps and a full skirt
      const L = g.line;
      const d = sym([[100, 112], [72, 112], [70, 200], ['q', 40, 300, 22, 392], ['q', 60, 404, 100, 402]]);
      let folds = '';
      for (const [a, b] of [[80, 54], [90, 76], [110, 124], [120, 146]]) folds += `<path d="M${a},214 Q${(a + b) / 2},300 ${b},398" stroke="${L}" fill="none" opacity=".45"/>`;
      return `${both(m => `<path d="M${X(66, m)},42 L${X(74, m)},112" stroke="${L}" stroke-width="5" stroke-linecap="round" fill="none"/>`)}
        <path d="${d}" fill="${F}" stroke="${L}"/>
        <path d="M70,200 Q100,208 130,200" stroke="${L}" fill="none"/>${folds}
        <path d="M84,140 L116,140" stroke="${L}" fill="none" opacity=".4"/>`;
    },
    ruff(g, F) {
      return ruffPath(100, 120, 72, 22, F, g.line, 34) +
        `<circle cx="100" cy="120" r="44" fill="none" stroke="${g.line}" stroke-dasharray="3 3" opacity=".5"/>
         <path d="M100,4 L100,50" stroke="${g.line}" stroke-width="1.6" fill="none"/>`;
    },
  };

  // A pleated ruff: a scalloped ring drawn as a ring of overlapping arcs.
  function ruffPath(cx, cy, r, depth, fill, line, n) {
    let outer = '';
    for (let i = 0; i < n; i++) {
      const a0 = (i / n) * Math.PI * 2, a1 = ((i + 1) / n) * Math.PI * 2, am = (a0 + a1) / 2;
      const p0 = [cx + Math.cos(a0) * r, cy + Math.sin(a0) * r * 0.62];
      const p1 = [cx + Math.cos(a1) * r, cy + Math.sin(a1) * r * 0.62];
      const c = [cx + Math.cos(am) * (r + depth * 0.5), cy + Math.sin(am) * (r + depth * 0.5) * 0.62];
      outer += (i === 0 ? `M${p0[0].toFixed(1)},${p0[1].toFixed(1)}` : '') + ` Q${c[0].toFixed(1)},${c[1].toFixed(1)} ${p1[0].toFixed(1)},${p1[1].toFixed(1)}`;
    }
    let folds = '';
    for (let i = 0; i < n; i++) {
      const a = (i / n) * Math.PI * 2;
      folds += `M${(cx + Math.cos(a) * (r - depth)).toFixed(1)},${(cy + Math.sin(a) * (r - depth) * 0.62).toFixed(1)} L${(cx + Math.cos(a) * r).toFixed(1)},${(cy + Math.sin(a) * r * 0.62).toFixed(1)} `;
    }
    const inner = `M${cx - (r - depth)},${cy} a${r - depth},${(r - depth) * 0.62} 0 1,0 ${2 * (r - depth)},0 a${r - depth},${(r - depth) * 0.62} 0 1,0 ${-2 * (r - depth)},0`;
    return `<path d="${outer} Z ${inner}" fill="${fill}" fill-rule="evenodd" stroke="${line}"/>
      <path d="${folds}" stroke="${line}" opacity=".55" fill="none"/>`;
  }

  // --- hangers ---------------------------------------------------------------
  const HANGERS = {
    // dry-cleaner wire hanger with a paper shoulder guard
    wire(kind) {
      const hook = `<path d="M100,52 L100,30 Q100,8 88,8 Q78,8 78,18" fill="none" stroke="var(--hanger-wire, #9aa3ab)" stroke-width="2.4" stroke-linecap="round"/>`;
      if (kind === 'bottom') return hook + `<path d="M40,60 L160,60" stroke="var(--hanger-wire, #9aa3ab)" stroke-width="2.4"/>
        <path d="M40,60 L40,70 M160,60 L160,70" stroke="var(--hanger-wire, #9aa3ab)" stroke-width="2.4"/>`;
      return hook + `<path d="M100,46 L34,72 L166,72 Z" fill="none" stroke="var(--hanger-wire, #9aa3ab)" stroke-width="2.4" stroke-linejoin="round"/>`;
    },
    guard() { // printed paper shoulder guard (front layer)
      return `<path d="M100,44 L30,70 L36,82 L100,58 L164,82 L170,70 Z" fill="var(--guard-paper, #f4f1ea)" stroke="var(--guard-edge, #c9c2b6)" stroke-width=".8"/>
        <text x="66" y="70" transform="rotate(-20 66 70)" font-size="7.5" font-weight="700" letter-spacing="1.5" fill="var(--guard-ink, #1b1f2a)" font-family="var(--font-sign, sans-serif)">KEKA</text>
        <text x="122" y="56" transform="rotate(20 122 56)" font-size="6" letter-spacing="1" fill="var(--guard-ink, #1b1f2a)" font-family="var(--font-sign, sans-serif)">IN CARE</text>`;
    },
    wood(kind) {
      const hook = `<path d="M100,46 L100,28 Q100,8 86,8 Q76,8 76,18" fill="none" stroke="var(--hanger-hook, #b08d57)" stroke-width="2.6" stroke-linecap="round"/>`;
      if (kind === 'bottom') return hook + `<rect x="36" y="46" width="128" height="9" rx="3" fill="var(--hanger-wood, #7a5536)"/>
        <rect x="44" y="52" width="10" height="16" rx="2" fill="var(--hanger-hook, #b08d57)"/><rect x="146" y="52" width="10" height="16" rx="2" fill="var(--hanger-hook, #b08d57)"/>`;
      return hook + `<path d="M100,44 Q60,50 26,70 Q24,76 30,76 Q64,60 100,56 Q136,60 170,76 Q176,76 174,70 Q140,50 100,44 Z" fill="var(--hanger-wood, #7a5536)"/>`;
    },
    black(kind) {
      const hook = `<path d="M100,46 L100,28 Q100,8 86,8 Q76,8 76,18" fill="none" stroke="var(--hanger-hook, #1a1a1a)" stroke-width="2.6" stroke-linecap="round"/>`;
      if (kind === 'bottom') return hook + `<rect x="38" y="46" width="124" height="8" rx="2" fill="var(--hanger-body, #121212)"/>
        <rect x="46" y="52" width="9" height="15" fill="var(--hanger-body, #121212)"/><rect x="145" y="52" width="9" height="15" fill="var(--hanger-body, #121212)"/>`;
      return hook + `<path d="M100,44 L28,70 L30,76 L100,54 L170,76 L172,70 Z" fill="var(--hanger-body, #121212)"/>`;
    },
  };

  const BOTTOM = new Set(['trouser', 'culotte']);

  let uid = 0;
  function svg(g, opts = {}) {
    const id = `kp${uid++}`;
    const defs = patternDefs(id, g);
    const F = defs ? `url(#${id})` : g.color;
    const style = opts.hanger || 'wood';
    const kind = BOTTOM.has(g.type) ? 'bottom' : 'top';
    const body = DRAW[g.type](g, F);
    const sheer = g.sheer ? ` fill-opacity="${g.sheer}"` : '';
    const back = g.type === 'ruff' ? '' : HANGERS[style](kind);
    const front = style === 'wire' && kind === 'top' && g.type !== 'ruff' && !opts.noGuard ? HANGERS.guard() : '';
    return `<svg viewBox="0 0 ${W} 420" xmlns="http://www.w3.org/2000/svg" role="img" aria-label="${g.name}" class="flat">
      <defs>${defs}</defs>${back}
      <g stroke-width="1.1" stroke-linejoin="round" stroke-linecap="round"${sheer}>${body}</g>${front}</svg>`;
  }

  // --- catalogue -------------------------------------------------------------
  // Sample catalogue drawn from runway looks. Names describe the piece; prices are samples.
  const CATALOG = [
    { id: 'belted-trench', ticket: 101, name: 'Belted Trench', type: 'trench', cat: 'Outerwear', collection: 'TRACE', color: '#4b2834', line: '#26121a', hardware: '#1c0d12', fabric: 'Wool gabardine', price: 890, look: 'photo-209' },
    { id: 'organza-trench', ticket: 102, name: 'Organza Trench', type: 'trench', cat: 'Outerwear', collection: 'TRACE', color: '#f1ece0', line: '#a89f8c', hardware: '#b38a3c', sheer: 0.62, fabric: 'Matte organza', price: 760, look: 'photo-229' },
    { id: 'tartan-jacket', ticket: 103, name: 'Tartan Double-Breasted Jacket', type: 'jacket', cat: 'Tailoring', collection: 'TRACE', color: '#1f3a33', c2: '#0f1d33', c3: '#6d7f56', line: '#0b1512', pattern: 'tartan', fabric: 'Wool tartan', price: 640, look: 'photo-226' },
    { id: 'pinstripe-trouser', ticket: 104, name: 'Pinstripe Pleated Trouser', type: 'trouser', cat: 'Trousers', collection: 'TRACE', color: '#1c2638', c2: '#9aa6bf', line: '#0c121d', pattern: 'pinstripe', wide: 66, fabric: 'Wool', price: 380, look: 'photo-214' },
    { id: 'cropped-jacket', ticket: 105, name: 'Cropped Jacket', type: 'jacket', cropped: true, cat: 'Tailoring', collection: 'TRACE', color: '#7a1f2e', line: '#3b0c15', fabric: 'Wool', price: 560, look: 'photo-224' },
    { id: 'tudor-corset', ticket: 106, name: 'Tudor Corset', type: 'corset', cat: 'Tops', collection: 'Tudor', color: '#efe7d6', c2: '#5c5148', c3: '#b9ad97', line: '#7b705f', pattern: 'corset', fabric: 'Cotton', price: 420, look: 'DSC02726' },
    { id: 'db-coat', ticket: 107, name: 'Double-Breasted Coat', type: 'coat', cat: 'Outerwear', collection: 'TRACE', color: '#4a3326', line: '#21150e', fabric: 'Wool', price: 980, look: 'photo-225' },
    { id: 'oversized-knit', ticket: 108, name: 'Oversized Knit', type: 'knit', cat: 'Knitwear', collection: 'TRACE', color: '#173e52', line: '#0a2130', fabric: 'Wool knit', price: 340, look: 'photo-210' },
    { id: 'organza-ruff', ticket: 109, name: 'Organza Ruff', type: 'ruff', cat: 'Accessories', collection: 'Tudor', color: '#fbfaf6', line: '#a8b3bd', fabric: 'Organza', price: 180, look: 'DSC02600' },
    { id: 'check-waistcoat', ticket: 110, name: 'Check Waistcoat', type: 'waistcoat', cat: 'Tailoring', collection: 'TRACE', color: '#8f949a', c2: '#3c4148', line: '#3b3f45', pattern: 'check', fabric: 'Wool check', price: 290, look: 'photo-220' },
    { id: 'sequin-tank', ticket: 111, name: 'Sequin Tank', type: 'tank', cat: 'Tops', collection: 'TRACE', color: '#3a2618', c2: '#7d5a3a', line: '#1d120a', pattern: 'sequin', fabric: 'Sequin knit', price: 310, look: 'photo-214' },
    { id: 'balloon-shirt', ticket: 112, name: 'Balloon-Sleeve Shirt', type: 'shirt', cat: 'Tops', collection: 'Tudor', color: '#f6f3ee', c2: '#c8302c', line: '#9d978c', sheer: 0.78, fabric: 'Cotton organza', price: 360, look: 'DSC02596' },
    { id: 'pleat-culotte', ticket: 113, name: 'Stitched-Pleat Culotte', type: 'culotte', cat: 'Trousers', collection: 'TRACE', color: '#16181d', line: '#000000', fabric: 'Wool', price: 340, look: 'photo-222' },
    { id: 'satin-pinafore', ticket: 114, name: 'Satin Pinafore Dress', type: 'pinafore', cat: 'Dresses', collection: 'Tudor', color: '#2c2a2b', line: '#0e0d0e', fabric: 'Satin', price: 520, look: 'DSC02744' },
  ];
  // lines for very dark pieces must stay visible on dark fills
  for (const g of CATALOG) if (!g.line) g.line = shade(g.color, -0.5);

  window.KEKA = { CATALOG, svg, shade };
})();
