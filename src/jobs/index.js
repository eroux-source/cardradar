// Scheduled work. One cron fires every minute; hourly and nightly jobs branch on the time.
import { all, one, run, now, report } from '../lib/db.js';
import { planMinute } from '../crawler/plan.js';
import { flushOutbox, queueEmail } from '../email/outbox.js';
import { heal } from '../alerts/pipeline.js';
import { announce } from '../crawler/lotteries.js';

const HOUR = 3600e3;

export async function everyMinute(env) {
  const out = {};
  out.plan = await planMinute(env).catch((e) => ({ error: e.message }));
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
}
