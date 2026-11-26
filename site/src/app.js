/* KEKA storefront: film, wardrobe rail with swing physics, grid view, product drawer, bag. */
(() => {
  const { CATALOG, hangerSvg } = window.KEKA;
  const $ = (s, r = document) => r.querySelector(s);
  const $$ = (s, r = document) => [...r.querySelectorAll(s)];
  const reduceMotion = matchMedia('(prefers-reduced-motion: reduce)').matches;
  const money = n => '$' + n.toLocaleString('en-US');
  const esc = s => String(s).replace(/[&<>"]/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));
  const byId = id => CATALOG.find(g => g.id === id);
  const SIZES = ['XS', 'S', 'M', 'L', 'XL'];
  const sizesFor = g => (g.cat === 'Accessories' ? ['One size'] : SIZES);
  const CATS = ['All', ...new Set(CATALOG.map(g => g.cat))];
  const SHOW = { TRACE: 'TRACE, London Fashion Day Season 7, May 2026', Tudor: 'Tudor collection, London Fashion Day Season 5, April 2025' };
  const ICON = {
    left: '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M15 6l-6 6 6 6" fill="none" stroke="currentColor" stroke-width="1.5"/></svg>',
    right: '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M9 6l6 6-6 6" fill="none" stroke="currentColor" stroke-width="1.5"/></svg>',
  };

  // ------------------------------------------------------------ bag
  const Bag = {
    key: 'keka-bag', items: [], subs: new Set(),
    load() { try { this.items = JSON.parse(localStorage.getItem(this.key) || '[]').filter(i => byId(i.id)); } catch (e) { this.items = []; } },
    save() { try { localStorage.setItem(this.key, JSON.stringify(this.items)); } catch (e) { /* storage unavailable */ } this.subs.forEach(f => f()); },
    add(id, size) { this.items.push({ id, size }); this.save(); },
    remove(i) { this.items.splice(i, 1); this.save(); },
    total() { return this.items.reduce((s, i) => s + byId(i.id).price, 0); },
  };
  Bag.load();
  const paintCount = () => $$('.js-count').forEach(c => (c.textContent = Bag.items.length));
  Bag.subs.add(paintCount); paintCount();

  // ------------------------------------------------------------ film
  (function film() {
    const v = $('.hero video'), btn = $('.film-btn');
    let want = !reduceMotion, cur = '';
    const load = () => {
      const k = innerHeight > innerWidth * 1.05 ? 'mobile' : 'desktop';
      if (k !== cur) { cur = k; v.poster = `media/lineup-${k}.jpg`; v.src = `media/lineup-${k}.mp4`; }
      sync();
    };
    const sync = () => {
      if (want) { const p = v.play(); p && p.catch(() => {}); } else v.pause();
      btn.setAttribute('aria-pressed', String(!want));
      $('.vh', btn).textContent = want ? 'Pause film' : 'Play film';
    };
    btn.addEventListener('click', () => { want = !want; sync(); });
    addEventListener('resize', load);
    load();
  })();

  // ------------------------------------------------------------ header
  (function header() {
    const head = $('.top');
    new IntersectionObserver(([e]) => head.classList.toggle('is-solid', e.intersectionRatio < 0.1), { threshold: [0, 0.1, 0.5] }).observe($('.hero'));
    const menuBtn = $('.menu-btn'), menu = $('#menu');
    const setMenu = open => { menu.hidden = !open; menuBtn.setAttribute('aria-expanded', String(open)); document.body.classList.toggle('menu-open', open); };
    menuBtn.addEventListener('click', () => setMenu(menu.hidden));
    menu.addEventListener('click', e => { if (e.target.closest('a,button')) setMenu(false); });
    addEventListener('keydown', e => { if (e.key === 'Escape' && !menu.hidden) { setMenu(false); menuBtn.focus(); } });
  })();

  // ------------------------------------------------------------ rail
  class Rail {
    constructor(vp, track, onCenter) {
      Object.assign(this, { vp, track, onCenter, x: 0, v: 0, target: null, drag: null, items: [], raf: 0, prevV: 0, centerIdx: -1 });
      this.bind();
      new ResizeObserver(() => { this.measure(); this.kick(); }).observe(vp);
    }
    measure() {
      const cs = getComputedStyle(this.vp);
      this.width = this.vp.clientWidth;
      this.spacing = parseFloat(cs.getPropertyValue('--spacing')) || 260;
      this.itemW = parseFloat(cs.getPropertyValue('--item')) || 220;
      this.max = Math.max(0, (this.items.length - 1) * this.spacing);
      // start from the left edge, like a real rail seen from its end
      this.lead = parseFloat(getComputedStyle(this.vp.closest('.shop')).paddingLeft) || 16;
    }
    set(list, render) {
      this.track.replaceChildren();
      this.items = list.map((g, i) => { const el = render(g, i); this.track.appendChild(el); return { g, el, sw: el.firstElementChild, th: (Math.random() - .5) * 3, om: 0 }; });
      this.x = 0; this.v = 0; this.target = null; this.centerIdx = -1;
      this.measure(); this.kick();
    }
    index() { return Math.max(0, Math.min(this.items.length - 1, Math.round(this.x / this.spacing))); }
    goTo(i) { const t = Math.max(0, Math.min(this.max, i * this.spacing)); if (reduceMotion) { this.x = t; this.v = 0; this.target = null; } else this.target = t; this.kick(); }
    nudge(d) { this.goTo(this.index() + d); }
    bind() {
      const vp = this.vp;
      let lx = 0, lt = 0;
      vp.addEventListener('pointerdown', e => { if (e.button === 0) { this.drag = { id: e.pointerId, x0: e.clientX, x: e.clientX, t: performance.now(), moved: false, vx: 0 }; this.target = null; } });
      vp.addEventListener('pointermove', e => {
        const now = performance.now();
        if (this.drag && e.pointerId === this.drag.id) {
          const dx = e.clientX - this.drag.x;
          if (!this.drag.moved && Math.abs(e.clientX - this.drag.x0) > 6) { this.drag.moved = true; vp.setPointerCapture(e.pointerId); vp.classList.add('is-dragging'); }
          if (this.drag.moved) {
            const dt = Math.max(1, now - this.drag.t) / 1000;
            let nx = this.x - dx;
            if (nx < 0 || nx > this.max) nx = this.x - dx * 0.3;
            this.drag.vx = 0.8 * (-dx / dt) + 0.2 * this.drag.vx;
            this.x = nx; this.v = this.drag.vx; this.kick();
          }
          this.drag.x = e.clientX; this.drag.t = now;
        } else if (e.pointerType === 'mouse' && lt) {
          const vx = (e.clientX - lx) / (Math.max(8, now - lt) / 1000);
          const r = vp.getBoundingClientRect();
          for (const it of this.items) {
            const c = r.left + it.sx + this.itemW / 2, d = Math.abs(e.clientX - c);
            if (d < this.itemW * .45 && Math.abs(vx) < 5000) { it.om += vx * 0.004 * (1 - d / (this.itemW * .45)); this.kick(); }
          }
        }
        lx = e.clientX; lt = now;
      });
      const end = e => {
        if (!this.drag || e.pointerId !== this.drag.id) return;
        if (this.drag.moved) { this.v = Math.max(-3500, Math.min(3500, this.drag.vx)); vp.classList.remove('is-dragging'); this.block = true; setTimeout(() => (this.block = false), 0); }
        this.drag = null; this.kick();
      };
      vp.addEventListener('pointerup', end); vp.addEventListener('pointercancel', end);
      vp.addEventListener('click', e => { if (this.block) { e.stopPropagation(); e.preventDefault(); } }, true);
      vp.addEventListener('wheel', e => {
        const d = Math.abs(e.deltaX) > Math.abs(e.deltaY) ? e.deltaX : (e.shiftKey ? e.deltaY : 0);
        if (!d) return; e.preventDefault(); this.target = null; this.x += d; this.v = d * 25; this.kick();
      }, { passive: false });
      vp.addEventListener('keydown', e => {
        if (e.key === 'ArrowRight') { e.preventDefault(); this.nudge(1); }
        if (e.key === 'ArrowLeft') { e.preventDefault(); this.nudge(-1); }
      });
      vp.addEventListener('focusin', e => { const li = e.target.closest('[data-i]'); if (li && !this.drag) this.goTo(+li.dataset.i); });
    }
    kick() { if (!this.raf) { this.last = performance.now(); this.raf = requestAnimationFrame(t => this.tick(t)); } }
    tick(t) {
      this.raf = 0;
      const dt = Math.min(.034, (t - this.last) / 1000 || .016); this.last = t;
      if (!this.drag) {
        if (this.target != null) {
          const k = 60, c = 2 * Math.sqrt(k);
          this.v += (k * (this.target - this.x) - c * this.v) * dt; this.x += this.v * dt;
          if (Math.abs(this.target - this.x) < .3 && Math.abs(this.v) < 4) { this.x = this.target; this.v = 0; this.target = null; }
        } else {
          this.x += this.v * dt; this.v *= Math.pow(.05, dt);
          if (this.x < 0 || this.x > this.max) this.target = Math.max(0, Math.min(this.max, this.x));
          else if (Math.abs(this.v) < 150) this.target = Math.round(this.x / this.spacing) * this.spacing;
        }
      }
      const accel = (this.v - this.prevV) / dt; this.prevV = this.v;
      let busy = this.drag || this.target != null || Math.abs(this.v) > 2;
      this.items.forEach((it, i) => {
        const a = -26 * it.th - .9 * it.om - (reduceMotion ? 0 : accel * .014);
        it.om += a * dt; it.th = Math.max(-14, Math.min(14, it.th + it.om * dt));
        if (reduceMotion) { it.th = 0; it.om = 0; }
        if (Math.abs(it.th) > .03 || Math.abs(it.om) > .06) busy = true;
        const sx = this.lead + i * this.spacing - this.x; it.sx = sx;
        const vis = sx > -this.itemW * 1.5 && sx < this.width + this.itemW;
        it.el.style.visibility = vis ? 'visible' : 'hidden';
        if (vis) { it.el.style.transform = `translate3d(${sx.toFixed(1)}px,0,0)`; it.sw.style.transform = `rotate(${it.th.toFixed(2)}deg)`; }
      });
      const ci = this.index();
      if (ci !== this.centerIdx) { this.centerIdx = ci; this.onCenter && this.onCenter(ci); }
      if (busy) this.raf = requestAnimationFrame(tt => this.tick(tt));
    }
  }

  // ------------------------------------------------------------ dialogs
  function Drawer(dlg) {
    let opener = null;
    const close = () => {
      if (!dlg.open) return;
      dlg.classList.add('is-closing');
      setTimeout(() => { dlg.classList.remove('is-closing'); dlg.close(); opener && opener.focus && opener.focus({ preventScroll: true }); }, reduceMotion ? 0 : 280);
    };
    dlg.addEventListener('cancel', e => { e.preventDefault(); close(); });
    dlg.addEventListener('click', e => { if (e.target === dlg || e.target.closest('[data-close]')) close(); });
    return {
      body: $('.drawer-body', dlg), close,
      open(html) { opener = document.activeElement; if (html != null) this.body.innerHTML = html; if (!dlg.open) dlg.showModal(); this.body.scrollTop = 0; ($('[data-autofocus]', dlg) || $('.drawer-close', dlg)).focus({ preventScroll: true }); },
    };
  }
  const product = Drawer($('#product'));
  const bag = Drawer($('#bag'));

  function openProduct(g) {
    const sizes = sizesFor(g);
    product.open(`
      <figure class="p-photo"><img src="media/photos/${g.look}.jpg" alt="Runway look with the ${esc(g.name)}" width="800" height="1200"></figure>
      <div class="p-info">
        <h2 id="p-title">${esc(g.name)}</h2>
        <p class="p-price">${money(g.price)} <span>Sample price</span></p>
        <form class="p-form" novalidate>
          <fieldset><legend>Size</legend><div class="sizes">${sizes.map((s, i) => `<label class="size"><input type="radio" name="size" value="${s}" id="size-${i}" ${sizes.length === 1 ? 'checked' : ''}><span>${s}</span></label>`).join('')}</div></fieldset>
          <p class="p-error" role="alert" hidden>Choose a size first.</p>
          <button type="submit" class="btn btn-dark" data-autofocus>Add to bag</button>
          <p class="p-status" role="status"></p>
        </form>
        <dl class="p-facts"><div><dt>Collection</dt><dd>${SHOW[g.collection]}</dd></div><div><dt>Fabric</dt><dd>${g.fabric}</dd></div><div><dt>Fit</dt><dd>Cut without a gender. Choose your usual size.</dd></div></dl>
      </div>`);
    const form = $('.p-form', product.body);
    form.addEventListener('submit', e => {
      e.preventDefault();
      const s = $('input[name=size]:checked', form);
      if (!s) { $('.p-error', form).hidden = false; $('input[name=size]', form).focus(); return; }
      $('.p-error', form).hidden = true;
      Bag.add(g.id, s.value);
      $('.p-status', form).innerHTML = `Added to your bag, size ${s.value}. <button type="button" class="link js-open-bag">View bag</button>`;
    });
    form.addEventListener('change', () => { $('.p-error', form).hidden = true; });
    product.body.addEventListener('click', e => { if (e.target.closest('.js-open-bag')) { product.close(); setTimeout(openBag, reduceMotion ? 0 : 300); } }, { once: false });
  }

  function openBag() {
    const lines = Bag.items.map((it, i) => { const g = byId(it.id); return `
      <li class="b-line"><img src="media/rail/${g.id}.jpg" alt="" width="450" height="750"><div><b>${esc(g.name)}</b><span>Size ${it.size}</span><span>${money(g.price)}</span></div>
      <button type="button" class="link" data-remove="${i}">Remove</button></li>`; }).join('');
    bag.open(`<h2 class="b-title">Bag</h2>${Bag.items.length ? `<ul class="b-lines">${lines}</ul>
      <div class="b-total"><span>Subtotal (sample prices)</span><b>${money(Bag.total())}</b></div>
      <button class="btn btn-dark" type="button" disabled>Checkout opens with the store</button>
      <p class="b-note">The KEKA online store is opening soon. Your bag is kept on this device.</p>`
      : `<p class="b-empty">Your bag is empty.</p><button type="button" class="btn btn-line" data-close>Continue browsing</button>`}`);
  }
  $('#bag').addEventListener('click', e => { const b = e.target.closest('[data-remove]'); if (b) { Bag.remove(+b.dataset.remove); openBag(); } });
  $$('.js-bag').forEach(b => b.addEventListener('click', openBag));

  // ------------------------------------------------------------ wardrobe
  (function wardrobe() {
    const vp = $('.rail'), track = $('.rail ul'), grid = $('.grid');
    let list = CATALOG;
    const rail = new Rail(vp, track, i => { $('.rail-count').textContent = `${i + 1} / ${list.length}`; });
    const renderRail = (g, i) => {
      const li = document.createElement('li');
      li.dataset.i = i;
      li.innerHTML = `<div class="swing"><button type="button" class="hang" aria-label="${esc(g.name)}, ${money(g.price)} sample price">${hangerSvg('thin', g)}<img src="media/rail/${g.id}.jpg" alt="" width="450" height="750" draggable="false"></button></div>
        <p class="cap"><span>${esc(g.name)}</span><span>${money(g.price)}</span></p>`;
      $('button', li).addEventListener('click', () => openProduct(g));
      return li;
    };
    const renderGrid = () => {
      grid.innerHTML = list.map(g => `<li><button type="button" class="card" data-id="${g.id}"><img src="media/rail/${g.id}.jpg" alt="" width="450" height="750" loading="lazy"><span class="cap"><span>${esc(g.name)}</span><span>${money(g.price)}</span></span></button></li>`).join('');
    };
    grid.addEventListener('click', e => { const c = e.target.closest('[data-id]'); if (c) openProduct(byId(c.dataset.id)); });
    const show = () => { rail.set(list, renderRail); renderGrid(); };
    const filters = $('.filters');
    filters.innerHTML = CATS.map((c, i) => `<button type="button" class="chip" aria-pressed="${i === 0}" data-cat="${c}">${c}</button>`).join('');
    filters.addEventListener('click', e => {
      const b = e.target.closest('[data-cat]'); if (!b) return;
      $$('[data-cat]', filters).forEach(x => x.setAttribute('aria-pressed', String(x === b)));
      list = b.dataset.cat === 'All' ? CATALOG : CATALOG.filter(g => g.cat === b.dataset.cat);
      show();
    });
    $('.prev').addEventListener('click', () => rail.nudge(-1));
    $('.next').addEventListener('click', () => rail.nudge(1));
    $$('.view button').forEach(b => b.addEventListener('click', () => {
      const v = b.dataset.view;
      $$('.view button').forEach(x => x.setAttribute('aria-pressed', String(x === b)));
      $('.shop').dataset.view = v;
      if (v === 'rail') { rail.measure(); rail.kick(); }
    }));
    show();
  })();

  // ------------------------------------------------------------ newsletter
  $('.newsletter').addEventListener('submit', e => {
    e.preventDefault();
    const f = e.target, email = $('input[type=email]', f), out = $('.nl-status', f);
    if (!email.checkValidity()) { out.textContent = 'Enter an email address like name@example.com.'; out.dataset.state = 'error'; email.focus(); return; }
    out.textContent = 'Thank you. This prototype does not send anything; the live site will add you to the list.';
    out.dataset.state = 'ok';
  });

  // ------------------------------------------------------------ scroll to sections without changing the hash
  $$('[data-go]').forEach(a => a.addEventListener('click', e => {
    const t = document.getElementById(a.dataset.go); if (!t) return;
    e.preventDefault(); t.scrollIntoView({ behavior: reduceMotion ? 'auto' : 'smooth', block: 'start' });
  }));
})();
