// One delivery = one alert × one restock.
// Push + Telegram in parallel; email only if neither reached the person
// (cut emails ~85 % on InStock Radar). Email alerts: max 1 per hour per person,
// the rest is held in email_outbox and sent as a digest, never dropped.
import { one, run, now, isFlagOn } from '../lib/db.js';
import { sourceName } from '../sources/index.js';
import { sendTelegram } from './channels/telegram.js';
import { sendPush } from './channels/push.js';
import { queueEmail } from '../email/outbox.js';

export function alertText(env, r) {
  const where = r.online ? `${sourceName(r.source)} online` : `${sourceName(r.source)} ${r.store_name}, ${r.city}`;
  const qty = r.qty > 1 ? ` (${r.qty} available)` : '';
  return {
    title: `In stock: ${r.sku_name}`,
    line: `${r.sku_name} is in stock at ${where}${qty}.`,
    url: r.url,
    page: `${env.BASE_URL}/us/${r.sku_slug}`,
  };
}

export async function deliver(env, { alertId, restockId }) {
  const claim = await one(env, 'SELECT * FROM alert_sent WHERE alert_id = ? AND restock_id = ?', alertId, restockId);
  if (!claim || claim.status === 'sent' || claim.status === 'held') return;
  const a = await one(env, 'SELECT a.*, u.email, u.telegram_chat_id, u.push_endpoint, u.push_keys, u.last_email_alert_at FROM alerts a JOIN users u ON u.id = a.user_id WHERE a.id = ?', alertId);
  const r = await one(env, `SELECT r.*, k.name AS sku_name, k.slug AS sku_slug, l.url, s.name AS store_name, s.city, s.online
    FROM restocks r JOIN skus k ON k.id = r.sku_id JOIN listings l ON l.id = r.listing_id JOIN stores s ON s.id = r.store_id WHERE r.id = ?`, restockId);
  if (!a || !r) return;
  const channels = JSON.parse(a.channels || '["email"]');
  const msg = alertText(env, r);

  const tries = [];
  if (channels.includes('telegram') && a.telegram_chat_id) tries.push(sendTelegram(env, a.telegram_chat_id, msg).then((ok) => ok && 'telegram'));
  if (channels.includes('push') && a.push_endpoint) tries.push(sendPush(env, a).then((ok) => ok && 'push'));
  const ok = (await Promise.allSettled(tries)).map((x) => (x.status === 'fulfilled' ? x.value : null)).filter(Boolean);

  let status = 'sent';
  if (!ok.length) {
    // nobody reached by push/Telegram → email, at most one per hour (digest)
    const t = now();
    const lastEmail = a.last_email_alert_at ?? 0;
    const notBefore = t - lastEmail < 3600e3 ? lastEmail + 3600e3 : t;
    await queueEmail(env, {
      userId: a.user_id, to: a.email, kind: 'alert',
      subject: msg.title, text: `${msg.line}\n\nBuy or reserve: ${msg.url}\nLive stock: ${msg.page}\n\nStock moves within minutes. Check the retailer before you travel.`,
      notBefore,
    });
    if (notBefore === t) await run(env, 'UPDATE users SET last_email_alert_at = ? WHERE id = ?', t, a.user_id);
    ok.push('email');
    status = notBefore > t || (await isFlagOn(env, 'email_pause')) ? 'held' : 'sent';
  }
  await run(env, 'UPDATE alert_sent SET status = ?, channels_ok = ?, detected_to_sent_ms = ? WHERE alert_id = ? AND restock_id = ?',
    status, ok.join(','), now() - r.started_at, alertId, restockId);
}
