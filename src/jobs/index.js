// Scheduled work. One cron fires every minute; hourly and nightly jobs branch on the time.
import { guidePath } from '../web/pages/where_buy.js';
import { all, one, run, now, report } from '../lib/db.js';
import { planMinute } from '../crawler/plan.js';
import { flushOutbox, queueEmail } from '../email/outbox.js';
import { heal } from '../alerts/pipeline.js';
import { announce } from '../crawler/lotteries.js';
import { alertText } from '../alerts/deliver.js';
import { sourceName } from '../sources/index.js';

import { dataPath, thirtyPath } from '../web/pages/local_data.js';
const HOUR = 3600e3;

/** One-off relaunch email (approved by Eugène 2026-11-03): everyone who left an email but has no active alert. Runs once. */
async function relaunchOnce(env) {
  const s = await one(env, "SELECT value FROM settings WHERE key = 'relaunch.2026-11-03'");
  if (s || !env.RESEND_API_KEY) return 'skip';
  await run(env, "INSERT INTO settings (key, value, updated_at) VALUES ('relaunch.2026-11-03', 'sending', ?)", now());
  const owners = String(env.OWNER_EMAILS ?? '').toLowerCase().split(',').map((x) => x.trim());
  const rows = await all(env, `SELECT email, sku_id FROM leads WHERE email NOT IN (SELECT u.email FROM users u JOIN alerts a ON a.user_id = u.id AND a.status = 'active')
    UNION SELECT u.email, NULL FROM users u WHERE NOT EXISTS (SELECT 1 FROM alerts a WHERE a.user_id = u.id AND a.status = 'active') AND u.email NOT IN (SELECT email FROM leads)`);
  let n = 0;
  for (const r of rows) {
    const email = String(r.email).toLowerCase();
    if (!email.includes('@') || owners.includes(email)) continue;
    const k = r.sku_id ? await one(env, `SELECT k.name, k.slug, (SELECT l.country FROM listings l WHERE l.sku_id = k.id AND l.active = 1 GROUP BY l.country ORDER BY COUNT(*) DESC LIMIT 1) AS cc FROM skus k WHERE k.id = ?`, r.sku_id) : null;
    const link = `${env.BASE_URL}/alerts?${new URLSearchParams({ c: k?.cc ?? 'us', ...(k ? { sku: k.slug } : {}) })}`;
    const subject = k ? `Your ${k.name} alert is now free` : 'Your restock alert is now free';
    const text = `Hi,\n\nYou started a restock alert on Card Restock Tracker${k ? ` for ${k.name}` : ''}, but it never switched on. That was a bug on our side, sorry about that.\n\nGood news: alerts are now free during our launch. Turn yours on in one minute:\n${link}\n\nWe check 190 card shops in 11 countries around the clock and email you as soon as it is back in stock.\n\nEugène, Card Restock Tracker\n\nDon't want these emails? Reply "stop" and we won't write again.`;
    await queueEmail(env, { to: email, kind: 'relaunch', subject, text });
    n++;
  }
  await run(env, "UPDATE settings SET value = ?, updated_at = ? WHERE key = 'relaunch.2026-11-03'", `queued ${n}`, now());
  return n;
}

/** One-off feedback ask (text approved by Eugène 2026-11-11): every account, once. French for France, English otherwise. */
async function feedbackAskOnce(env) {
  const key = 'feedbackask.2026-11-11';
  if (await one(env, 'SELECT 1 FROM settings WHERE key = ?', key) || !env.RESEND_API_KEY) return 'skip';
  await run(env, "INSERT INTO settings (key, value, updated_at) VALUES (?, 'sending', ?)", key, now());
  const owners = String(env.OWNER_EMAILS ?? '').toLowerCase().split(',').map((x) => x.trim());
  const rows = await all(env, 'SELECT email, country FROM users');
  let n = 0;
  for (const r of rows) {
    const email = String(r.email ?? '').toLowerCase();
    if (!email.includes('@') || owners.includes(email) || /@example\.(test|com)$/.test(email)) continue;
    const cc = r.country && r.country !== 'jp' ? r.country : 'us';
    const link = `${env.BASE_URL}${cc === 'us' ? '/' : `/${cc}`}#feedback`;
    const fr = cc === 'fr';
    const subject = fr ? 'Une petite question de Card Restock Tracker (30 secondes)' : 'Quick question from Card Restock Tracker (30 seconds)';
    const text = fr
      ? `Salut,\n\nTu t'es inscrit sur Card Restock Tracker, alors d'abord : merci !\n\nJe suis un fan du JCC Pokémon qui construit ce site tout seul, et j'aimerais ton avis pour choisir la suite :\n- Ton pays n'est pas encore là ?\n- Quel jeu de cartes on suit ensuite : One Piece, Lorcana, Magic, Yu-Gi-Oh!… ?\n- Un truc qui t'agace, ou que tu aimerais voir ?\n\nÇa prend 30 secondes : ${link}\n\nOu réponds simplement à cet e-mail, je lis tout.\n\nMerci, et bonne chance pour ton prochain réassort !\nEugène, Card Restock Tracker\n\nTu ne veux plus de ces e-mails ? Réponds « stop » et on ne t'écrira plus.`
      : `Hi,\n\nYou signed up on Card Restock Tracker, so first: thank you!\n\nI'm a Pokémon TCG fan building this on my own, and I'd love your help choosing what comes next:\n- Is your country missing?\n- Which card game should we track next: One Piece, Lorcana, Magic, Yu-Gi-Oh!…?\n- Anything that bugs you, or that you'd like to see?\n\nIt takes 30 seconds: ${link}\n\nOr just hit reply, I read everything.\n\nThanks, and good luck with your next restock!\nEugène, Card Restock Tracker\n\nDon't want these emails? Reply "stop" and we won't write again.`;
    // not sent inline: the minute cron sends them, paced, 50 a minute
    await queueEmail(env, { to: email, kind: 'feedback_ask', subject, text, notBefore: now() + 60e3 });
    n++;
  }
  await run(env, 'UPDATE settings SET value = ?, updated_at = ? WHERE key = ?', `queued ${n}`, now(), key);
  return n;
}

// One-off: a real alert email to the owner's account, built exactly like a live restock alert.
async function testAlertOnce(env) {
  const key = 'testalert.2026-11-03b';
  if (await one(env, 'SELECT 1 FROM settings WHERE key = ?', key) || !env.RESEND_API_KEY) return 'skip';
  await run(env, 'INSERT INTO settings (key, value, updated_at) VALUES (?, ?, ?)', key, 'sending', now());
  const owner = String(env.OWNER_EMAILS ?? '').split(',')[0].trim().toLowerCase();
  const u = await one(env, 'SELECT id, email FROM users WHERE lower(email) = ?', owner);
  const sql = `SELECT r.*, k.name AS sku_name, k.slug AS sku_slug, l.url, s.name AS store_name, s.city, s.online, s.country
    FROM restocks r JOIN skus k ON k.id = r.sku_id JOIN listings l ON l.id = r.listing_id JOIN stores s ON s.id = r.store_id`;
  const r = (u && await one(env, `${sql} WHERE r.sku_id IN (SELECT sku_id FROM alerts WHERE user_id = ? AND status = 'active') ORDER BY r.started_at DESC LIMIT 1`, u.id))
    ?? await one(env, `${sql} ORDER BY r.started_at DESC LIMIT 1`);
  if (!r) { await run(env, 'UPDATE settings SET value = ? WHERE key = ?', 'no restock', key); return 'none'; }
  const msg = alertText(env, r);
  await queueEmail(env, { userId: u?.id, to: u?.email ?? owner, kind: 'alert', subject: `[Test] ${msg.title}`,
    text: `${msg.line}\n\nBuy or reserve: ${msg.url}\nLive stock: ${msg.page}\n\nStock moves within minutes. Check the retailer before you travel.` });
  await run(env, 'UPDATE settings SET value = ?, updated_at = ? WHERE key = ?', `queued ${r.sku_slug}`, now(), key);
  return 'queued';
}

/** Once a day: hand every sitemap URL to IndexNow (Bing, which ChatGPT search reads), plus the hourly data pages. */
export async function indexNowAll(env, only = null) {
  if (!env.INDEXNOW_KEY || !env.BASE_URL?.startsWith('https')) return 'skip';
  let urls = only;
  if (!urls) {
    const { sitemap } = await import('../seo/sitemap.js');
    urls = [...(await (await sitemap(env)).text()).matchAll(/<loc>([^<]+)<\/loc>/g)].map((m) => m[1]);
  }
  const host = new URL(env.BASE_URL).host;
  for (let i = 0; i < urls.length; i += 10000) {
    await fetch('https://api.indexnow.org/indexnow', { method: 'POST', headers: { 'content-type': 'application/json; charset=utf-8' },
      body: JSON.stringify({ host, key: env.INDEXNOW_KEY, keyLocation: `${env.BASE_URL}/${env.INDEXNOW_KEY}.txt`, urlList: urls.slice(i, i + 10000) }) }).catch(() => {});
  }
  return urls.length;
}

export async function everyMinute(env) {
  const out = {};
  out.plan = await planMinute(env).catch((e) => ({ error: e.message }));
  out.test = await testAlertOnce(env).catch((e) => ({ error: e.message }));
  out.relaunch = await relaunchOnce(env).catch((e) => ({ error: e.message }));
  out.feedbackAsk = await feedbackAskOnce(env).catch((e) => ({ error: e.message }));
  out.emails = await flushOutbox(env).catch((e) => ({ error: e.message }));
  out.lotteries = await announce(env).then(() => 'ok').catch((e) => ({ error: e.message })); // Japan: opening / closing-soon notices
  // heartbeat + visible errors for the owner page
  await run(env, "INSERT INTO settings (key, value, updated_at) VALUES ('cron.last', ?, ?) ON CONFLICT(key) DO UPDATE SET value = excluded.value, updated_at = excluded.updated_at", JSON.stringify(out).slice(0, 500), now());
  // stuck stock rows: a pending sold-out never confirmed (source went quiet) → drop the pending mark after 15 min
  await run(env, 'UPDATE stock SET pending_out_at = NULL WHERE pending_out_at IS NOT NULL AND pending_out_at < ?', now() - 15 * 60e3);
  return out;
}

/** Hourly roll-up into mk_stats: owner pages read this, never raw events (§0.4). */
export async function rollup(env, hourStart) {
  const a = hourStart; const b = hourStart + HOUR;
  const put = (metric, dim, value) => run(env, 'INSERT INTO mk_stats (hour, metric, dim, value) VALUES (?, ?, ?, ?) ON CONFLICT(hour, metric, dim) DO UPDATE SET value = excluded.value', a, metric, dim ?? '', value ?? 0);
  const visits = await all(env, "SELECT COALESCE(NULLIF(source,''),'direct') src, device, COUNT(DISTINCT visit) n FROM events WHERE at >= ? AND at < ? AND bot = 0 AND name = 'view' GROUP BY 1, 2", a, b);
  for (const v of visits) { await put('visits', `src:${v.src}`, v.n); }
  const byDev = {}; for (const v of visits) byDev[v.device] = (byDev[v.device] ?? 0) + v.n;
  for (const [d, n] of Object.entries(byDev)) await put('visits', `dev:${d}`, n);
  await put('visits', '', visits.reduce((s, v) => s + v.n, 0));
  for (const e of await all(env, 'SELECT name, COUNT(DISTINCT COALESCE(visit, id)) n FROM events WHERE at >= ? AND at < ? AND bot = 0 GROUP BY name', a, b)) await put('event', e.name, e.n);
  await put('leads', '', (await one(env, 'SELECT COUNT(*) n FROM leads WHERE created_at >= ? AND created_at < ?', a, b)).n);
  const pay = await one(env, "SELECT COUNT(*) n, COALESCE(SUM(amount),0) s FROM payments WHERE at >= ? AND at < ? AND (kind LIKE '%succeeded%' OR kind LIKE '%went_valid%')", a, b);
  await put('paid', '', pay.n); await put('revenue', '', pay.s);
  await put('restocks', '', (await one(env, 'SELECT COUNT(*) n FROM restocks WHERE started_at >= ? AND started_at < ?', a, b)).n);
  await put('alerts_sent', '', (await one(env, "SELECT COUNT(*) n FROM alert_sent WHERE claimed_at >= ? AND claimed_at < ? AND status IN ('sent','held')", a, b)).n);
  for (const r of await all(env, "SELECT delete_reason r, COUNT(*) n FROM alerts WHERE updated_at >= ? AND updated_at < ? AND status = 'deleted' AND delete_reason != 'replaced_draft' GROUP BY 1", a, b)) await put('alert_deleted', r.r, r.n);
}

export async function hourly(env) {
  const t = now();
  await (await import('../crawler/merge.js')).mergeSkus(env).catch(() => {}); // one page per product
  await rollup(env, Math.floor(t / HOUR) * HOUR - HOUR);
  // One follow-up per lead who left the funnel: 2 h to 48 h after, never twice (§2).
  const leads = await all(env, `SELECT l.*, k.name AS sku_name, k.slug FROM leads l LEFT JOIN skus k ON k.id = l.sku_id
    WHERE l.step != 'paid' AND l.followed_up_at IS NULL AND l.updated_at < ? AND l.updated_at > ? LIMIT 200`, t - 2 * HOUR, t - 48 * HOUR);
  for (const l of leads) {
    const last = l.sku_id ? await one(env, 'SELECT r.started_at, r.ended_at FROM restocks r WHERE r.sku_id = ? ORDER BY r.started_at DESC LIMIT 1', l.sku_id) : null;
    const what = l.sku_name ?? 'the product you picked';
    await queueEmail(env, { to: l.email, kind: 'followup', subject: `${what}: your alert is not on yet`,
      text: `You started an alert for ${what} but did not finish.${last ? ` The last restock we saw was ${new Date(last.started_at).toUTCString()}${last.ended_at ? ` and it sold out in ${Math.max(1, Math.round((last.ended_at - last.started_at) / 60e3))} minutes` : ''}.` : ''}\n\nFinish in one minute: ${env.BASE_URL}/alerts${l.slug ? `?sku=${l.slug}` : ''}\n\nThis is the only reminder we send.\n${env.BRAND_NAME}` });
    await run(env, 'UPDATE leads SET followed_up_at = ? WHERE email = ?', t, l.email);
  }
  // Passes that end in 3 days and will not renew: one reminder.
  for (const p of await all(env, `SELECT p.id, u.email, p.ends_at FROM passes p JOIN users u ON u.id = p.user_id
      WHERE p.status = 'active' AND p.renews = 0 AND p.ends_at BETWEEN ? AND ? AND NOT EXISTS (SELECT 1 FROM reports r WHERE r.kind = 'pass_reminder' AND r.text = CAST(p.id AS TEXT))`, t + 71 * HOUR, t + 72 * HOUR)) {
    await queueEmail(env, { to: p.email, kind: 'reminder', subject: 'Your restock alerts stop in 3 days', text: `Your alerts stop on ${new Date(p.ends_at).toUTCString()}. Keep them on: ${env.BASE_URL}/account\n${env.BRAND_NAME}` });
    await report(env, 'pass_reminder', String(p.id));
  }
}

/** Free plan: one email a day with the restocks the person's free alert matched since the last one. */
export async function dailyFree(env) {
  const rows = await all(env, `SELECT x.alert_id, x.restock_id, u.id AS user_id, u.email, k.name AS sku_name, k.slug, s.name AS store_name, s.city, s.online, s.source, s.country, r.started_at, r.ended_at
    FROM alert_sent x JOIN alerts a ON a.id = x.alert_id JOIN users u ON u.id = a.user_id JOIN restocks r ON r.id = x.restock_id
    JOIN skus k ON k.id = r.sku_id JOIN stores s ON s.id = r.store_id WHERE x.status = 'daily' ORDER BY r.started_at LIMIT 5000`);
  const byUser = new Map();
  for (const r of rows) { if (!byUser.has(r.user_id)) byUser.set(r.user_id, []); byUser.get(r.user_id).push(r); }
  for (const list of byUser.values()) {
    const first = list[0];
    const lines = list.slice(0, 30).map((r) => `- ${new Date(r.started_at).toUTCString().slice(0, 22)} UTC: ${r.online ? `${sourceName(r.source)} online` : `${sourceName(r.source)} ${r.store_name}, ${r.city}`}${r.ended_at ? ` (sold out after ${Math.max(1, Math.round((r.ended_at - r.started_at) / 60e3))} min)` : ''}`);
    await queueEmail(env, { to: first.email, kind: 'digest', subject: `${first.sku_name}: ${list.length} restock${list.length > 1 ? 's' : ''} yesterday`,
      text: `Your free daily summary for ${first.sku_name}:\n\n${lines.join('\n')}\n\nMost restocks sell out within minutes. Get each one the second it lands (phone notification, Telegram or email): ${env.BASE_URL}/alerts?sku=${first.slug}&c=${first.country}\n\nLive stock: ${env.BASE_URL}/${first.country}/${first.slug}\n${env.BRAND_NAME}` });
    for (const r of list) await run(env, "UPDATE alert_sent SET status = 'sent', channels_ok = 'daily_email' WHERE alert_id = ? AND restock_id = ?", r.alert_id, r.restock_id);
  }
  return byUser.size;
}

export async function nightly(env) {
  const t = now();
  const text = await heal(env);
  await run(env, "UPDATE passes SET status = 'expired' WHERE status IN ('active','refunded_kept') AND ends_at < ?", t);
  await run(env, 'DELETE FROM events WHERE at < ?', t - 90 * 864e5);
  await run(env, 'DELETE FROM login_codes WHERE created_at < ?', t - 864e5);
  await run(env, 'DELETE FROM sessions WHERE expires_at < ?', t);
  await run(env, "DELETE FROM settings WHERE key LIKE 'indexnow:%' AND updated_at < ?", t - 864e5);
  await run(env, 'DELETE FROM email_outbox WHERE sent_at IS NOT NULL AND sent_at < ?', t - 30 * 864e5);
  return text;
}

export async function scheduled(env, when) {
  const d = new Date(when);
  await everyMinute(env);
  if (d.getUTCMinutes() === 5) await hourly(env);
  if (d.getUTCHours() === 3 && d.getUTCMinutes() === 15) await nightly(env);
  if (d.getUTCHours() === 13 && d.getUTCMinutes() === 20) await dailyFree(env); // ≈ 9 am New York
  if (d.getUTCHours() === 14 && d.getUTCMinutes() === 10) await indexNowAll(env).catch(() => {});
  else if (d.getUTCMinutes() === 12) await indexNowAll(env, ['/pokemon-restock-data', '/llms.txt', '/', ...['uk', 'ca', 'au', 'de', 'fr', 'nl', 'it', 'es', 'mx', 'cl'].flatMap((c) => [dataPath(c), thirtyPath(c), guidePath(c, '30th-etb'), guidePath(c, 'delta-reign')]), thirtyPath('us'), guidePath('us', '30th-etb'), guidePath('us', 'delta-reign'), '/where-to-buy-30th-celebration-elite-trainer-box', '/where-to-buy-delta-reign'].map((p) => `${env.BASE_URL}${p}`)).catch(() => {});
}
