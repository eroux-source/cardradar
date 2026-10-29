// Worker entry: HTTP routes, the minute cron, and the four queue consumers.
import { now, run, one } from './lib/db.js';
import { currentUser } from './auth/session.js';
import { googleStart, googleCallback } from './auth/google.js';
import { billingWebhook, fakeCheckout } from './billing/provider.js';
import { telegramWebhook } from './alerts/channels/telegram.js';
import { runTask } from './crawler/run.js';
import { matchRestocks } from './alerts/pipeline.js';
import { deliver } from './alerts/deliver.js';
import { scheduled as cron } from './jobs/index.js';
import { api, json, clientIp, netKey } from './web/api.js';
import * as pub from './web/pages/public.js';
import { alertsPage, signinPage, accountPage } from './web/pages/funnel.js';
import { sitemap, robots, llms } from './seo/sitemap.js';
import { ownerAllowed, monitor, marketing, ownerSettings, bakeoff } from './owner/index.js';
import { jpHome, jpSet, jpShop } from './web/pages/lottery.js';
import { bestTrackers, versus, howItWorks } from './web/pages/compare.js';
import { lineWebhook } from './alerts/channels/line.js';
import { COUNTRIES } from './data/countries.js';
import { setEnv } from './sources/index.js';
export { Relay } from './relay.js';
import { ownerLottery } from './owner/lottery.js';
import { applyReading } from './crawler/state.js';
import { publishRestocks } from './alerts/pipeline.js';

const notFound = (env, cc = 'us') => pub.notFound(env, cc);
const tooMany = () => new Response('Too many requests from your network. Wait a minute.', { status: 429, headers: { 'retry-after': '60' } });

async function limited(env, req) {
  if (!env.PAGE_RL) return false;
  const { success } = await env.PAGE_RL.limit({ key: netKey(clientIp(req)) });
  return !success;
}

async function route(req, env, ctx) {
  const url = new URL(req.url);
  const p = url.pathname.replace(/\/+$/, '') || '/';
  const m = req.method;

  // canonical: no trailing slash
  if (url.pathname !== p && m === 'GET') return Response.redirect(`${env.BASE_URL}${p}${url.search}`, 301);

  // --- machine endpoints ---
  if (p === '/api/health') {
    const last = await one(env, 'SELECT MAX(seen_at) t FROM stock');
    // public, harmless: which retailers answer (status only, no error text)
    const src = await env.DB.prepare(`SELECT h.source, h.status, h.last_ok_at, h.last_error,
      (SELECT COUNT(*) FROM listings l WHERE l.source = h.source AND l.active = 1) AS listings,
      (SELECT COUNT(*) FROM stock k JOIN stores s ON s.id = k.store_id WHERE s.source = h.source) AS readings FROM source_health h`).all();
    const c = await one(env, 'SELECT (SELECT COUNT(*) FROM listings WHERE active = 1) listings, (SELECT COUNT(*) FROM stock) readings, (SELECT COUNT(*) FROM stock WHERE in_stock = 1) in_stock');
    const bw = await one(env, "SELECT value, updated_at FROM settings WHERE key = 'billing.last_webhook'");
    const day = now() - 864e5;
    const aud = await one(env, "SELECT COUNT(DISTINCT visit) visits, COUNT(*) views FROM events WHERE at > ? AND name = 'view' AND bot = 0", day);
    const audAll = await one(env, "SELECT COUNT(DISTINCT visit) visits, COUNT(*) views, MIN(at) since FROM events WHERE name = 'view' AND bot = 0");
    const srcs = (await env.DB.prepare("SELECT COALESCE(NULLIF(source,''),'direct') s, COUNT(DISTINCT visit) n FROM events WHERE at > ? AND name = 'view' AND bot = 0 GROUP BY 1 ORDER BY n DESC LIMIT 6").bind(day).all()).results;
    const bots = await one(env, "SELECT COUNT(*) n FROM events WHERE at > ? AND bot = 1", day);
    const rs = await one(env, 'SELECT COUNT(*) restocks, SUM(ended_at IS NOT NULL) sold_out_again, SUM(ended_at IS NULL) still_in FROM restocks WHERE started_at > ?', day);
    const durs = (await env.DB.prepare('SELECT ended_at - started_at d FROM restocks WHERE started_at > ? AND ended_at IS NOT NULL ORDER BY d').bind(now() - 7 * 864e5).all()).results.map((r) => r.d);
    const med = durs.length ? Math.round(durs[Math.floor(durs.length / 2)] / 60e3) : null;
    // Interval test: sold-out shop products in the test group (id ending in 0) are read every 10 min.
    // For each restock seen there, a product read every I minutes would have caught it with
    // probability min(1, duration / I). Averaged over restocks: the share each interval catches.
    const tnow = now();
    const tl = (await env.DB.prepare(`SELECT COALESCE(ended_at, ?) - started_at d FROM restocks WHERE started_at > ? AND listing_id % 10 = 0 AND source LIKE 'shop%' ORDER BY d`).bind(tnow, tnow - 7 * 864e5).all()).results.map((r) => r.d);
    const interval_test = { restocks_7d: tl.length, median_minutes: tl.length ? Math.round(tl[Math.floor(tl.length / 2)] / 60e3) : null,
      under_1h: tl.filter((d) => d < 3600e3).length,
      catch_pct: Object.fromEntries([10, 30, 60, 120, 360, 1440].map((m) => [`every_${m}min`, tl.length ? Math.round((100 * tl.reduce((a, d) => a + Math.min(1, d / (m * 60e3)), 0)) / tl.length) : null])) };
    return json({ ok: true, restocks_24h: { ...rs, median_minutes_in_stock_7d: med, measured: durs.length }, interval_test, audience: { last_24h: aud, all_time: audAll, sources_24h: srcs, bot_hits_24h: bots?.n ?? 0 }, billing: { api_key_set: !!env.WHOP_API_KEY, webhook_secret_set: !!env.WHOP_WEBHOOK_SECRET, plans: [env.WHOP_PLAN_SOLO, env.WHOP_PLAN_MULTI], last_webhook: bw ? { ...JSON.parse(bw.value), at: bw.updated_at } : null }, last_read: last?.t ?? null, age_s: last?.t ? Math.round((now() - last.t) / 1000) : null, counts: c,
      sources: Object.fromEntries(src.results.map((r) => [r.source, { status: r.status, http: Number(/\s(\d{3})\s/.exec(r.last_error ?? '')?.[1]) || null, err: String(r.last_error ?? '').replace(/https?:\/\/[^\s?]+\?[^\s]*/g, '').slice(0, 320), listings: r.listings, readings: r.readings, last_ok_s: r.last_ok_at ? Math.round((now() - r.last_ok_at) / 1000) : null }])) });
  }
  if (p === '/api/billing/webhook' && m === 'POST') return billingWebhook(env, req);
  if (p === '/api/telegram/webhook' && m === 'POST') return telegramWebhook(env, req);
  if (p === '/api/line/webhook' && m === 'POST') return lineWebhook(env, req);
  if (p === '/dev/fake-checkout') return fakeCheckout(env, url);
  if (p === '/dev/restock' && env.DEV_TOOLS === '1') {
    // local test only: makes one listing go sold out → in stock at one store, like a real restock
    const row = await one(env, `SELECT k.listing_id, k.store_id, l.sku_id, l.source FROM stock k JOIN listings l ON l.id = k.listing_id JOIN skus s ON s.id = l.sku_id
      JOIN stores st ON st.id = k.store_id WHERE s.slug = ? AND (st.metro = ? OR (? = '' AND st.online = 1)) ORDER BY k.in_stock LIMIT 1`, url.searchParams.get('sku'), url.searchParams.get('metro') ?? '', url.searchParams.get('metro') ?? '');
    if (!row) return json({ ok: false });
    await run(env, 'UPDATE stock SET in_stock = 0, flips = \'\', quarantined_until = NULL WHERE listing_id = ? AND store_id = ?', row.listing_id, row.store_id);
    const id = await applyReading(env, { listingId: row.listing_id, skuId: row.sku_id, source: row.source, storeId: row.store_id, inStock: true, qty: 3, at: now() });
    if (id) await publishRestocks(env, [id]);
    return json({ ok: true, restock: id, sent: await one(env, 'SELECT * FROM alert_sent WHERE restock_id = ?', id) });
  }
  if (p === '/dev/daily' && env.DEV_TOOLS === '1') return json({ users: await (await import('./jobs/index.js')).dailyFree(env) });
  if (p === '/api/stock' && await limited(env, req)) return tooMany();
  if (p.startsWith('/api/')) return api(env, req, url, ctx);
  if (p === '/auth/google') return googleStart(env, url.searchParams.get('next') ?? '/account');
  if (p === '/auth/google/callback') return googleCallback(env, url);

  // --- SEO files ---
  if (p === '/sitemap.xml') return sitemap(env);
  if (p === '/robots.txt') return robots(env);
  if (p === '/llms.txt') return llms(env);
  if (env.INDEXNOW_KEY && p === `/${env.INDEXNOW_KEY}.txt`) return new Response(env.INDEXNOW_KEY, { headers: { 'content-type': 'text/plain' } });

  // --- owner ---
  if (p.startsWith('/owner')) {
    if (!ownerAllowed(env, req, url)) return new Response('Accès réservé.', { status: 403 });
    if (p === '/owner/monitor') return monitor(env, url);
    if (p === '/owner/marketing') return marketing(env, url);
    if (p === '/owner/bakeoff') return bakeoff(env, url);
    if (p === '/owner/debug') {
      // small, indexed counts only (never heavy SQL on prod)
      const c = await one(env, `SELECT (SELECT COUNT(*) FROM listings) listings, (SELECT COUNT(*) FROM lanes) lanes, (SELECT COUNT(*) FROM stores) stores,
        (SELECT COUNT(*) FROM stock) stock, (SELECT COUNT(*) FROM source_health) health`);
      const s2 = await env.DB.prepare("SELECT key, value, updated_at FROM settings WHERE key LIKE 'discovery.%' OR key LIKE 'cron.%'").all();
      const rep = await env.DB.prepare('SELECT kind, at, text FROM reports ORDER BY at DESC LIMIT 15').all();
      return json({ now: now(), counts: c, settings: s2.results, reports: rep.results });
    }
    if (p === '/owner/run') {
      // run one crawl task inline and show what happens (diagnosis)
      const task = { t: url.searchParams.get('t') ?? 'search', source: url.searchParams.get('source') ?? 'target', q: url.searchParams.get('q') ?? 'pokemon elite trainer box' };
      try { await runTask(env, task); return json({ ok: true, task, counts: await one(env, 'SELECT (SELECT COUNT(*) FROM listings) listings, (SELECT COUNT(*) FROM source_health) health') }); }
      catch (e) { return json({ ok: false, task, error: String(e.stack ?? e).slice(0, 1500) }); }
    }
    if (p === '/owner/settings' && m === 'POST') return ownerSettings(env, req, url);
    if (p === '/owner/lottery') return ownerLottery(env, req, url);
    return Response.redirect(`${env.BASE_URL}/owner/monitor${url.search}`, 302);
  }

  if (m !== 'GET' && m !== 'HEAD') return new Response('Method not allowed', { status: 405 });

  // --- funnel & account (need the session) ---
  if (p === '/alerts') return alertsPage(env, url, await currentUser(env, req));
  if (p === '/signin') return signinPage(env, url);
  if (p === '/account') return accountPage(env, url, await currentUser(env, req));

  // --- public pages ---
  // US lives at the root (/, /us/...); other countries at /{cc}, /{cc}/...
  if (p === '/') return pub.home(env, 'us');
  if (p === '/us') return Response.redirect(`${env.BASE_URL}/`, 301);
  if (p === '/pricing') return pub.pricing(env, COUNTRIES[url.searchParams.get('c')] ? url.searchParams.get('c') : 'us');
  if (p === '/press') return pub.press(env);
  if (p === '/best-pokemon-restock-trackers') return bestTrackers(env);
  if (p === '/how-it-works') return howItWorks(env);
  if (p.startsWith('/vs/')) return (await versus(env, p.slice(4))) ?? notFound(env);
  if (p === '/terms' || p === '/privacy') return pub.legal(env, p.slice(1));
  const seg = p.split('/').filter(Boolean);
  const cc = seg[0];
  if (cc === 'jp') {
    if (seg.length === 1) return jpHome(env);
    if (seg[1] === 'set' && seg[2] && seg.length === 3) return (await jpSet(env, seg[2])) ?? notFound(env, 'jp');
    if (seg[1] === 'shop' && seg[2] && seg.length === 3) return (await jpShop(env, seg[2])) ?? notFound(env, 'jp');
    return notFound(env, 'jp');
  }
  if (COUNTRIES[cc]) {
    if (seg.length === 1) return pub.home(env, cc);
    if (seg[1] === 'pricing' && seg.length === 2) return pub.pricing(env, cc);
    if (seg[1] === 'search' && seg.length === 2) return pub.search(env, cc, url.searchParams.get('q') ?? '');
    let res = null;
    if (seg[1] === 'restocks') res = seg[2] ? await pub.cityRestocks(env, cc, seg[2]) : await pub.allRestocks(env, cc);
    else if (seg[1] === 'cities' && seg.length === 2) res = await pub.cities(env, cc);
    else if (seg[1] === 'retailers' && seg.length === 2) res = await pub.retailers(env, cc);
    else if (seg[1] === 'retailer' && seg[2]) res = await pub.retailerPage(env, cc, seg[2]);
    else if (seg[1] === 'store' && seg[2]) {
      if (await limited(env, req)) return tooMany(); // store pages: 20 reads / min / network
      res = seg[3] === 'restocks' ? await pub.storeRestocks(env, cc, seg[2]) : seg.length === 3 ? await pub.store(env, cc, seg[2]) : null;
    } else if (seg[1] && seg.length === 2) res = await pub.sku(env, cc, seg[1]);
    else if (seg[1] && seg[2] === 'restocks' && seg.length === 3) res = await pub.skuRestocks(env, cc, seg[1]);
    else if (seg[1] && seg[2] && seg.length === 3) res = await pub.sku(env, cc, seg[1], seg[2]);
    if (res) return res;
    return notFound(env, cc);
  }
  return notFound(env);
}

export default {
  async fetch(req, env, ctx) {
    setEnv(env);
    try {
      return await route(req, env, ctx);
    } catch (e) {
      console.error(e);
      return new Response('Something went wrong on our side. Try again in a minute.', { status: 500 });
    }
  },

  async scheduled(event, env, ctx) {
    setEnv(env);
    ctx.waitUntil(cron(env, event.scheduledTime));
  },

  async queue(batch, env) {
    setEnv(env);
    const q = batch.queue;
    for (const msg of batch.messages) {
      try {
        if (q.endsWith('-crawl')) await runTask(env, msg.body);
        else if (q.endsWith('-alerts')) await matchRestocks(env, msg.body.restockIds, { late: !!msg.body.late });
        else if (q.endsWith('-deliver')) await deliver(env, msg.body);
        else if (q.endsWith('-dead')) {
          await run(env, 'INSERT INTO dead_letters (queue, body, error, at) VALUES (?, ?, ?, ?)', q, JSON.stringify(msg.body).slice(0, 4000), msg.body?.error ?? null, now());
          if (msg.body?.alertId) await run(env, "UPDATE alert_sent SET status = 'failed' WHERE alert_id = ? AND restock_id = ? AND status = 'claimed'", msg.body.alertId, msg.body.restockId);
        }
        msg.ack();
      } catch (e) {
        console.error(q, e);
        await run(env, 'INSERT INTO reports (kind, at, text) VALUES (?, ?, ?)', 'queue_error', now(), `${q}: ${String(e.message ?? e).slice(0, 400)}`).catch(() => {});
        msg.retry();
      }
    }
  },
};
