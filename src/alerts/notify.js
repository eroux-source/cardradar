// Send one message to one person on their channels (push + LINE + Telegram in
// parallel; email only if none of them reached the person, max 1/hour digest).
import { run, now } from '../lib/db.js';
import { sendTelegram } from './channels/telegram.js';
import { sendPush } from './channels/push.js';
import { sendLine } from './channels/line.js';
import { queueEmail } from '../email/outbox.js';

export async function notifyUser(env, u, channels, msg) {
  const tries = [];
  if (channels.includes('telegram') && u.telegram_chat_id) tries.push(sendTelegram(env, u.telegram_chat_id, msg).then((ok) => ok && 'telegram'));
  if (channels.includes('push') && u.push_endpoint) tries.push(sendPush(env, u).then((ok) => ok && 'push'));
  if (channels.includes('line') && u.line_user_id) tries.push(sendLine(env, u.line_user_id, msg).then((ok) => ok && 'line'));
  const ok = (await Promise.allSettled(tries)).map((x) => (x.status === 'fulfilled' ? x.value : null)).filter(Boolean);
  if (!ok.length) {
    const t = now();
    const last = u.last_email_alert_at ?? 0;
    const notBefore = t - last < 3600e3 ? last + 3600e3 : t;
    await queueEmail(env, { userId: u.id, to: u.email, kind: 'alert', subject: msg.title, text: `${msg.line}\n\n${msg.url ?? ''}\n${msg.page ?? ''}`, notBefore });
    if (notBefore === t) await run(env, 'UPDATE users SET last_email_alert_at = ? WHERE id = ?', t, u.id);
    ok.push('email');
  }
  return ok;
}
