// One session cookie (`s`), the only cookie of the site (playbook rule: no new
// cookies). It holds a random token; the database holds its SHA-256.
import { one, run, now } from '../lib/db.js';

const DAYS = 60;
export const sha256 = async (s) => [...new Uint8Array(await crypto.subtle.digest('SHA-256', new TextEncoder().encode(s)))].map((b) => b.toString(16).padStart(2, '0')).join('');

export function cookie(request, name) {
  return (request.headers.get('cookie') ?? '').split(/;\s*/).map((c) => c.split('=')).find(([k]) => k === name)?.[1] ?? null;
}

export async function currentUser(env, request) {
  const token = cookie(request, 's');
  if (!token) return null;
  return one(env, `SELECT u.* FROM sessions s JOIN users u ON u.id = s.user_id WHERE s.token_hash = ? AND s.expires_at > ?`, await sha256(token), now());
}

/** Creates a session and returns the Set-Cookie header value. */
export async function startSession(env, userId) {
  const token = crypto.randomUUID() + crypto.randomUUID();
  await run(env, 'INSERT INTO sessions (token_hash, user_id, created_at, expires_at) VALUES (?, ?, ?, ?)', await sha256(token), userId, now(), now() + DAYS * 864e5);
  const secure = env.BASE_URL?.startsWith('https') ? '; Secure' : '';
  return `s=${token}; Path=/; HttpOnly; SameSite=Lax; Max-Age=${DAYS * 86400}${secure}`;
}

export async function endSession(env, request) {
  const token = cookie(request, 's');
  if (token) await run(env, 'DELETE FROM sessions WHERE token_hash = ?', await sha256(token));
  return 's=; Path=/; Max-Age=0';
}

export async function userByEmail(env, email, { create = false, source = null } = {}) {
  const e = String(email).trim().toLowerCase();
  let u = await one(env, 'SELECT * FROM users WHERE email = ?', e);
  if (!u && create) {
    await run(env, 'INSERT INTO users (email, created_at, first_source) VALUES (?, ?, ?) ON CONFLICT(email) DO NOTHING', e, now(), source);
    u = await one(env, 'SELECT * FROM users WHERE email = ?', e);
  }
  return u;
}

export const EMAIL_RE = /^[^\s@]{1,64}@[^\s@]{1,190}\.[^\s@]{2,24}$/;
