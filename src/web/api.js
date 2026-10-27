// JSON API used by the funnel, the account page, the service worker and the beacon.
import { one, all, run, now } from '../lib/db.js';
import { currentUser, startSession, endSession, userByEmail, EMAIL_RE } from '../auth/session.js';
import { requestCode, verifyCode } from '../auth/codes.js';
import { activePass, PLANS, stopRenewal } from '../billing/pass.js';
import { checkoutUrl, cancelRenewal } from '../billing/provider.js';
import { metroBySlug } from '../data/metros.js';
import { sendTelegram } from '../alerts/channels/telegram.js';
import { sendPush } from '../alerts/channels/push.js';
import { alertText } from '../alerts/deliver.js';
import { availability, skuBySlug } from './data.js';

export const json = (data, status = 200, headers = {}) => new Response(JSON.stringify(data), { status, headers: { 'content-type': 'application/json', 'cache-control': 'no-store', ...headers } });
const bad = (error, status = 400) => json({ ok: false, error }, status);
export const clientIp = (req) => req.headers.get('cf-connecting-ip') ?? '0.0.0.0';
/** Rate-limit key per network: IPv4 /24, IPv6 /48 (§7: 20 reads/min per network). */
export const netKey = (ip) => (ip.includes(':') ? ip.split(':').slice(0, 3).join(':') : ip.split('.').slice(0, 3).join('.'));
const BOT_RE = /bot|crawl|spider|slurp|bingpreview|facebookexternalhit|headless|lighthouse|python|curl|wget|httpclient|okhttp/i;

async function body(req) { try { return await req.json(); } catch { return {}; } }

async function lead(env, email, patch) {
  const t = now();
  await run(env, `INSERT INTO leads (email, step, sku_id, metro, source, created_at, updated_at) VALUES (?, ?, ?, ?, ?, ?, ?)
    ON CONFLICT(email) DO UPDATE SET step = CASE WHEN leads.step = 'paid' THEN 'paid' ELSE excluded.step END,
      sku_id = COALESCE(excluded.sku_id, leads.sku_id), metro = COALESCE(excluded.metro, leads.metro), updated_at = excluded.updated_at`,
  email, patch.step, patch.skuId ?? null, patch.metro ?? null, patch.source ?? null, t, t);
}

export async function api(env, req, url, ctx) {
  const p = url.pathname;
  const m = req.method;
  const user = await currentUser(env, req);

  // --- funnel ---
  if (p === '/api/funnel/start' && m === 'POST') {
    const b = await body(req);
    const email = String(b.email ?? '').trim().toLowerCase();
    if (!EMAIL_RE.test(email)) return bad('Enter a valid email address.');
    const sku = b.sku && !String(b.sku).startsWith('set:') ? await skuBySlug(env, b.sku) : null;
    await lead(env, email, { step: 'email', skuId: sku?.id, metro: metroBySlug[b.metro] ? b.metro : null, source: b.via ?? null });
    if (user?.email === email) return json({ ok: true, state: 'signed_in' });
    const existing = await userByEmail(env, email);
    if (existing) {
      // An existing account is only opened with a code: nobody can add alerts to someone else's account.
      const r = await requestCode(env, email, clientIp(req));
      return r.ok ? json({ ok: true, state: 'code' }) : bad(r.error, 429);
    }
    const u = await userByEmail(env, email, { create: true, source: 'funnel' });
    return json({ ok: true, state: 'new' }, 200, { 'set-cookie': await startSession(env, u.id) });
  }

  if (p === '/api/auth/code' && m === 'POST') {
    const r = await requestCode(env, (await body(req)).email, clientIp(req));
    return r.ok ? json({ ok: true }) : bad(r.error, 429);
  }
  if (p === '/api/auth/verify' && m === 'POST') {
    const b = await body(req);
    const r = await verifyCode(env, b.email, b.code);
    return r.ok ? json({ ok: true }, 200, { 'set-cookie': r.setCookie }) : bad(r.error);
  }
  if (p === '/api/signout' && m === 'POST') return json({ ok: true }, 200, { 'set-cookie': await endSession(env, req) });

  if (p === '/api/funnel/alert' && m === 'POST') {
    if (!user) return bad('Your session expired. Enter your email again.', 401);
    const b = await body(req);
    const plan = PLANS[b.plan] ? b.plan : 'solo';
    let skuId = null; let setId = null;
    if (String(b.sku).startsWith('set:')) setId = Number(String(b.sku).slice(4)) || null;
    else skuId = (await skuBySlug(env, b.sku))?.id ?? null;
    if (!skuId && !setId) return bad('Pick a product.');
    const kind = b.kind === 'online' ? 'online' : 'stores';
    if (kind === 'stores' && !metroBySlug[b.metro]) return bad('Pick your city.');
    const pass = await activePass(env, user.id);
    const effPlan = pass?.plan ?? plan;
    if (setId && effPlan !== 'multi') return bad('"Anything from a set" needs the Multi plan.');
    const count = (await one(env, "SELECT COUNT(*) n FROM alerts WHERE user_id = ? AND status != 'deleted'", user.id)).n;
    if (pass && count >= PLANS[pass.plan].maxAlerts) return bad(`Your ${PLANS[pass.plan].name} plan covers ${PLANS[pass.plan].maxAlerts} alert${PLANS[pass.plan].maxAlerts > 1 ? 's' : ''}. Delete one or switch to Multi.`);
    const channels = ['email', ...(b.push ? ['push'] : []), ...(b.telegram ? ['telegram'] : [])];
    const t = now();
    // Solo without a pass: keep a single pending alert (replace the previous draft)
    if (!pass) await run(env, "UPDATE alerts SET status = 'deleted', delete_reason = 'replaced_draft', updated_at = ? WHERE user_id = ? AND status = 'active'", t, user.id);
    await run(env, 'INSERT INTO alerts (user_id, kind, sku_id, set_id, metro, store_ids, channels, status, created_at, updated_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)',
      user.id, kind, skuId, setId, kind === 'stores' ? b.metro : null, '[]', JSON.stringify(channels), 'active', t, t);
    await lead(env, user.email, { step: pass ? 'paid' : 'checkout', skuId, metro: kind === 'stores' ? b.metro : null });
    await run(env, 'INSERT INTO events (at, visit, name, props) VALUES (?, ?, ?, ?)', t, b.visit ?? null, 'checkout_start', JSON.stringify({ plan, kind }));
    return json({ ok: true, next: pass ? '/account' : checkoutUrl(env, { plan, email: user.email }) });
  }

  // --- account ---
  if (p.startsWith('/api/me')) {
    if (!user) return bad('Sign in first.', 401);
    if (p === '/api/me/latest') {
      // the service worker asks what the newest alert was (pushes carry no payload)
      const r = await one(env, `SELECT r.*, k.name AS sku_name, k.slug AS sku_slug, l.url, s.name AS store_name, s.city, s.online FROM alert_sent x
        JOIN alerts a ON a.id = x.alert_id JOIN restocks r ON r.id = x.restock_id JOIN skus k ON k.id = r.sku_id JOIN listings l ON l.id = r.listing_id JOIN stores s ON s.id = r.store_id
        WHERE a.user_id = ? ORDER BY x.claimed_at DESC LIMIT 1`, user.id);
      if (!r) return json({ title: env.BRAND_NAME, body: 'Notifications are on. You will hear about the next restock here.', url: '/account' });
      const msg = alertText(env, r);
      return json({ title: msg.title, body: msg.line, url: msg.url ?? msg.page });
    }
    if (p === '/api/me/push' && m === 'POST') {
      const sub = (await body(req)).subscription;
      if (!sub?.endpoint) return bad('No subscription.');
      await run(env, 'UPDATE users SET push_endpoint = ?, push_keys = ? WHERE id = ?', sub.endpoint, JSON.stringify(sub.keys ?? {}), user.id);
      await run(env, `UPDATE alerts SET channels = json_insert(channels, '$[#]', 'push') WHERE user_id = ? AND status != 'deleted' AND NOT EXISTS (SELECT 1 FROM json_each(alerts.channels) WHERE value = 'push')`, user.id);
      return json({ ok: true });
    }
    if (p === '/api/me/telegram' && m === 'POST') {
      const token = crypto.randomUUID().replace(/-/g, '');
      await run(env, 'UPDATE users SET telegram_link_token = ? WHERE id = ?', token, user.id);
      await run(env, `UPDATE alerts SET channels = json_insert(channels, '$[#]', 'telegram') WHERE user_id = ? AND status != 'deleted' AND NOT EXISTS (SELECT 1 FROM json_each(alerts.channels) WHERE value = 'telegram')`, user.id);
      return json({ ok: true, url: `https://t.me/${env.TELEGRAM_BOT_NAME}?start=${token}` });
    }
    if (p === '/api/me/test' && m === 'POST') {
      const ch = (await body(req)).ch;
      const msg = { title: 'Test alert', line: `This is a test from ${env.BRAND_NAME}. Real alerts look like this.`, url: `${env.BASE_URL}/account`, page: env.BASE_URL };
      const ok = ch === 'telegram' ? await sendTelegram(env, user.telegram_chat_id, msg) : ch === 'push' ? await sendPush(env, user) : false;
      return ok ? json({ ok: true }) : bad(ch === 'push' ? 'This device did not accept the notification. Turn notifications on again.' : 'Telegram did not accept the message. Reconnect it.');
    }
    if (p === '/api/me/cancel' && m === 'POST') {
      await cancelRenewal(env, user);
      await stopRenewal(env, user.id);
      return json({ ok: true });
    }
    const am = p.match(/^\/api\/me\/alerts\/(\d+)$/);
    if (am && m === 'POST') {
      const b = await body(req);
      const a = await one(env, 'SELECT * FROM alerts WHERE id = ? AND user_id = ?', Number(am[1]), user.id);
      if (!a) return bad('Alert not found.', 404);
      const status = { pause: 'paused', resume: 'active', delete: 'deleted' }[b.act];
      if (!status) return bad('Unknown action.');
      await run(env, 'UPDATE alerts SET status = ?, delete_reason = ?, updated_at = ? WHERE id = ?', status, b.act === 'delete' ? String(b.reason ?? 'other').slice(0, 40) : null, now(), a.id);
      return json({ ok: true });
    }
  }

  // --- public live stock (rate limited per network) ---
  if (p === '/api/stock') {
    const k = await skuBySlug(env, url.searchParams.get('sku') ?? '');
    if (!k) return bad('Unknown product.', 404);
    const metro = metroBySlug[url.searchParams.get('metro')] ? url.searchParams.get('metro') : null;
    const rows = await availability(env, k.id, metro);
    return json({ product: k.name, checked: rows.map((r) => ({ retailer: r.source, store: r.online ? null : r.name, city: r.city, state: r.state, in_stock: !!r.in_stock, qty: r.qty, checked_at: r.seen_at })) });
  }

  // --- measurement beacon, no cookie (§0.3) ---
  if (p === '/api/e' && m === 'POST') {
    const b = await body(req);
    const ua = req.headers.get('user-agent') ?? '';
    const name = String(b.n ?? '').slice(0, 40);
    if (!name) return new Response(null, { status: 204 });
    const device = /iphone|ipad/i.test(ua) ? 'ios' : /android/i.test(ua) ? 'android' : 'desktop';
    ctx.waitUntil(run(env, 'INSERT INTO events (at, visit, name, path, source, device, bot, props) VALUES (?, ?, ?, ?, ?, ?, ?, ?)',
      now(), String(b.v ?? '').slice(0, 40), name, String(b.p ?? '').slice(0, 200), String(b.s ?? '').slice(0, 60), device, BOT_RE.test(ua) ? 1 : 0, b.x ? JSON.stringify(b.x).slice(0, 500) : null));
    return new Response(null, { status: 204 });
  }

  return bad('Not found.', 404);
}
