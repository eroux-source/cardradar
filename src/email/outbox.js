// All email goes through the outbox table: never dropped, retried, held during
// a Gmail pause (`email_pause`), alerts merged into a 1-per-hour digest.
// Two identities (playbook §5): sign-in codes + support via Postmark from the
// root domain; alerts via Resend from alerts@notify.<domain>.
import { all, run, now, isFlagOn } from '../lib/db.js';

export async function queueEmail(env, { userId = null, to, kind, subject, text, notBefore = now() }) {
  await run(env, 'INSERT INTO email_outbox (user_id, to_email, kind, subject, text, not_before) VALUES (?, ?, ?, ?, ?, ?)', userId, to, kind, subject, text, notBefore);
  if (notBefore <= now() && (kind === 'code' || !(await isFlagOn(env, 'email_pause')))) await flushOutbox(env, 20);
}

async function viaPostmark(env, to, subject, text) {
  if (!env.POSTMARK_TOKEN) { console.log(`[email:dry-run:postmark] ${to} — ${subject}`); return true; }
  const r = await fetch('https://api.postmarkapp.com/email', {
    method: 'POST', headers: { 'X-Postmark-Server-Token': env.POSTMARK_TOKEN, 'content-type': 'application/json', accept: 'application/json' },
    body: JSON.stringify({ From: env.CODES_FROM, To: to, Subject: subject, TextBody: text, MessageStream: 'outbound' }),
  });
  return r.ok;
}

async function viaResend(env, to, subject, text) {
  if (!env.RESEND_API_KEY) { console.log(`[email:dry-run:resend] ${to} — ${subject}`); return true; }
  const r = await fetch('https://api.resend.com/emails', {
    method: 'POST', headers: { authorization: `Bearer ${env.RESEND_API_KEY}`, 'content-type': 'application/json' },
    body: JSON.stringify({ from: env.ALERTS_FROM, to, reply_to: env.SUPPORT_EMAIL, subject, text }),
  });
  return r.ok;
}

/** Send what is due. Alert emails to the same person are merged into one digest. */
export async function flushOutbox(env, limit = 50) {
  // During a pause only sign-in codes go out; everything else waits in the table.
  const paused = await isFlagOn(env, 'email_pause');
  const due = await all(env, `SELECT * FROM email_outbox WHERE sent_at IS NULL AND not_before <= ? AND attempts < 5 ${paused ? "AND kind = 'code'" : ''}
    ORDER BY not_before LIMIT ?`, now(), limit);
  const groups = new Map();
  for (const m of due) {
    const key = m.kind === 'alert' ? `alert:${m.to_email}` : `one:${m.id}`;
    if (!groups.has(key)) groups.set(key, []);
    groups.get(key).push(m);
  }
  let sent = 0;
  for (const [key, msgs] of groups) {
    const first = msgs[0];
    const subject = msgs.length > 1 ? `${msgs.length} restocks you asked about` : first.subject;
    const text = msgs.length > 1 ? msgs.map((m) => m.text.split('\n\nStock moves')[0]).join('\n\n———\n\n') + '\n\nStock moves within minutes. Check the retailer before you travel.' : first.text;
    let ok = false; let err = null;
    try {
      ok = key.startsWith('alert:') ? await viaResend(env, first.to_email, subject, text) : await viaPostmark(env, first.to_email, subject, text);
    } catch (e) { err = String(e.message); }
    const ids = msgs.map((m) => m.id);
    const placeholders = ids.map(() => '?').join(',');
    if (ok) {
      await run(env, `UPDATE email_outbox SET sent_at = ? WHERE id IN (${placeholders})`, now(), ...ids);
      if (key.startsWith('alert:') && first.user_id) await run(env, 'UPDATE users SET last_email_alert_at = ? WHERE id = ?', now(), first.user_id);
      sent++;
    } else {
      await run(env, `UPDATE email_outbox SET attempts = attempts + 1, last_error = ?, not_before = ? WHERE id IN (${placeholders})`, err ?? 'provider refused', now() + 5 * 60e3, ...ids);
    }
  }
  return sent;
}
