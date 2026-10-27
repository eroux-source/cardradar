// Generates the VAPID key pair for phone notifications.
// Usage: node scripts/vapid-keys.mjs  → then `wrangler secret put VAPID_PUBLIC_KEY` and `VAPID_PRIVATE_JWK`.
const { webcrypto: c } = await import('node:crypto');
const kp = await c.subtle.generateKey({ name: 'ECDSA', namedCurve: 'P-256' }, true, ['sign', 'verify']);
const raw = Buffer.from(await c.subtle.exportKey('raw', kp.publicKey)).toString('base64url');
const jwk = JSON.stringify(await c.subtle.exportKey('jwk', kp.privateKey));
console.log('VAPID_PUBLIC_KEY=' + raw);
console.log('VAPID_PRIVATE_JWK=' + jwk);
