/* KEKA, The Rail.
   One rail carries everything: the runway film is hung on it first, collection dividers
   and garments follow, the brand's hang-tag closes it. Vertical scroll moves the rail. */
(() => {
  const { CATALOG, hangerSvg } = window.KEKA;
  const $ = (s, r = document) => r.querySelector(s);
  const $$ = (s, r = document) => [...r.querySelectorAll(s)];
  const RM = matchMedia('(prefers-reduced-motion: reduce)').matches;
  const money = n => '$' + n.toLocaleString('en-US');
  const esc = s => String(s).replace(/[&<>"]/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));
  const byId = id => CATALOG.find(g => g.id === id);
  const clamp = (v, a, b) => Math.max(a, Math.min(b, v));
  const ease = t => (t < .5 ? 4 * t * t * t : 1 - Math.pow(-2 * t + 2, 3) / 2);
  const SIZES = ['XS', 'S', 'M', 'L', 'XL'];
  const SHOWS = {
    TRACE: { title: 'TRACE', where: 'London Fashion Day, Season 7', when: '1 May 2026', text: 'Form, clarity of line and the quiet presence of memory. The trench coat is the key piece, from structured wool to matte organza.' },
    Tudor: { title: 'Tudor', where: 'London Fashion Day, Season 5', when: 'April 2025', text: 'Tudor tailoring in contemporary silhouettes. Wool, cotton and organza, with collars made for KEKA by Mason Sophy G.' },
  };

  // ------------------------------------------------------------ the look (bag)
  const Look = {
    key: 'keka-look', items: [], subs: new Set(),
    load() { try { this.items = JSON.parse(localStorage.getItem(this.key) || '[]').filter(i => byId(i.id)); } catch (e) { this.items = []; } },
    save() { try { localStorage.setItem(this.key, JSON.stringify(this.items)); } catch (e) { /* storage unavailable */ } this.subs.forEach(f => f()); },
    add(id, size) { this.items.push({ id, size }); this.save(); },
    remove(i) { this.items.splice(i, 1); this.save(); },
    has(id) { return this.items.some(i => i.id === id); },
    total() { return this.items.reduce((s, i) => s + byId(i.id).price, 0); },
  };
  Look.load();
  const paintLook = () => {
    $$('.js-n').forEach(n => (n.textContent = Look.items.length));
    const bar = $('.lookbar');
    bar.hidden = !Look.items.length;
    $('.lookbar-thumbs', bar).innerHTML = Look.items.slice(-4).map(i => `<img src="media/rail/${i.id}.jpg" alt="" width="450" height="750">`).join('');
    $('.lookbar-sum', bar).textContent = `${Look.items.length} ${Look.items.length === 1 ? 'piece' : 'pieces'} · ${money(Look.total())}`;
  };
  Look.subs.add(paintLook);

  // ------------------------------------------------------------ the rail's contents
  const ENTRIES = [{ kind: 'film' }];
  for (const coll of ['TRACE', 'Tudor']) {
    ENTRIES.push({ kind: 'divider', coll });
    CATALOG.filter(g => g.collection === coll).forEach(g => ENTRIES.push({ kind: 'piece', g }));
  }
  ENTRIES.push({ kind: 'tag' }, { kind: 'end' });

  const stageWrap = $('.stage-wrap'), stage = $('.stage'), track = $('.track'), film = $('.film');
  const readout = $('.readout');
  const items = ENTRIES.map((e, i) => {
    const li = document.createElement('li');
    li.className = 'item item-' + e.kind;
    li.dataset.i = i;
    let inner = '';
    if (e.kind === 'film') inner = `<div class="swing"><span class="hanger-wrap">${hangerSvg('thin', { type: 'coat' })}</span><span class="film-slot" aria-hidden="true"></span></div>`;
    if (e.kind === 'piece') inner = `<div class="swing"><button type="button" class="hang" aria-label="${esc(e.g.name)}, ${money(e.g.price)} sample price. Open the fitting room.">${hangerSvg('thin', e.g)}<img src="media/rail/${e.g.id}.jpg" alt="" width="450" height="750" draggable="false"></button></div>`;
    if (e.kind === 'divider') inner = `<div class="swing"><button type="button" class="disc" aria-label="${SHOWS[e.coll].title} collection"><span class="disc-hole"></span><b>${SHOWS[e.coll].title}</b><span>${SHOWS[e.coll].when}</span></button></div>`;
    if (e.kind === 'tag') inner = `<div class="swing"><div class="hangtag"><span class="tag-hole"></span><p class="tag-big">Clothing, as a language.</p><p>Precise construction meets softer silhouettes. Clear lines sit beside a more instinctive approach to dressing, between masculine and feminine codes, history and the present.</p><p class="tag-sign">KEKA</p></div></div>`;
    if (e.kind === 'end') inner = `<div class="swing"><div class="endcard"><p>That is the whole rail.</p><button type="button" class="btn js-open-look">See your look</button><button type="button" class="btn btn-ghost js-open-index">Open the index</button></div></div>`;
    li.innerHTML = inner;
    track.appendChild(li);
    return { e, el: li, sw: li.firstElementChild, th: (Math.random() - .5) * 2, om: 0, x: 0, w: 0 };
  });

  // ------------------------------------------------------------ layout
  let V = 0, H = 0, W = 0, GAP = 0, L = 0, T = 0, I = 0, top0 = 0, railY = 0, pinned = !RM;
  function layout() {
    V = stage.clientWidth; H = stage.clientHeight;
    const cs = getComputedStyle(stage);
    W = parseFloat(cs.getPropertyValue('--w')); GAP = parseFloat(cs.getPropertyValue('--gap'));
    railY = parseFloat(cs.getPropertyValue('--rail-y')) * H / 100;
    const lead = Math.max(16, Math.min(40, V * 0.026)); // mirrors --gutter: clamp(16px, 2.6vw, 40px)
    let x = lead;
    items.forEach(it => {
      it.w = it.e.kind === 'piece' || it.e.kind === 'film' ? W : it.e.kind === 'divider' ? W * .82 : it.e.kind === 'tag' ? Math.min(W * 1.7, V * .82) : W * 1.25;
      it.x = x; x += it.w + GAP;
      it.el.style.width = it.w + 'px';
      it.el.style.left = it.x + 'px';
    });
    L = x - GAP + lead;
    T = Math.max(0, L - V);
    I = pinned ? H * .9 : 0;
    stageWrap.style.height = pinned ? (I + T + H) + 'px' : '';
    track.style.top = railY + 'px';
    top0 = stageWrap.getBoundingClientRect().top + scrollY;
    tick(true);
  }

  // ------------------------------------------------------------ frame loop
  let raf = 0, xPrev = 0, vPrev = 0, last = 0, active = -1, inView = true;
  function frame() { raf = 0; tick(false); }
  function kick() { if (!raf) raf = requestAnimationFrame(frame); }
  function tick(force) {
    const now = performance.now(), dt = clamp((now - (last || now)) / 1000, .008, .05); last = now;
    const s = pinned ? scrollY - top0 : 0;
    const p = pinned ? clamp(s / I, 0, 1) : 1;
    const x = pinned ? clamp(s - I, 0, T) : track.parentElement.scrollLeft || 0;
    if (pinned) track.style.transform = `translate3d(${(-x).toFixed(1)}px,0,0)`;
    // the film: full screen at the top, hung on the rail once the visitor scrolls
    const f = items[0], ep = ease(p);
    const slotX = f.x - x, slotY = railY + W * .29, slotW = W, slotH = W * 5 / 3;
    if (pinned) {
      const fx = slotX * ep, fy = slotY * ep, fw = V + (slotW - V) * ep, fh = H + (slotH - H) * ep;
      film.style.transform = `translate3d(${fx.toFixed(1)}px,${fy.toFixed(1)}px,0) rotate(${(f.th * ep).toFixed(2)}deg)`;
      film.style.width = fw.toFixed(1) + 'px'; film.style.height = fh.toFixed(1) + 'px';
      stage.style.setProperty('--p', p.toFixed(3));
      stage.classList.toggle('is-hung', p > .98);
    }
    // swing from the rail's acceleration
    const v = (x - xPrev) / dt; const a = (v - vPrev) / dt; xPrev = x; vPrev = v;
    let busy = false;
    for (const it of items) {
      const acc = RM ? 0 : clamp(a, -40000, 40000) * .0011;
      it.om += (-24 * it.th - 1.1 * it.om - acc) * dt; it.th = clamp(it.th + it.om * dt, -12, 12);
      if (RM) { it.th = 0; it.om = 0; }
      if (Math.abs(it.th) > .03 || Math.abs(it.om) > .05) busy = true;
      it.sw.style.transform = `rotate(${it.th.toFixed(2)}deg)`;
    }
    // the readout follows whatever hangs at the centre line
    const c = x + V / 2;
    let best = 0, bd = Infinity;
    items.forEach((it, i) => { const d = Math.abs(it.x + it.w / 2 - c); if (d < bd) { bd = d; best = i; } });
    if (p < .6) best = -1;
    if (best !== active || force) { active = best; paintReadout(); }
    $('.pos i').style.transform = `scaleX(${(T ? x / T : 0).toFixed(4)})`;
    if (busy && inView) kick();
  }
  addEventListener('scroll', () => { if (inView) kick(); }, { passive: true });
  new IntersectionObserver(([e]) => { inView = e.isIntersecting; if (inView) kick(); }).observe(stageWrap);
  addEventListener('resize', () => { clearTimeout(layout.t); layout.t = setTimeout(layout, 80); });
  if (!RM) track.parentElement.addEventListener('pointermove', e => {
    if (e.pointerType !== 'mouse') return;
    const r = stage.getBoundingClientRect(), x = pinned ? clamp(scrollY - top0 - I, 0, T) : 0;
    for (const it of items) { const cx = r.left + it.x - x + it.w / 2; if (Math.abs(e.clientX - cx) < it.w * .4) { it.om += (e.movementX || 0) * .9; kick(); } }
  });

  function paintReadout() {
    const it = items[active];
    readout.classList.toggle('is-empty', !it);
    if (!it) return;
    const e = it.e;
    const name = $('.ro-name', readout), meta = $('.ro-meta', readout), act = $('.ro-actions', readout);
    if (e.kind === 'piece') {
      name.textContent = e.g.name;
      meta.innerHTML = `<span>${money(e.g.price)} <em>sample</em></span><span>${e.g.fabric}</span><span>${e.g.collection}</span>`;
      act.innerHTML = `<button type="button" class="btn" data-fit="${e.g.id}">Fitting room</button><button type="button" class="btn btn-ghost" data-quick="${e.g.id}">${Look.has(e.g.id) ? 'In your look' : 'Add to look'}</button>`;
    } else if (e.kind === 'divider') {
      const s = SHOWS[e.coll];
      name.textContent = s.title;
      meta.innerHTML = `<span>${s.where}</span><span>${s.when}</span>`;
      act.innerHTML = `<p class="ro-text">${s.text}</p>`;
    } else if (e.kind === 'film') {
      name.textContent = 'KEKA';
      meta.innerHTML = '<span>Runway film, TRACE and Tudor</span>';
      act.innerHTML = '';
    } else if (e.kind === 'tag') {
      name.textContent = 'Be like KEKA';
      meta.innerHTML = '<span>Fashion as identity. Form as freedom.</span>';
      act.innerHTML = '';
    } else {
      name.textContent = 'Your look';
      meta.innerHTML = `<span>${Look.items.length} ${Look.items.length === 1 ? 'piece' : 'pieces'}</span>`;
      act.innerHTML = '';
    }
    readout.classList.remove('flip'); void readout.offsetWidth; readout.classList.add('flip');
  }
  readout.addEventListener('click', e => {
    const f = e.target.closest('[data-fit]'), q = e.target.closest('[data-quick]');
    if (f) openFit(byId(f.dataset.fit));
    if (q) { const g = byId(q.dataset.quick); if (!Look.has(g.id)) openFit(g, true); else openLook(); }
  });
  Look.subs.add(() => paintReadout());

  // jump the page so an item sits on the centre line
  function scrollToItem(i) {
    const it = items[i]; if (!it) return;
    if (!pinned) { track.parentElement.scrollTo({ left: it.x - V / 2 + it.w / 2, behavior: RM ? 'auto' : 'smooth' }); return; }
    const x = clamp(it.x + it.w / 2 - V / 2, 0, T);
    scrollTo({ top: top0 + I + x, behavior: RM ? 'auto' : 'smooth' });
  }
  track.addEventListener('click', e => {
    const li = e.target.closest('[data-i]'); if (!li) return;
    const it = items[+li.dataset.i];
    if (e.target.closest('.hang')) openFit(it.e.g);
    else if (e.target.closest('.disc')) scrollToItem(+li.dataset.i + 1);
  });
  track.addEventListener('focusin', e => { const li = e.target.closest('[data-i]'); if (li && e.target.matches(':focus-visible')) scrollToItem(+li.dataset.i); });
  $$('.jump').forEach(b => b.addEventListener('click', () => {
    const want = b.dataset.jump;
    const i = items.findIndex(it => (want === 'tag' ? it.e.kind === 'tag' : it.e.kind === 'divider' && it.e.coll === want));
    scrollToItem(i);
  }));
  $('.enter').addEventListener('click', () => scrollToItem(1));

  // ------------------------------------------------------------ dialogs
  function Dlg(el) {
    let opener = null;
    const close = () => {
      if (!el.open) return;
      el.classList.add('is-closing');
      setTimeout(() => { el.classList.remove('is-closing'); el.close(); opener && opener.focus && opener.focus({ preventScroll: true }); }, RM ? 0 : 300);
    };
    el.addEventListener('cancel', e => { e.preventDefault(); close(); });
    el.addEventListener('click', e => { if (e.target === el || e.target.closest('[data-close]')) close(); });
    return { el, body: $('.dlg-body', el), close, open(html) { opener = document.activeElement; if (html != null) this.body.innerHTML = html; if (!el.open) el.showModal(); this.body.scrollTop = 0; ($('[data-autofocus]', el) || $('.dlg-close', el)).focus({ preventScroll: true }); } };
  }
  const fit = Dlg($('#fit')), look = Dlg($('#look')), index = Dlg($('#index'));

  function openFit(g, focusSizes) {
    const sizes = g.cat === 'Accessories' ? ['One size'] : SIZES;
    const pair = CATALOG.filter(x => x.collection === g.collection && x.id !== g.id && x.cat !== g.cat).slice(0, 3);
    fit.open(`
      <div class="fit">
        <figure class="fit-photo"><img src="media/photos/${g.look}.jpg" alt="Runway look with the ${esc(g.name)}" width="800" height="1200"></figure>
        <div class="fit-info">
          <h2 id="fit-title">${esc(g.name)}</h2>
          <p class="fit-price">${money(g.price)} <em>sample price</em></p>
          <form class="fit-form" novalidate>
            <fieldset><legend>Size</legend><div class="sizes">${sizes.map((s, i) => `<label class="size"><input type="radio" name="size" value="${s}" id="fs-${i}" ${sizes.length === 1 ? 'checked' : ''}><span>${s}</span></label>`).join('')}</div></fieldset>
            <p class="fit-error" role="alert" hidden>Choose a size first.</p>
            <button type="submit" class="btn btn-wide" ${focusSizes ? '' : 'data-autofocus'}>Add to your look</button>
            <p class="fit-status" role="status"></p>
          </form>
          <dl class="fit-facts"><div><dt>Fabric</dt><dd>${g.fabric}</dd></div><div><dt>Shown</dt><dd>${SHOWS[g.collection].title}, ${SHOWS[g.collection].where}, ${SHOWS[g.collection].when}</dd></div><div><dt>Fit</dt><dd>Cut without a gender. Take your usual size.</dd></div></dl>
          ${pair.length ? `<p class="fit-with">Wear it with</p><ul class="pairs">${pair.map(x => `<li><button type="button" class="pair" data-pair="${x.id}"><img src="media/rail/${x.id}.jpg" alt="" width="450" height="750"><span>${esc(x.name)}</span><span>${money(x.price)}</span></button></li>`).join('')}</ul>` : ''}
        </div>
      </div>`);
    const form = $('.fit-form', fit.body);
    if (focusSizes) $('input[name=size]', form).focus({ preventScroll: true });
    form.addEventListener('submit', e => {
      e.preventDefault();
      const s = $('input[name=size]:checked', form);
      if (!s) { $('.fit-error', form).hidden = false; $('input[name=size]', form).focus(); return; }
      $('.fit-error', form).hidden = true;
      Look.add(g.id, s.value);
      $('.fit-status', form).innerHTML = `Added, size ${s.value}. <button type="button" class="link js-open-look">See your look</button>`;
    });
    form.addEventListener('change', () => { $('.fit-error', form).hidden = true; });
  }
  $('#fit').addEventListener('click', e => { const p = e.target.closest('[data-pair]'); if (p) openFit(byId(p.dataset.pair)); });

  function openLook() {
    const list = Look.items.map((it, i) => { const g = byId(it.id); return `<li><img src="media/rail/${g.id}.jpg" alt="${esc(g.name)}" width="450" height="750"><b>${esc(g.name)}</b><span>Size ${it.size} · ${money(g.price)}</span><button type="button" class="link" data-remove="${i}">Remove</button></li>`; }).join('');
    look.open(`<h2 class="look-title" id="look-title">Your look</h2>
      ${Look.items.length ? `<ul class="look-row">${list}</ul><div class="look-total"><span>Total, sample prices</span><b>${money(Look.total())}</b></div>` : '<p class="look-empty">Nothing yet. Open a piece on the rail and add it to your look.</p>'}
      <form class="notify" novalidate><p>The KEKA store opens soon. Leave your email and we will write when your look can be ordered.</p>
        <label for="n-email">Email address</label><div class="row"><input id="n-email" type="email" required autocomplete="email" placeholder="name@example.com"><button type="submit" class="btn">Notify me</button></div>
        <p class="notify-status" role="status"></p></form>`);
  }
  $('#look').addEventListener('click', e => { const r = e.target.closest('[data-remove]'); if (r) { Look.remove(+r.dataset.remove); openLook(); } });
  $('#look').addEventListener('submit', e => {
    e.preventDefault();
    const em = $('input[type=email]', e.target), out = $('.notify-status', e.target);
    if (!em.checkValidity()) { out.textContent = 'Enter an email address like name@example.com.'; out.dataset.state = 'error'; em.focus(); return; }
    out.textContent = 'Thank you. This prototype sends nothing; the live store will write to you.'; out.dataset.state = 'ok';
  });

  function openIndex() {
    const groups = ['TRACE', 'Tudor'].map(c => `<section><h3>${SHOWS[c].title}<span>${SHOWS[c].where}, ${SHOWS[c].when}</span></h3><ul>${CATALOG.filter(g => g.collection === c).map(g => `<li><button type="button" data-ix="${g.id}"><img src="media/rail/${g.id}.jpg" alt="" width="450" height="750" loading="lazy"><span class="ix-name">${esc(g.name)}</span><span class="ix-cat">${g.cat}</span><span class="ix-price">${money(g.price)}</span></button></li>`).join('')}</ul></section>`).join('');
    index.open(`<h2 class="ix-title" id="ix-title">Index</h2>${groups}<p class="ix-note">Prices are samples. The online store opens soon.</p>`);
  }
  $('#index').addEventListener('click', e => { const b = e.target.closest('[data-ix]'); if (b) { index.close(); setTimeout(() => openFit(byId(b.dataset.ix)), RM ? 0 : 320); } });

  document.addEventListener('click', e => {
    if (e.target.closest('.js-open-look')) { if (fit.el.open) fit.close(); setTimeout(openLook, fit.el.open && !RM ? 320 : 0); }
    if (e.target.closest('.js-open-index')) openIndex();
  });

  // ------------------------------------------------------------ film playback
  (function filmPlay() {
    const v = $('video', film), btn = $('.film-btn');
    let want = !RM, cur = '';
    const pick = () => { const k = innerHeight > innerWidth * 1.05 ? 'mobile' : 'desktop'; if (k !== cur) { cur = k; v.poster = `media/lineup-${k}.jpg`; v.src = `media/lineup-${k}.mp4`; } sync(); };
    const sync = () => { if (want) { const pr = v.play(); pr && pr.catch(() => {}); } else v.pause(); btn.setAttribute('aria-pressed', String(!want)); $('.vh', btn).textContent = want ? 'Pause film' : 'Play film'; };
    btn.addEventListener('click', () => { want = !want; sync(); });
    addEventListener('resize', pick); pick();
  })();

  // ------------------------------------------------------------ coda newsletter
  $('.coda form').addEventListener('submit', e => {
    e.preventDefault();
    const em = $('input[type=email]', e.target), out = $('.coda-status', e.target);
    if (!em.checkValidity()) { out.textContent = 'Enter an email address like name@example.com.'; out.dataset.state = 'error'; em.focus(); return; }
    out.textContent = 'Thank you. This prototype sends nothing; the live site will add you to the list.'; out.dataset.state = 'ok';
  });

  if (!pinned) document.documentElement.classList.add('rm');
  paintLook();
  layout();
  addEventListener('load', layout);
})();
