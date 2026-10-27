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
  const ev = (n, x) => { try { navigator.sendBeacon('/api/e', new Blob([JSON.stringify({ n, v: visit, p: location.pathname, s: source, x })], { type: 'application/json' })); } catch {} };
  ev('view');
  document.addEventListener('click', (e) => { const a = e.target.closest('[data-ev]'); if (a) ev(a.dataset.ev); });

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

  /* ---------- cards: dealt in on scroll, tilt + holo glare under the pointer ---------- */
  const grids = $$('.card-grid');
  if ('IntersectionObserver' in window) {
    const io2 = new IntersectionObserver((es) => es.forEach((x) => { if (x.isIntersecting) { x.target.classList.add('dealt'); io2.unobserve(x.target); } }), { threshold: .15 });
    grids.forEach((g) => io2.observe(g));
  } else grids.forEach((g) => g.classList.add('dealt'));
  if (!matchMedia('(prefers-reduced-motion: reduce)').matches) {
    $$('.tcg.holo').forEach((c) => {
      c.addEventListener('pointermove', (ev) => {
        const r = c.getBoundingClientRect(); const x = (ev.clientX - r.left) / r.width; const y = (ev.clientY - r.top) / r.height;
        c.style.setProperty('--mx', `${x * 100}%`); c.style.setProperty('--my', `${y * 100}%`);
        c.style.setProperty('--ry', `${(x - .5) * 16}deg`); c.style.setProperty('--rx', `${(.5 - y) * 16}deg`);
        c.style.transition = 'transform .05s linear, box-shadow .25s';
      });
      c.addEventListener('pointerleave', () => { c.style.removeProperty('--rx'); c.style.removeProperty('--ry'); c.style.transition = ''; });
    });
  }

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
    const metroField = () => { const k = $('input[name=kind]:checked', f)?.value; $('#f-metro').closest('label') ; $('#f-metro').required = k === 'stores'; $('#f-metro').disabled = k !== 'stores'; };
    $$('input[name=kind]', f).forEach((r) => r.addEventListener('change', metroField)); metroField();
    show(f.dataset.signed === '1' ? 2 : 1);
    let email = '';

    $('[data-form=email]', f).addEventListener('submit', async (e) => {
      e.preventDefault(); err(1); busy(e.target, true);
      email = e.target.email.value.trim();
      try {
        const r = await post('/api/funnel/start', { email, sku: state.sku, metro: state.metro, via: source });
        if (r.state === 'code') { e.target.hidden = true; $('[data-form=code]', f).hidden = false; $('#f-code').focus(); }
        else show(2);
      } catch (x) { err(1, x.message); } finally { busy(e.target, false); }
    });
    $('[data-form=code]', f).addEventListener('submit', async (e) => {
      e.preventDefault(); err(1); busy(e.target, true);
      try { await post('/api/auth/verify', { email, code: e.target.code.value }); location.reload(); } catch (x) { err(1, x.message); busy(e.target, false); }
    });
    $('[data-form=product]', f).addEventListener('submit', (e) => {
      e.preventDefault(); err(2);
      state.sku = e.target.sku.value; state.kind = $('input[name=kind]:checked', f).value; state.metro = e.target.metro.value;
      if (state.kind === 'stores' && !state.metro) return err(2, 'Pick your city.');
      if (state.sku.startsWith('set:')) { $('input[name=plan][value=multi]', f).checked = true; }
      show(3);
    });
    $('[data-form=channels]', f).addEventListener('submit', async (e) => {
      e.preventDefault(); err(3);
      state.push = e.target.push.checked; state.telegram = e.target.telegram.checked;
      if (state.push) { try { await enablePush(f.dataset.vapid); } catch (x) { state.push = false; e.target.push.checked = false; return err(3, x.message); } }
      if (f.dataset.pass) return submitAlert(f.dataset.pass, e.target);
      show(4);
    });
    async function submitAlert(plan, form) {
      busy(form, true); err(4);
      try { const r = await post('/api/funnel/alert', { ...state, plan, visit }); location.href = r.next; }
      catch (x) { err(f.dataset.pass ? 3 : 4, x.message); busy(form, false); }
    }
    $('[data-form=plan]', f).addEventListener('submit', (e) => { e.preventDefault(); submitAlert($('input[name=plan]:checked', f).value, e.target); });
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
        else if (act === 'test') { await post('/api/me/test', { ch: b.dataset.ch }); b.textContent = 'Sent ✓'; }
        else if (act === 'cancel') { if (confirm('Stop renewal? Your alerts keep working until the end of the period you paid for.')) { await post('/api/me/cancel'); location.reload(); } }
        else if (act === 'signout') { await post('/api/signout'); location.href = '/'; }
      } catch (x) { alert(x.message); }
    });
  }
})();
