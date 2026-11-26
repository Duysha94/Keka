/* KEKA concepts: shared engine (bag, films, rail physics, dialogs) and the three views. */
(() => {
  const { CATALOG, svg, hangerSvg } = window.KEKA;
  const $ = (s, r = document) => r.querySelector(s);
  const $$ = (s, r = document) => [...r.querySelectorAll(s)];
  const reduceMotion = matchMedia('(prefers-reduced-motion: reduce)').matches;
  const money = n => '$' + n.toLocaleString('en-US');
  const esc = s => String(s).replace(/[&<>"]/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));
  const CATS = ['All', ...new Set(CATALOG.map(g => g.cat))];
  const SIZES = ['XS', 'S', 'M', 'L', 'XL'];
  const sizesFor = g => (g.cat === 'Accessories' ? ['One size'] : SIZES);
  const byId = id => CATALOG.find(g => g.id === id);
  const lookPhoto = g => `media/photos/${g.look}.jpg`;
  // a garment on its hanger: the hanger drawn, the garment a crop of the runway photograph
  const garm = (g, style, extra = '') => `<span class="garm">${hangerSvg(style, g)}<img class="garm-img" src="media/rail/${g.id}.jpg" alt="" width="450" height="750" draggable="false">${extra}</span>`;

  // ---------------------------------------------------------------- bag
  const Bag = {
    key: 'keka-concept-bag',
    items: [],
    subs: new Set(),
    load() { try { this.items = JSON.parse(localStorage.getItem(this.key) || '[]').filter(i => byId(i.id)); } catch (e) { this.items = []; } },
    save() { try { localStorage.setItem(this.key, JSON.stringify(this.items)); } catch (e) { /* storage unavailable */ } this.subs.forEach(f => f()); },
    add(id, size) { this.items.push({ id, size, at: Date.now() }); this.save(); },
    remove(i) { this.items.splice(i, 1); this.save(); },
    count() { return this.items.length; },
    total() { return this.items.reduce((s, i) => s + byId(i.id).price, 0); },
    on(f) { this.subs.add(f); },
  };
  Bag.load();

  // ---------------------------------------------------------------- films
  function Film(root) {
    const v = $('video.film', root);
    const btn = $('.film-toggle', root);
    const name = v.dataset.film;
    let cur = null, wantPlay = !reduceMotion, active = false;
    const pick = () => (innerHeight > innerWidth * 1.05 ? 'mobile' : 'desktop');
    function load() {
      const k = pick();
      if (k !== cur) { cur = k; v.poster = `media/${name}-${k}.jpg`; v.src = `media/${name}-${k}.mp4`; }
      sync();
    }
    function sync() {
      if (active && wantPlay) { const p = v.play(); if (p) p.catch(() => {}); } else v.pause();
      if (btn) { btn.setAttribute('aria-pressed', String(!wantPlay)); btn.querySelector('span').textContent = wantPlay ? 'Pause film' : 'Play film'; }
    }
    btn && btn.addEventListener('click', () => { wantPlay = !wantPlay; sync(); });
    addEventListener('resize', () => { if (active) load(); });
    return { start() { active = true; load(); }, stop() { active = false; v.pause(); } };
  }

  // header turns solid once the film is out of view
  function pastHero(root) {
    const hero = $('.hero', root);
    new IntersectionObserver(([e]) => root.classList.toggle('is-past', e.intersectionRatio < 0.12), { threshold: [0, 0.12, 0.5] }).observe(hero);
  }

  // ---------------------------------------------------------------- rail
  class Rail {
    constructor(o) {
      Object.assign(this, { loop: true, snap: true, coupling: 0.018, stiffness: 30, damping: 1.1, maxAngle: 16 }, o);
      this.x = 0; this.v = 0; this.target = null; this.motor = 0; this.drag = null;
      this.items = []; this.raf = 0; this.last = 0; this.centerIdx = -1; this.prevV = 0;
      this.width = this.viewport.clientWidth;
      this.bind();
      new ResizeObserver(() => { this.measure(); this.kick(); }).observe(this.viewport);
    }
    measure() {
      this.width = this.viewport.clientWidth;
      const cs = getComputedStyle(this.viewport);
      this.spacing = parseFloat(cs.getPropertyValue('--rail-spacing')) || 220;
      this.itemW = parseFloat(cs.getPropertyValue('--rail-item')) || 200;
      const n = this.items.length;
      this.looping = this.loop && n * this.spacing > this.width + this.spacing * 1.5;
    }
    setItems(list) {
      this.track.replaceChildren();
      this.items = list.map((g, i) => {
        const el = this.render(g, i);
        el.style.setProperty('--i', i);
        this.track.appendChild(el);
        return { g, el, th: (Math.random() - 0.5) * 2, om: 0 };
      });
      this.measure();
      this.x = 0; this.v = 0; this.target = null; this.centerIdx = -1;
      this.kick();
    }
    maxX() { return Math.max(0, (this.items.length - 1) * this.spacing); }
    index() {
      const n = this.items.length; if (!n) return -1;
      const i = Math.round(this.x / this.spacing);
      return this.looping ? ((i % n) + n) % n : Math.max(0, Math.min(n - 1, i));
    }
    goTo(i, instant) {
      const n = this.items.length; if (!n) return;
      let t = i * this.spacing;
      if (this.looping) { // shortest way round the loop
        const total = n * this.spacing;
        const cur = this.x;
        t = cur + ((((t - cur) % total) + total * 1.5) % total) - total / 2;
      }
      if (instant || reduceMotion) { this.x = t; this.v = 0; this.target = null; } else this.target = t;
      this.kick();
    }
    nudge(d) { this.goTo((this.target != null ? Math.round(this.target / this.spacing) : Math.round(this.x / this.spacing)) + d); }
    hold(d) { this.motor = d; if (!d && this.snap) this.target = null; this.kick(); }
    bind() {
      const vp = this.viewport;
      let lastPX = 0, lastPT = 0, pvx = 0;
      vp.addEventListener('pointerdown', e => {
        if (e.button !== 0) return;
        this.drag = { id: e.pointerId, x0: e.clientX, x: e.clientX, t: performance.now(), moved: false, vx: 0, start: this.x };
        this.target = null;
      });
      vp.addEventListener('pointermove', e => {
        const now = performance.now();
        if (this.drag && e.pointerId === this.drag.id) {
          const dx = e.clientX - this.drag.x;
          if (!this.drag.moved && Math.abs(e.clientX - this.drag.x0) > 6) { this.drag.moved = true; vp.setPointerCapture(e.pointerId); vp.classList.add('is-dragging'); }
          if (this.drag.moved) {
            const dt = Math.max(1, now - this.drag.t) / 1000;
            let nx = this.x - dx;
            if (!this.looping) { const m = this.maxX(); if (nx < 0) nx = this.x - dx * 0.35; if (nx > m) nx = this.x - dx * 0.35; }
            this.drag.vx = 0.8 * (-dx / dt) + 0.2 * this.drag.vx;
            this.x = nx; this.v = this.drag.vx;
            this.kick();
          }
          this.drag.x = e.clientX; this.drag.t = now;
        } else if (e.pointerType === 'mouse') { // brush past the garments
          const dt = Math.max(8, now - lastPT) / 1000;
          pvx = (e.clientX - lastPX) / dt;
          if (lastPT && Math.abs(pvx) < 6000) this.brush(e.clientX, e.clientY, pvx);
        }
        lastPX = e.clientX; lastPT = now;
      });
      const end = e => {
        if (!this.drag || e.pointerId !== this.drag.id) return;
        const moved = this.drag.moved;
        if (moved) { this.v = Math.max(-4000, Math.min(4000, this.drag.vx)); vp.classList.remove('is-dragging'); this.suppressClick = true; setTimeout(() => (this.suppressClick = false), 0); }
        this.drag = null; this.kick();
      };
      vp.addEventListener('pointerup', end);
      vp.addEventListener('pointercancel', end);
      vp.addEventListener('click', e => { if (this.suppressClick) { e.stopPropagation(); e.preventDefault(); } }, true);
      vp.addEventListener('wheel', e => {
        const d = Math.abs(e.deltaX) > Math.abs(e.deltaY) ? e.deltaX : (e.shiftKey ? e.deltaY : 0);
        if (!d) return;
        e.preventDefault();
        this.target = null; this.x += d; this.v = d * 30; this.kick();
        clearTimeout(this.wheelT); this.wheelT = setTimeout(() => this.kick(), 60);
      }, { passive: false });
      vp.addEventListener('keydown', e => {
        if (e.key === 'ArrowRight') { e.preventDefault(); this.nudge(1); }
        else if (e.key === 'ArrowLeft') { e.preventDefault(); this.nudge(-1); }
        else if (e.key === 'Home') { e.preventDefault(); this.goTo(0); }
        else if (e.key === 'End') { e.preventDefault(); this.goTo(this.items.length - 1); }
      });
      vp.addEventListener('focusin', e => {
        const li = e.target.closest('[data-index]');
        if (li && !this.drag) this.goTo(+li.dataset.index);
      });
    }
    brush(px, py, vx) {
      const r = this.viewport.getBoundingClientRect();
      if (py < r.top || py > r.bottom) return;
      for (const it of this.items) {
        if (it.sx == null) continue;
        const c = r.left + it.sx + this.itemW / 2;
        const dist = Math.abs(px - c);
        if (dist < this.itemW * 0.45) { it.om += vx * 0.0045 * (1 - dist / (this.itemW * 0.45)); this.kick(); }
      }
    }
    kick() { if (!this.raf && this.running) { this.last = performance.now(); this.raf = requestAnimationFrame(t => this.tick(t)); } }
    start() { this.running = true; this.measure(); this.kick(); }
    stop() { this.running = false; cancelAnimationFrame(this.raf); this.raf = 0; }
    tick(t) {
      this.raf = 0;
      const dt = Math.min(0.034, (t - this.last) / 1000 || 0.016); this.last = t;
      const n = this.items.length;
      if (!this.drag) {
        if (this.motor) {
          this.v += (this.motor * 620 - this.v) * Math.min(1, dt * 5);
          this.x += this.v * dt;
        } else if (this.target != null) {
          const k = 70, c = 2 * Math.sqrt(k) * 0.92;
          this.v += (k * (this.target - this.x) - c * this.v) * dt;
          this.x += this.v * dt;
          if (Math.abs(this.target - this.x) < 0.3 && Math.abs(this.v) < 4) { this.x = this.target; this.v = 0; this.target = null; }
        } else {
          this.x += this.v * dt;
          this.v *= Math.pow(0.06, dt);
          if (!this.looping) {
            const m = this.maxX();
            if (this.x < 0 || this.x > m) { this.target = Math.max(0, Math.min(m, this.x)); }
          }
          if (this.snap && this.target == null && Math.abs(this.v) < 160) {
            this.target = Math.round(this.x / this.spacing) * this.spacing;
            if (!this.looping) this.target = Math.max(0, Math.min(this.maxX(), this.target));
          }
        }
      }
      const accel = (this.v - this.prevV) / dt; this.prevV = this.v;
      const total = n * this.spacing;
      let busy = this.drag || this.motor || this.target != null || Math.abs(this.v) > 2;
      for (let i = 0; i < n; i++) {
        const it = this.items[i];
        const a = -this.stiffness * it.th - this.damping * it.om - (reduceMotion ? 0 : accel * this.coupling);
        it.om += a * dt; it.th += it.om * dt;
        it.th = Math.max(-this.maxAngle, Math.min(this.maxAngle, it.th));
        if (reduceMotion) { it.th = 0; it.om = 0; }
        if (Math.abs(it.th) > 0.03 || Math.abs(it.om) > 0.06) busy = true;
        let rel = i * this.spacing - this.x;
        if (this.looping) rel = ((((rel + total / 2) % total) + total) % total) - total / 2;
        const sx = this.width / 2 + rel - this.itemW / 2;
        it.sx = sx;
        const vis = sx > -this.itemW * 1.5 && sx < this.width + this.itemW * 0.5;
        it.el.style.visibility = vis ? 'visible' : 'hidden';
        if (vis) it.el.style.transform = `translate3d(${sx.toFixed(1)}px,0,0) rotate(${it.th.toFixed(2)}deg)`;
      }
      const ci = this.index();
      if (ci !== this.centerIdx) {
        if (this.items[this.centerIdx]) this.items[this.centerIdx].el.classList.remove('is-center');
        this.centerIdx = ci;
        if (this.items[ci]) { this.items[ci].el.classList.add('is-center'); this.onCenter && this.onCenter(this.items[ci].g, ci); }
      }
      if (busy && this.running) this.raf = requestAnimationFrame(tt => this.tick(tt));
    }
  }

  // ---------------------------------------------------------------- dialogs
  function Sheet(dlg) {
    let opener = null;
    const close = () => {
      if (!dlg.open) return;
      dlg.classList.add('is-closing');
      setTimeout(() => { dlg.classList.remove('is-closing'); dlg.close(); opener && opener.focus && opener.focus({ preventScroll: true }); }, reduceMotion ? 0 : 260);
    };
    dlg.addEventListener('cancel', e => { e.preventDefault(); close(); });
    dlg.addEventListener('click', e => { if (e.target === dlg || e.target.closest('[data-close]')) close(); });
    return {
      open(html) { opener = document.activeElement; if (html != null) $('.sheet-body', dlg).innerHTML = html; if (!dlg.open) dlg.showModal(); $('.sheet-body', dlg).scrollTop = 0; const f = $('[data-autofocus]', dlg) || $('.sheet-close', dlg); f && f.focus({ preventScroll: true }); },
      close, el: dlg, body: () => $('.sheet-body', dlg),
    };
  }

  function sizeField(g, name) {
    const s = sizesFor(g);
    return `<fieldset class="sizes"><legend>Size</legend><div class="size-row">${s.map((z, i) => `
      <label class="size"><input type="radio" name="${name}" value="${z}" ${s.length === 1 ? 'checked' : ''} id="${name}-${i}"><span>${z}</span></label>`).join('')}</div>
      <p class="size-error" role="alert" hidden>Choose a size first.</p></fieldset>`;
  }
  function wireAdd(scope, g, name, onAdded) {
    const form = $('form', scope);
    form.addEventListener('submit', e => {
      e.preventDefault();
      const picked = $(`input[name="${name}"]:checked`, form);
      const err = $('.size-error', form);
      if (!picked) { err.hidden = false; $(`input[name="${name}"]`, form).focus(); return; }
      err.hidden = true;
      Bag.add(g.id, picked.value);
      onAdded && onAdded(picked.value);
    });
    $$(`input[name="${name}"]`, form).forEach(r => r.addEventListener('change', () => { $('.size-error', form).hidden = true; }));
  }

  function bagLines(render) {
    if (!Bag.count()) return null;
    return Bag.items.map((it, i) => render(byId(it.id), it, i)).join('');
  }
  function wireBag(sheet, rerender) {
    sheet.body().addEventListener('click', e => {
      const b = e.target.closest('[data-remove]');
      if (b) { Bag.remove(+b.dataset.remove); rerender(); }
    });
  }

  // shared newsletter handler: there is nowhere to send it in a prototype
  function wireNewsletter(root) {
    $$('form.newsletter', root).forEach(f => f.addEventListener('submit', e => {
      e.preventDefault();
      const email = $('input[type=email]', f), ok = $('.nl-status', f);
      if (!email.checkValidity()) { ok.textContent = 'Enter an email address like name@example.com.'; ok.dataset.state = 'error'; email.focus(); return; }
      ok.textContent = 'Noted for the prototype. Nothing was sent; the live site will connect this to the mailing list.';
      ok.dataset.state = 'ok';
    }));
  }
  function wireScrollButtons(root) {
    $$('[data-scroll]', root).forEach(b => b.addEventListener('click', () => {
      const t = $(`[data-anchor="${b.dataset.scroll}"]`, root);
      t && t.scrollIntoView({ behavior: reduceMotion ? 'auto' : 'smooth', block: 'start' });
    }));
  }
  function filterBar(el, onPick) {
    el.innerHTML = CATS.map((c, i) => `<button type="button" class="chip" aria-pressed="${i === 0}" data-cat="${c}">${c}</button>`).join('');
    el.addEventListener('click', e => {
      const b = e.target.closest('[data-cat]'); if (!b) return;
      $$('[data-cat]', el).forEach(x => x.setAttribute('aria-pressed', String(x === b)));
      onPick(b.dataset.cat === 'All' ? CATALOG : CATALOG.filter(g => g.cat === b.dataset.cat));
    });
  }

  const ICON = {
    left: '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M15 5l-7 7 7 7" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="square"/></svg>',
    right: '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M9 5l7 7-7 7" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="square"/></svg>',
    down: '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M12 4v15M6 13l6 6 6-6" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="square"/></svg>',
    close: '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M6 6l12 12M18 6L6 18" fill="none" stroke="currentColor" stroke-width="1.8"/></svg>',
  };

  // ================================================================= CONVEYOR
  function initConveyor() {
    const root = $('#view-conveyor');
    const film = Film(root);
    pastHero(root);
    const led = $('.led-text', root);
    const ledNo = $('.led-no', root);
    const sheet = Sheet($('#conveyor-sheet'));
    const bagSheet = Sheet($('#conveyor-bag'));
    const rail = new Rail({
      viewport: $('.cv-rail', root), track: $('.cv-track', root),
      render(g, i) {
        const li = document.createElement('li');
        li.className = 'hang'; li.dataset.index = i;
        li.innerHTML = `<button type="button" class="hang-btn" aria-label="Ticket ${g.ticket}: ${esc(g.name)}, ${money(g.price)} sample price">
          ${garm(g, 'wire', '<span class="bag" aria-hidden="true"></span>')}
          <span class="tag" aria-hidden="true"><b>No. ${g.ticket}</b><span>${esc(g.name)}</span></span></button>`;
        $('button', li).addEventListener('click', () => { rail.goTo(i); openPiece(g); });
        return li;
      },
      onCenter(g) { ledNo.textContent = String(g.ticket); led.textContent = `${g.name} · ${g.collection}`; led.parentElement.dataset.state = 'ok'; },
    });
    filterBar($('.cv-filters', root), list => rail.setItems(list));
    rail.setItems(CATALOG);

    $$('[data-motor]', root).forEach(b => {
      const d = +b.dataset.motor;
      let held = false, t0 = 0;
      b.addEventListener('pointerdown', e => { t0 = performance.now(); held = true; b.setPointerCapture(e.pointerId); setTimeout(() => { if (held) rail.hold(d); }, 180); });
      const up = () => { if (!held) return; held = false; if (performance.now() - t0 < 180) rail.nudge(d); rail.hold(0); };
      b.addEventListener('pointerup', up); b.addEventListener('pointercancel', up); b.addEventListener('lostpointercapture', up);
      b.addEventListener('keydown', e => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); rail.nudge(d); } });
    });
    $('.cv-call', root).addEventListener('submit', e => {
      e.preventDefault();
      const input = $('input', e.target);
      const n = parseInt(input.value, 10);
      const idx = rail.items.findIndex(it => it.g.ticket === n);
      if (idx < 0) {
        const anywhere = CATALOG.find(g => g.ticket === n);
        ledNo.textContent = isNaN(n) ? '---' : String(n);
        led.textContent = anywhere ? `${anywhere.name} is under ${anywhere.cat}. Switch the filter to All.` : `No ticket ${isNaN(n) ? '' : n}. Tickets run 101 to 114.`;
        led.parentElement.dataset.state = 'error';
        return;
      }
      rail.goTo(idx);
    });
    $('.cv-collect', root).addEventListener('click', () => { const it = rail.items[rail.index()]; it && openPiece(it.g); });

    function openPiece(g) {
      sheet.open(`
        <div class="slip">
          <div class="slip-grid">
            <figure class="slip-photo"><img src="${lookPhoto(g)}" alt="Runway look with the ${esc(g.name)}, ${g.collection}" width="800" height="1200"></figure>
            <div class="slip-info">
              <header class="slip-head"><span>Shop copy</span><span class="slip-no">No. ${g.ticket}</span></header>
              <h2 id="cv-title">${esc(g.name)}</h2>
              <dl class="slip-fields">
                <div><dt>Collection</dt><dd>${g.collection}${g.collection === 'TRACE' ? ', London Fashion Day S7' : ', AW25-26'}</dd></div>
                <div><dt>Fabric</dt><dd>${g.fabric}</dd></div>
                <div><dt>Category</dt><dd>${g.cat}</dd></div>
                <div><dt>Price</dt><dd>${money(g.price)} <small>sample</small></dd></div></dl>
              <form class="slip-form" novalidate>${sizeField(g, 'cv-size')}
                <button class="btn-ink" type="submit" data-autofocus>Add to bag</button>
              </form>
              <p class="slip-status" role="status"></p>
              <img class="stamp" src="media/stamp-in-bag.png" alt="" width="640" height="250">
            </div>
          </div>
          <div class="copy" hidden><span class="copy-no">No. ${g.ticket}</span><span class="copy-text">Customer copy. <b class="copy-size"></b> Keep it until the store opens.</span><button type="button" class="btn-ink js-open-bag">Open bag</button></div>
        </div>`);
      wireAdd(sheet.body(), g, 'cv-size', size => {
        const slip = $('.slip', sheet.body());
        slip.classList.remove('is-stamped'); void slip.offsetWidth; slip.classList.add('is-stamped');
        $('.slip-status', slip).textContent = `${g.name}, size ${size}, is in your bag.`;
        const copy = $('.copy', slip); copy.hidden = false; $('.copy-size', copy).textContent = `Size ${size}.`;
        $('.js-open-bag', copy).onclick = () => { sheet.close(); setTimeout(() => { renderBag(); bagSheet.open(); }, reduceMotion ? 0 : 280); };
      });
    }

    function renderBag() {
      const lines = bagLines((g, it, i) => `
        <li class="stub"><span class="stub-no">No. ${g.ticket}</span><span class="stub-name">${esc(g.name)}<small>Size ${it.size}</small></span>
        <span class="stub-price">${money(g.price)}</span><button type="button" class="stub-x" data-remove="${i}" aria-label="Remove ${esc(g.name)}">${ICON.close}</button></li>`);
      bagSheet.body().innerHTML = `<header class="bag-head"><h2>Your tickets</h2><p>Customer copies. Keep them until the store opens.</p></header>
        ${lines ? `<ul class="stubs">${lines}</ul><div class="bag-total"><span>Total, sample prices</span><b>${money(Bag.total())}</b></div>
        <button class="btn-ink" type="button" disabled>Checkout opens with the store</button>` :
        `<div class="bag-empty"><p>No tickets yet.</p><p>Pick a piece on the rail, choose a size, and it is stamped into your bag.</p><button type="button" class="btn-line" data-close>Back to the rail</button></div>`}`;
    }
    wireBag(bagSheet, renderBag);
    $$('.js-bag', root).forEach(b => b.addEventListener('click', () => { renderBag(); bagSheet.open(); }));
    Bag.on(() => $$('.js-bag-count', root).forEach(c => (c.textContent = Bag.count())));
    $$('.js-bag-count', root).forEach(c => (c.textContent = Bag.count()));
    wireScrollButtons(root); wireNewsletter(root);
    return { start() { film.start(); rail.start(); }, stop() { film.stop(); rail.stop(); } };
  }

  // ================================================================= BACKSTAGE
  function initBackstage() {
    const root = $('#view-backstage');
    const film = Film(root);
    pastHero(root);
    const sheet = Sheet($('#backstage-sheet'));
    const bagSheet = Sheet($('#backstage-bag'));
    const ro = $('.bs-order', root);
    const showTime = i => { const s = 19 * 3600 + i * 25; return `${String(Math.floor(s / 3600)).padStart(2, '0')}:${String(Math.floor(s / 60) % 60).padStart(2, '0')}:${String(s % 60).padStart(2, '0')}`; };
    let list = CATALOG;
    const rail = new Rail({
      viewport: $('.bs-rail', root), track: $('.bs-track', root), stiffness: 26, damping: 0.9,
      render(g, i) {
        const li = document.createElement('li');
        li.className = 'hang'; li.dataset.index = i;
        const n = String(CATALOG.indexOf(g) + 1).padStart(2, '0');
        li.innerHTML = `<button type="button" class="hang-btn" aria-label="Look ${n}: ${esc(g.name)}, ${money(g.price)} sample price">
          ${garm(g, 'black')}
          <span class="lookcard" aria-hidden="true"><b>Look ${n}</b><span class="lc-item">${esc(g.name)}</span><span class="lc-top">${g.collection}</span></span></button>`;
        $('button', li).addEventListener('click', () => { rail.goTo(i); openLook(g, n); });
        return li;
      },
      onCenter(g, i) {
        $$('li', ro).forEach((r, k) => r.toggleAttribute('aria-current', k === i));
        const r = $$('li', ro)[i];
        if (r) { // keep the current row visible inside the running order without scrolling the page
          const top = r.offsetTop - ro.offsetTop, bottom = top + r.offsetHeight;
          if (top < ro.scrollTop) ro.scrollTop = top;
          else if (bottom > ro.scrollTop + ro.clientHeight) ro.scrollTop = bottom - ro.clientHeight;
        }
      },
    });
    function renderOrder() {
      ro.innerHTML = list.map((g, i) => `<li><button type="button" data-go="${i}"><span class="ro-t">${showTime(CATALOG.indexOf(g))}</span><span class="ro-n">${String(CATALOG.indexOf(g) + 1).padStart(2, '0')}</span><span class="ro-name">${esc(g.name)}</span></button></li>`).join('');
    }
    ro.addEventListener('click', e => { const b = e.target.closest('[data-go]'); if (b) rail.goTo(+b.dataset.go); });
    filterBar($('.bs-filters', root), l => { list = l; renderOrder(); rail.setItems(l); });
    renderOrder(); rail.setItems(list);
    $('.bs-prev', root).addEventListener('click', () => rail.nudge(-1));
    $('.bs-next', root).addEventListener('click', () => rail.nudge(1));

    function openLook(g, n) {
      sheet.open(`
        <div class="dress">
          <div class="dress-photo"><img src="${lookPhoto(g)}" alt="Runway look ${n} with the ${esc(g.name)}" width="800" height="1200"><span class="tape">Look ${n}</span></div>
          <div class="dress-info">
            <h2>${esc(g.name)}</h2>
            <ul class="dress-spec"><li><span>Collection</span>${g.collection}</li><li><span>Type</span>${g.cat}</li><li><span>Fabric</span>${g.fabric}</li><li><span>Price</span>${money(g.price)} <small>sample</small></li></ul>
            <form novalidate>${sizeField(g, 'bs-size')}
              <button class="btn-card" type="submit" data-autofocus>Add look ${n} to bag</button></form>
            <p class="dress-status" role="status"></p>
          </div>
        </div>`);
      wireAdd(sheet.body(), g, 'bs-size', size => { $('.dress-status', sheet.body()).textContent = `Checked off: ${g.name}, size ${size}. It's in your bag.`; });
    }
    function renderBag() {
      const lines = bagLines((g, it, i) => `<li class="bs-line"><img src="${lookPhoto(g)}" alt="" width="800" height="1200"><span><b>${esc(g.name)}</b><small>Size ${it.size} · ${money(g.price)}</small></span><button type="button" data-remove="${i}" aria-label="Remove ${esc(g.name)}">${ICON.close}</button></li>`);
      bagSheet.body().innerHTML = `<header class="bag-head"><h2>Your rail</h2><p>${Bag.count()} ${Bag.count() === 1 ? 'piece' : 'pieces'} pulled for you.</p></header>
        ${lines ? `<ul class="bs-lines">${lines}</ul><div class="bag-total"><span>Total, sample prices</span><b>${money(Bag.total())}</b></div><button class="btn-card" type="button" disabled>Checkout opens with the store</button>`
        : `<div class="bag-empty"><p>Nothing pulled yet.</p><p>Open a look on the rail and add it to your bag.</p><button type="button" class="btn-line" data-close>Back to the rail</button></div>`}`;
    }
    wireBag(bagSheet, renderBag);
    $$('.js-bag', root).forEach(b => b.addEventListener('click', () => { renderBag(); bagSheet.open(); }));
    Bag.on(() => $$('.js-bag-count', root).forEach(c => (c.textContent = Bag.count())));
    $$('.js-bag-count', root).forEach(c => (c.textContent = Bag.count()));
    wireScrollButtons(root); wireNewsletter(root);
    return { start() { film.start(); rail.start(); }, stop() { film.stop(); rail.stop(); } };
  }

  // ================================================================= SHOWROOM
  function initShowroom() {
    const root = $('#view-showroom');
    const film = Film(root);
    pastHero(root);
    const sheet = Sheet($('#showroom-sheet'));
    const bagSheet = Sheet($('#showroom-bag'));
    const cap = $('.sr-caption', root);
    const rail = new Rail({
      viewport: $('.sr-rail', root), track: $('.sr-track', root), loop: false, stiffness: 22, damping: 0.8,
      render(g, i) {
        const li = document.createElement('li');
        li.className = 'hang'; li.dataset.index = i;
        li.innerHTML = `<button type="button" class="hang-btn" aria-label="${esc(g.name)}, ${money(g.price)} sample price">${garm(g, 'wood')}</button>`;
        $('button', li).addEventListener('click', () => { if (rail.index() !== i) rail.goTo(i); openPiece(g); });
        return li;
      },
      onCenter(g, i) {
        $('.sr-cap-name', cap).textContent = g.name;
        $('.sr-cap-meta', cap).textContent = `${g.collection} · ${g.fabric} · ${money(g.price)} sample price`;
        $('.sr-count', root).textContent = `${String(i + 1).padStart(2, '0')} / ${String(rail.items.length).padStart(2, '0')}`;
      },
    });
    filterBar($('.sr-filters', root), l => rail.setItems(l));
    rail.setItems(CATALOG);
    rail.goTo(2, true);
    $('.sr-prev', root).addEventListener('click', () => rail.nudge(-1));
    $('.sr-next', root).addEventListener('click', () => rail.nudge(1));
    $('.sr-view', root).addEventListener('click', () => { const it = rail.items[rail.index()]; it && openPiece(it.g); });

    function openPiece(g) {
      sheet.open(`
        <div class="pdp">
          <div class="pdp-media"><img src="${lookPhoto(g)}" alt="Runway look with the ${esc(g.name)}, ${g.collection}" width="800" height="1200"></div>
          <div class="pdp-info">
            <h2>${esc(g.name)}</h2>
            <p class="pdp-price">${money(g.price)} <small>Sample price</small></p>
            <p class="pdp-coll">${g.collection} collection</p>
            <form novalidate>${sizeField(g, 'sr-size')}<button class="btn-solid" type="submit" data-autofocus>Add to bag</button></form>
            <p class="pdp-status" role="status"></p>
            <details open><summary>Details</summary><p>${g.fabric}. Shown in the ${g.collection} collection${g.collection === 'TRACE' ? ' at London Fashion Day Season 7, May 2026' : ' at London Fashion Day Season 5, April 2025'}.</p></details>
            <details><summary>Fit</summary><p>Cut without a gender. Choose your usual size; the size chart arrives with the store.</p></details>
          </div>
        </div>`);
      wireAdd(sheet.body(), g, 'sr-size', size => { $('.pdp-status', sheet.body()).textContent = `Added: ${g.name}, size ${size}.`; });
    }
    function renderBag() {
      const lines = bagLines((g, it, i) => `<li class="sr-line"><div class="sr-line-art"><img src="media/rail/${g.id}.jpg" alt="" width="450" height="750"></div><span><b>${esc(g.name)}</b><small>Size ${it.size}</small><small>${money(g.price)}</small></span><button type="button" class="link" data-remove="${i}">Remove</button></li>`);
      bagSheet.body().innerHTML = `<header class="bag-head"><h2>Bag</h2></header>${lines ? `<ul class="sr-lines">${lines}</ul><div class="bag-total"><span>Subtotal, sample prices</span><b>${money(Bag.total())}</b></div><button class="btn-solid" type="button" disabled>Checkout opens with the store</button>`
        : `<div class="bag-empty"><p>Your bag is empty.</p><button type="button" class="btn-line" data-close>Continue browsing</button></div>`}`;
    }
    wireBag(bagSheet, renderBag);
    $$('.js-bag', root).forEach(b => b.addEventListener('click', () => { renderBag(); bagSheet.open(); }));
    Bag.on(() => $$('.js-bag-count', root).forEach(c => (c.textContent = Bag.count())));
    $$('.js-bag-count', root).forEach(c => (c.textContent = Bag.count()));
    wireScrollButtons(root); wireNewsletter(root);
    return { start() { film.start(); rail.start(); }, stop() { film.stop(); rail.stop(); } };
  }

  // ---------------------------------------------------------------- router
  const views = { conveyor: initConveyor(), backstage: initBackstage(), showroom: initShowroom() };
  let current = null;
  function route() {
    const id = location.hash.slice(1) in views ? location.hash.slice(1) : 'conveyor';
    if (id === current) return;
    if (current) views[current].stop();
    for (const k in views) $(`#view-${k}`).hidden = k !== id;
    document.documentElement.dataset.concept = id;
    $$('.switcher a').forEach(a => a.setAttribute('aria-current', a.getAttribute('href') === '#' + id ? 'page' : 'false'));
    const first = current !== null;
    current = id;
    views[id].start();
    if (first) scrollTo({ top: 0, behavior: 'auto' });
  }
  addEventListener('hashchange', route);
  route();

  // the concept switcher steps aside while reading down the page and returns on the way up
  const switcher = $('.switcher');
  let lastY = scrollY;
  addEventListener('scroll', () => {
    const y = scrollY;
    if (Math.abs(y - lastY) < 6) return;
    switcher.classList.toggle('is-tucked', y > lastY && y > 200 && !switcher.contains(document.activeElement));
    lastY = y;
  }, { passive: true });
  switcher.addEventListener('focusin', () => switcher.classList.remove('is-tucked'));
})();
