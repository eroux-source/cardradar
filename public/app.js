// Client script: cookie-less measurement beacon, the stepped alert funnel,
// sign-in, account actions, phone notifications. No framework, no cookie.
(() => {
  document.documentElement.classList.add('js');
  const $ = (s, r = document) => r.querySelector(s);
  const $$ = (s, r = document) => [...r.querySelectorAll(s)];

  /* ---------- measurement (per-tab id in sessionStorage, never a cookie) ---------- */
  let visit = null;
  try { visit = sessionStorage.getItem('v') || crypto.randomUUID(); sessionStorage.setItem('v', visit); } catch { visit = crypto.randomUUID(); }
  const q = new URLSearchParams(location.search);
  const standalone = matchMedia('(display-mode: standalone)').matches || navigator.standalone;
  let source = q.get('utm_source') || q.get('via') || '';
  if (!source && document.referrer) { try { const h = new URL(document.referrer).hostname.replace(/^www\./, ''); if (h !== location.hostname) source = h; } catch {} }
  if (!source && standalone) source = 'homescreen';
  // keep the landing source for the whole visit: later pages have our own site as referrer
  try { if (source) sessionStorage.setItem('src', source); else source = sessionStorage.getItem('src') || ''; } catch {}
  const ev = (n, x) => { try { if (n !== 'view' && window.gtag) window.gtag('event', n, x && typeof x === 'object' ? x : {}); } catch {} try { navigator.sendBeacon('/api/e', new Blob([JSON.stringify({ n, v: visit, p: location.pathname, s: source, x })], { type: 'application/json' })); } catch {} };
  ev('view');
  // GA4 only (our own counter already records these on the server): conversions for GA's key events, then run done()
  const ga = (n, done) => { let went = false; const go = () => { if (!went) { went = true; done?.(); } }; try { if (window.gtag) window.gtag('event', n, { transport_type: 'beacon', event_callback: go, event_timeout: 800 }); } catch {} setTimeout(go, window.gtag ? 900 : 0); };
  // every click that leaves the site (left, middle or ctrl-click): which shop, which product, from which page
  const outbound = (e) => {
    const a = e.target.closest('a[href]'); if (!a) return;
    let u; try { u = new URL(a.href, location.href); } catch { return; }
    if (!/^https?:$/.test(u.protocol) || u.hostname === location.hostname) return;
    const host = u.hostname.replace(/^www\./, '');
    const seg = location.pathname.split('/').filter(Boolean);
    ev('out', { host, shop: a.dataset.shop || host, sku: a.dataset.sku || (seg.length === 2 ? seg[1] : ''), kind: a.dataset.ev || 'link', page: location.pathname, cc: document.body.dataset.cc || '' });
  };
  document.addEventListener('click', outbound, true);
  document.addEventListener('auxclick', (e) => { if (e.button === 1) outbound(e); }, true);
  document.addEventListener('click', (e) => { const a = e.target.closest('[data-ev]'); if (!a) return; const { ev: n, ...x } = a.dataset; ev(n, Object.keys(x).length ? { ...x, page: location.pathname } : undefined); });

  const post = async (url, body) => {
    const r = await fetch(url, { method: 'POST', headers: { 'content-type': 'application/json' }, credentials: 'same-origin', body: JSON.stringify(body ?? {}) });
    let data = {}; try { data = await r.json(); } catch {}
    if (!r.ok || data.ok === false) throw new Error(data.error || 'Something went wrong. Try again.');
    return data;
  };
  const busy = (form, on) => { const b = form.querySelector('button[type=submit]'); if (b) b.disabled = on; };

  /* ---------- charts grow when they scroll into view ---------- */
  const charts = $$('.chart');
  charts.forEach((c) => $$('.bars span', c).forEach((b, i) => b.style.setProperty('--h', i)));
  if ('IntersectionObserver' in window) {
    const io = new IntersectionObserver((es) => es.forEach((x) => { if (x.isIntersecting) { x.target.classList.add('seen'); io.unobserve(x.target); } }), { threshold: .3 });
    charts.forEach((c) => io.observe(c));
  } else charts.forEach((c) => c.classList.add('seen'));

  /* ---------- product finder + city picker ---------- */
  $$('[data-find]').forEach((inp) => inp.addEventListener('change', () => {
    const o = [...(inp.list?.options ?? [])].find((x) => x.value === inp.value);
    if (o?.dataset.href) location.href = o.dataset.href;
  }));
  $$('select[data-nav]').forEach((sel) => sel.addEventListener('change', () => { location.href = sel.value; }));

  /* ---------- home: category chips filter the product grids ---------- */
  $$('[data-filter]').forEach((bar) => bar.addEventListener('click', (e) => {
    const b = e.target.closest('[data-t]'); if (!b) return;
    $$('[data-t]', bar).forEach((x) => x.classList.toggle('on', x === b));
    const t = b.dataset.t;
    $$('[data-grid]').forEach((g) => { let shown = 0; $$('li[data-type]', g).forEach((li) => { const ok = !t || li.dataset.type === t; li.hidden = !ok; if (ok) shown++; }); const none = g.parentElement.querySelector('[data-none]'); if (none) none.hidden = shown > 0; });
  }));

  /* ---------- phone notifications ---------- */
  const b64 = (s) => Uint8Array.from(atob(s.replace(/-/g, '+').replace(/_/g, '/') + '='.repeat((4 - (s.length % 4)) % 4)), (c) => c.charCodeAt(0));
  async function enablePush(vapid) {
    if (!('serviceWorker' in navigator) || !('PushManager' in window)) throw new Error(/iPhone|iPad/.test(navigator.userAgent) && !standalone ? 'On iPhone, tap Share › Add to Home Screen, open the app from your Home Screen, then turn notifications on.' : 'This browser cannot receive notifications. Use Telegram instead.');
    if (!vapid) throw new Error('Notifications are not set up yet on our side. Use Telegram or email.');
    const reg = await navigator.serviceWorker.register('/sw.js');
    if ((await Notification.requestPermission()) !== 'granted') throw new Error('Notifications are blocked. Allow them in your browser settings.');
    const sub = await reg.pushManager.subscribe({ userVisibleOnly: true, applicationServerKey: b64(vapid) });
    await post('/api/me/push', { subscription: sub.toJSON() });
  }

  /* ---------- wrong country: offer the visitor's own (ChatGPT often links the US page) ---------- */
  (async () => {
    const page = document.body.dataset.cc; if (!page || page === 'jp' || f0()) return;
    try { if (localStorage.getItem('geo-off')) return; } catch {}
    const MAP = { US: 'us', GB: 'uk', CA: 'ca', AU: 'au', NZ: 'au', DE: 'de', AT: 'de', CH: 'de', FR: 'fr', BE: 'fr', LU: 'fr', NL: 'nl', IT: 'it', ES: 'es', MX: 'mx', CL: 'cl' };
    const NAME = { us: 'the United States', uk: 'the UK', ca: 'Canada', au: 'Australia', de: 'Deutschland', fr: 'France', nl: 'Nederland', it: 'Italia', es: 'España', mx: 'México', cl: 'Chile' };
    const SAY = { us: (n) => `Shopping in ${n}? See stock there`, uk: (n) => `Shopping in ${n}? See stock there`, ca: (n) => `Shopping in ${n}? See stock there`, au: (n) => `Shopping in ${n}? See stock there`,
      de: (n) => `Du kaufst in ${n}? Bestand dort ansehen`, fr: (n) => `Vous achetez en ${n} ? Voir le stock en ${n}`, nl: (n) => `Je koopt in ${n}? Bekijk de voorraad daar`, it: (n) => `Compri in ${n}? Vedi la disponibilità`, es: (n) => `¿Compras en ${n}? Ver el stock allí`, mx: (n) => `¿Compras en ${n}? Ver el stock en ${n}`, cl: (n) => `¿Compras en ${n}? Ver el stock en ${n}` };
    let cc = null;
    try { cc = MAP[(await (await fetch('/api/geo')).json()).country]; } catch {}
    if (!cc || cc === page) return;
    const bar = document.createElement('div'); bar.className = 'geo-bar';
    bar.innerHTML = `<a href="${cc === 'us' ? '/' : '/' + cc}" data-ev="geo_switch">${SAY[cc](NAME[cc])}</a><button type="button" aria-label="Close">×</button>`;
    bar.querySelector('button').addEventListener('click', () => { bar.remove(); try { localStorage.setItem('geo-off', '1'); } catch {} });
    document.querySelector('main')?.prepend(bar);
  })();
  function f0() { return !!document.getElementById('funnel') || !!document.getElementById('account'); }

  /* ---------- funnel ---------- */
  const f = $('#funnel');
  if (f) {
    const state = { sku: q.get('sku') || '', metro: q.get('metro') || '' };
    const show = (n) => {
      $$('.step', f).forEach((s) => { s.hidden = s.dataset.step !== String(n); });
      $$('.steps li', f).forEach((li) => { li.className = Number(li.dataset.s) < n ? 'done' : Number(li.dataset.s) === n ? 'now' : ''; });
      ev(`step_${n}`);
      $(`.step[data-step="${n}"] input, .step[data-step="${n}"] select`, f)?.focus();
    };
    const err = (n, m) => { $(`.step[data-step="${n}"] .err`, f).textContent = m || ''; };
    const kindOf = () => $('input[name=kind]:checked', f)?.value || $('input[name=kind][type=hidden]', f)?.value || 'online';
    const metroField = () => { const m = $('#f-metro'); if (!m) return; const k = kindOf(); m.required = k === 'stores'; m.disabled = k !== 'stores'; };
    $$('input[name=kind]', f).forEach((r) => r.addEventListener('change', metroField)); metroField();
    // Order (2026-11-05): 1 product → 2 plan → 3 email (signed-out only), then checkout. The email is confirmed after payment.
    if (f.dataset.sku) { state.sku = f.dataset.sku; state.kind = 'online'; const li = $('.steps li[data-s="1"]', f); if (li) li.hidden = true; }
    const signed = f.dataset.signed === '1';
    if (signed) { const li = $('.steps li[data-s="3"]', f); if (li) li.hidden = true; }
    let email = ''; let chosenPlan = '';
    // Shops that sell the product: all ticked by default, the person can keep only some (empty list sent = all shops)
    const sp = $('.shops-pick', f);
    const escH = (s) => String(s).replace(/[&<>"]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));
    const boxes = () => [...(sp ? sp.querySelectorAll('input[name=store]') : [])];
    const sumShops = () => { const all = boxes(); const on = all.filter((x) => x.checked); $('.shops-sum', sp).textContent = on.length === all.length ? sp.dataset.all.replace('{n}', all.length) : `${on.length} / ${all.length}`; };
    async function loadShops() {
      if (!sp) return; sp.hidden = true; $('.shop-list', sp).innerHTML = '';
      if (!state.sku || /^(set|jpset):/.test(state.sku) || state.kind !== 'online') return;
      try {
        const r = await fetch(`/api/funnel/shops?sku=${encodeURIComponent(state.sku)}&c=${encodeURIComponent(f.dataset.country)}`).then((x) => x.json());
        if (!r.shops || r.shops.length < 2) return;
        $('.shop-list', sp).innerHTML = r.shops.map((s) => `<label class="radio"><input type="checkbox" name="store" value="${escH(s.id)}" checked> ${escH(s.name)}${s.in ? ` <span class="fine">· ${escH(sp.dataset.in)}</span>` : ''}</label>`).join('');
        boxes().forEach((x) => x.addEventListener('change', sumShops)); sumShops(); sp.hidden = false;
      } catch {}
    }
    $('.shops-toggle', f)?.addEventListener('click', () => { const l = $('.shop-list', sp); l.hidden = !l.hidden; });
    const toPlan = () => { show(2); loadShops(); };
    if (f.dataset.sku) toPlan(); else show(1);

    async function submitAlert(plan, form, n, extra = {}) {
      busy(form, true); err(n);
      try {
        const r = await post('/api/funnel/alert', { ...state, plan, visit, via: source, country: f.dataset.country, ...extra });
        if (r.state === 'code') { busy(form, false); form.hidden = true; $('[data-form=code]', f).hidden = false; $('#f-code').focus(); return; }
        ga(/[?&]free=1/.test(r.next) ? 'free_alert' : 'checkout_start', () => { location.href = r.next; });
      } catch (x) { err(n, x.message); busy(form, false); }
    }
    $('[data-form=email]', f).addEventListener('submit', (e) => {
      e.preventDefault(); email = e.target.email.value.trim();
      submitAlert(chosenPlan, e.target, 3, { email });
    });
    $('[data-form=code]', f).addEventListener('submit', async (e) => {
      e.preventDefault(); err(3); busy(e.target, true);
      try { await post('/api/auth/verify', { email, code: e.target.code.value }); submitAlert(chosenPlan, e.target, 3); } catch (x) { err(3, x.message); busy(e.target, false); }
    });
    $('[data-form=product]', f).addEventListener('submit', (e) => {
      e.preventDefault(); err(1);
      state.sku = e.target.sku.value; state.kind = kindOf(); state.metro = e.target.metro?.value || '';
      if (state.kind === 'stores' && !state.metro) return err(1, 'Pick your city.');
      if (state.sku.startsWith('set:')) { $('input[name=plan][value=multi]', f).checked = true; }
      toPlan();
    });
    $('[data-form=plan]', f).addEventListener('submit', async (e) => {
      e.preventDefault(); err(2);
      const t = e.target;
      state.push = !!t.push?.checked; state.telegram = !!t.telegram?.checked; state.line = !!t.line?.checked;
      if (state.push) { try { await enablePush(f.dataset.vapid); } catch (x) { state.push = false; t.push.checked = false; return err(2, x.message); } }
      if (sp && !sp.hidden) {
        const all = boxes(); const on = all.filter((x) => x.checked).map((x) => x.value);
        if (!on.length) return err(2, sp.dataset.none);
        state.stores = on.length === all.length ? [] : on;
      } else state.stores = [];
      chosenPlan = f.dataset.pass || ($('input[name=plan]:checked', f) || $('input[name=plan]', f)).value;
      if (signed) submitAlert(chosenPlan, t, 2); else show(3);
    });
  }

  /* ---------- sign-in ---------- */
  const si = $('#signin');
  if (si) {
    let email = '';
    const err = (m) => { $('.err', si).textContent = m || ''; };
    $('[data-form=email]', si).addEventListener('submit', async (e) => {
      e.preventDefault(); err(); busy(e.target, true); email = e.target.email.value.trim();
      try { await post('/api/auth/code', { email }); e.target.hidden = true; $('[data-form=code]', si).hidden = false; $('#s-code').focus(); } catch (x) { err(x.message); } finally { busy(e.target, false); }
    });
    $('[data-form=code]', si).addEventListener('submit', async (e) => {
      e.preventDefault(); err(); busy(e.target, true);
      try { await post('/api/auth/verify', { email, code: e.target.code.value }); location.href = si.dataset.next || '/account'; } catch (x) { err(x.message); busy(e.target, false); }
    });
  }

  /* ---------- which other channels people want (counted, not built yet) ---------- */
  const sv = $('[data-form=channels-survey]');
  if (sv) sv.addEventListener('submit', (e) => {
    e.preventDefault();
    const ch = $$('input[name=ch]:checked', sv).map((x) => x.value);
    if (!ch.length) return;
    ev('wants_channel', { ch: ch.join(',') });
    $$('label, button', sv).forEach((x) => { x.hidden = true; }); $('.ok', sv).hidden = false;
  });

  /* ---------- account ---------- */
  const acc = $('#account');
  if (acc) {
    acc.addEventListener('click', async (e) => {
      const b = e.target.closest('[data-act]'); if (!b) return;
      const act = b.dataset.act;
      const id = b.closest('[data-alert]')?.dataset.alert;
      try {
        if (act === 'pause' || act === 'resume') { await post(`/api/me/alerts/${id}`, { act }); location.reload(); }
        else if (act === 'delete') {
          const d = $('#del-dialog'); d.showModal();
          d.addEventListener('close', async () => { if (d.returnValue === 'ok') { await post(`/api/me/alerts/${id}`, { act: 'delete', reason: $('input[name=reason]:checked', d).value }); location.reload(); } }, { once: true });
        } else if (act === 'push') { await enablePush(acc.dataset.vapid); location.reload(); }
        else if (act === 'telegram') { const r = await post('/api/me/telegram'); location.href = r.url; }
        else if (act === 'line') { const r = await post('/api/me/line'); b.closest('.row').querySelector('.meta').textContent = `LINEで友だち追加して、このコードを送ってください: ${r.code}`; window.open(r.url, '_blank', 'noopener'); }
        else if (act === 'test') { await post('/api/me/test', { ch: b.dataset.ch }); b.textContent = 'Sent ✓'; }
        else if (act === 'cancel') { if (confirm('Stop renewal? Your alerts keep working until the end of the period you paid for.')) { await post('/api/me/cancel'); location.reload(); } }
        else if (act === 'signout') { await post('/api/signout'); location.href = '/'; }
      } catch (x) { alert(x.message); }
    });
  }
})();
