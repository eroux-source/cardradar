// Standard Web Push (RFC 8030 + 8291 + 8292), WebCrypto only, no dependency.
// - VAPID: an ES256 JWT signed with VAPID_PRIVATE_KEY (secret, base64url of the
//   32-byte P-256 private scalar), public half VAPID_PUBLIC_KEY in wrangler.toml.
// - Payload encrypted with aes128gcm so the notification shows its text even
//   when the phone is offline from our site (iPhone home-screen apps included).
// Devices live in D1 push_subs (one account → many devices). 404/410 = device
// gone: the row is deleted. Never logs endpoints, keys or emails.
import { all, run, now } from '../../lib/db.js';

const enc = new TextEncoder();
const b64u = (buf) => btoa(String.fromCharCode(...new Uint8Array(buf))).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
const unb64u = (s) => Uint8Array.from(atob(String(s).replace(/-/g, '+').replace(/_/g, '/') + '='.repeat((4 - (String(s).length % 4)) % 4)), (c) => c.charCodeAt(0));
const cat = (...parts) => { const out = new Uint8Array(parts.reduce((n, p) => n + p.length, 0)); let o = 0; for (const p of parts) { out.set(p, o); o += p.length; } return out; };

export const pushReady = (env) => !!(env.VAPID_PUBLIC_KEY && env.VAPID_PRIVATE_KEY);

let signKey = null; let signKeyFor = '';
async function vapidKey(env) {
  if (signKey && signKeyFor === env.VAPID_PUBLIC_KEY) return signKey;
  const pub = unb64u(env.VAPID_PUBLIC_KEY);
  const jwk = { kty: 'EC', crv: 'P-256', d: String(env.VAPID_PRIVATE_KEY).trim(), x: b64u(pub.slice(1, 33)), y: b64u(pub.slice(33, 65)), ext: true };
  signKey = await crypto.subtle.importKey('jwk', jwk, { name: 'ECDSA', namedCurve: 'P-256' }, false, ['sign']);
  signKeyFor = env.VAPID_PUBLIC_KEY;
  return signKey;
}

const jwtCache = new Map(); // audience → { jwt, exp }
async function vapidJwt(env, audience) {
  const hit = jwtCache.get(audience);
  if (hit && hit.exp - 3600 > Date.now() / 1000) return hit.jwt;
  const exp = Math.floor(Date.now() / 1000) + 12 * 3600;
  const h = b64u(enc.encode(JSON.stringify({ typ: 'JWT', alg: 'ES256' })));
  const p = b64u(enc.encode(JSON.stringify({ aud: audience, exp, sub: `mailto:${env.SUPPORT_EMAIL}` })));
  const sig = await crypto.subtle.sign({ name: 'ECDSA', hash: 'SHA-256' }, await vapidKey(env), enc.encode(`${h}.${p}`));
  const jwt = `${h}.${p}.${b64u(sig)}`;
  jwtCache.set(audience, { jwt, exp });
  return jwt;
}

async function hkdf(salt, ikm, info, bytes) {
  const k = await crypto.subtle.importKey('raw', ikm, 'HKDF', false, ['deriveBits']);
  return new Uint8Array(await crypto.subtle.deriveBits({ name: 'HKDF', hash: 'SHA-256', salt, info }, k, bytes * 8));
}

/** RFC 8291 aes128gcm body for one device. `sub` = { p256dh, auth } (base64url). */
export async function encryptPayload(sub, plaintext) {
  const uaPub = unb64u(sub.p256dh);
  const authSecret = unb64u(sub.auth);
  const as = await crypto.subtle.generateKey({ name: 'ECDH', namedCurve: 'P-256' }, true, ['deriveBits']);
  const asPub = new Uint8Array(await crypto.subtle.exportKey('raw', as.publicKey));
  const uaKey = await crypto.subtle.importKey('raw', uaPub, { name: 'ECDH', namedCurve: 'P-256' }, false, []);
  const shared = new Uint8Array(await crypto.subtle.deriveBits({ name: 'ECDH', public: uaKey }, as.privateKey, 256));
  const ikm = await hkdf(authSecret, shared, cat(enc.encode('WebPush: info\0'), uaPub, asPub), 32);
  const salt = crypto.getRandomValues(new Uint8Array(16));
  const cek = await hkdf(salt, ikm, enc.encode('Content-Encoding: aes128gcm\0'), 16);
  const nonce = await hkdf(salt, ikm, enc.encode('Content-Encoding: nonce\0'), 12);
  const key = await crypto.subtle.importKey('raw', cek, 'AES-GCM', false, ['encrypt']);
  const ct = new Uint8Array(await crypto.subtle.encrypt({ name: 'AES-GCM', iv: nonce }, key, cat(plaintext, new Uint8Array([2]))));
  const rs = new Uint8Array([0, 0, 16, 0]); // record size 4096
  return cat(salt, rs, new Uint8Array([asPub.length]), asPub, ct);
}

/** Sends one notification to one device. Returns { ok, gone, status }. */
export async function pushToSub(env, sub, msg) {
  const endpoint = new URL(sub.endpoint);
  const payload = enc.encode(JSON.stringify({ title: String(msg.title ?? '').slice(0, 120), body: String(msg.body ?? '').slice(0, 300), url: msg.url ?? '/account', tag: msg.tag ?? undefined }));
  const res = await fetch(sub.endpoint, {
    method: 'POST',
    headers: {
      TTL: String(msg.ttl ?? 3600), Urgency: 'high',
      Authorization: `vapid t=${await vapidJwt(env, endpoint.origin)}, k=${env.VAPID_PUBLIC_KEY}`,
      'Content-Encoding': 'aes128gcm', 'Content-Type': 'application/octet-stream',
    },
    body: await encryptPayload(sub, payload),
  });
  return { ok: res.status >= 200 && res.status < 300, gone: res.status === 404 || res.status === 410, status: res.status };
}

/**
 * Sends `msg` ({ title, body, url, tag }) to every device of the account.
 * Dead devices are deleted. One `push_sent` event per device tried (props: ok, status, kind).
 * Returns the number of devices that accepted it.
 */
export async function pushToUser(env, userId, msg, kind = 'alert') {
  if (!pushReady(env)) return 0;
  const subs = await all(env, 'SELECT id, endpoint, p256dh, auth, device FROM push_subs WHERE user_id = ?', userId);
  let okCount = 0;
  const t = now();
  for (const s of subs) {
    let r;
    try { r = await pushToSub(env, s, msg); } catch { r = { ok: false, gone: false, status: 0 }; }
    if (r.ok) { okCount++; await run(env, 'UPDATE push_subs SET last_ok_at = ?, fails = 0 WHERE id = ?', t, s.id); }
    else if (r.gone) await run(env, 'DELETE FROM push_subs WHERE id = ?', s.id);
    else await run(env, 'UPDATE push_subs SET fails = fails + 1 WHERE id = ?', s.id);
    await run(env, 'INSERT INTO events (at, name, device, bot, props) VALUES (?, ?, ?, 0, ?)', t, 'push_sent', s.device ?? null,
      JSON.stringify({ ok: r.ok ? 1 : 0, status: r.status, kind, ...(r.gone ? { removed: 1 } : {}) }));
  }
  return okCount;
}
