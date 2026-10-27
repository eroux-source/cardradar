// Web push without payload ("tickle"): we sign a VAPID JWT with WebCrypto and
// POST an empty message; the service worker then fetches /api/me/latest and
// shows the notification. No payload encryption needed.
// Keys: VAPID_PUBLIC_KEY (base64url, uncompressed P-256) and VAPID_PRIVATE_JWK
// (JSON). Generate with: node scripts/vapid-keys.mjs

const b64url = (buf) => btoa(String.fromCharCode(...new Uint8Array(buf))).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
const enc = new TextEncoder();

async function vapidJwt(env, audience) {
  const key = await crypto.subtle.importKey('jwk', JSON.parse(env.VAPID_PRIVATE_JWK), { name: 'ECDSA', namedCurve: 'P-256' }, false, ['sign']);
  const header = b64url(enc.encode(JSON.stringify({ typ: 'JWT', alg: 'ES256' })));
  const payload = b64url(enc.encode(JSON.stringify({ aud: audience, exp: Math.floor(Date.now() / 1000) + 12 * 3600, sub: `mailto:${env.SUPPORT_EMAIL}` })));
  const sig = await crypto.subtle.sign({ name: 'ECDSA', hash: 'SHA-256' }, key, enc.encode(`${header}.${payload}`));
  return `${header}.${payload}.${b64url(sig)}`;
}

export async function sendPush(env, user) {
  if (!env.VAPID_PRIVATE_JWK || !user.push_endpoint) return false;
  const endpoint = new URL(user.push_endpoint);
  const jwt = await vapidJwt(env, endpoint.origin);
  const res = await fetch(user.push_endpoint, {
    method: 'POST',
    headers: { TTL: '3600', Urgency: 'high', Authorization: `vapid t=${jwt}, k=${env.VAPID_PUBLIC_KEY}`, 'Content-Length': '0' },
  });
  if (res.status === 404 || res.status === 410) {
    await env.DB.prepare('UPDATE users SET push_endpoint = NULL, push_keys = NULL WHERE push_endpoint = ?').bind(user.push_endpoint).run();
    return false;
  }
  return res.status >= 200 && res.status < 300;
}
