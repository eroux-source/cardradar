// Email code sign-in (playbook §5): codes valid 1 h, capped per IP, per email
// and globally — without caps anyone can make us mail thousands of random
// addresses and get the sender suspended.
import { one, run, now, numSetting } from '../lib/db.js';
import { sha256, userByEmail, startSession, EMAIL_RE } from './session.js';
import { queueEmail } from '../email/outbox.js';

const HOUR = 3600e3;

export async function requestCode(env, emailRaw, ip) {
  const email = String(emailRaw ?? '').trim().toLowerCase();
  if (!EMAIL_RE.test(email)) return { ok: false, error: 'Enter a valid email address.' };
  const t = now();
  const [global, byIp, byEmail] = await Promise.all([
    one(env, 'SELECT COUNT(*) AS n FROM login_codes WHERE created_at > ?', t - HOUR),
    one(env, 'SELECT COUNT(*) AS n FROM login_codes WHERE ip = ? AND created_at > ?', ip, t - HOUR),
    one(env, 'SELECT COUNT(*) AS n FROM login_codes WHERE email = ? AND created_at > ?', email, t - HOUR),
  ]);
  if (global.n >= await numSetting(env, 'codes.global_per_hour', 600)) return { ok: false, error: 'Too many sign-ins right now. Try again in a few minutes, or continue with Google.' };
  if (byIp.n >= await numSetting(env, 'codes.ip_per_hour', 6) || byEmail.n >= 3) return { ok: false, error: 'Too many codes requested. Use the last code you received, or try again in an hour.' };

  const code = String(crypto.getRandomValues(new Uint32Array(1))[0] % 1e6).padStart(6, '0');
  await run(env, 'INSERT INTO login_codes (email, code_hash, ip, created_at) VALUES (?, ?, ?, ?)', email, await sha256(`${email}:${code}`), ip, t);
  await queueEmail(env, {
    to: email, kind: 'code', subject: `Your ${env.BRAND_NAME} code: ${code}`,
    text: `Your sign-in code is ${code}\n\nIt works for 1 hour. If you did not ask for it, ignore this email.\n\n${env.BRAND_NAME}`,
  });
  return { ok: true };
}

/** Returns { ok, setCookie, user } */
export async function verifyCode(env, emailRaw, codeRaw) {
  const email = String(emailRaw ?? '').trim().toLowerCase();
  const code = String(codeRaw ?? '').replace(/\D/g, '');
  const row = await one(env, 'SELECT * FROM login_codes WHERE email = ? AND used_at IS NULL AND created_at > ? ORDER BY created_at DESC LIMIT 1', email, now() - HOUR);
  if (!row || row.attempts >= 5) return { ok: false, error: 'This code expired. Ask for a new one.' };
  if (row.code_hash !== await sha256(`${email}:${code}`)) {
    await run(env, 'UPDATE login_codes SET attempts = attempts + 1 WHERE id = ?', row.id);
    return { ok: false, error: 'Wrong code. Check the last email we sent.' };
  }
  await run(env, 'UPDATE login_codes SET used_at = ? WHERE id = ?', now(), row.id);
  const user = await userByEmail(env, email, { create: true });
  await run(env, 'UPDATE users SET email_verified = 1 WHERE id = ?', user.id);
  return { ok: true, user, setCookie: await startSession(env, user.id) };
}
