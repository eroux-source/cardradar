// Generates the VAPID key pair for web push.
// Usage: node scripts/vapid-keys.mjs <file-for-private-key>
//   - prints the PUBLIC key (goes in wrangler.toml, VAPID_PUBLIC_KEY);
//   - writes the PRIVATE key to the file (mode 600), never to the screen.
//   Then: cat <file> | npx wrangler secret put VAPID_PRIVATE_KEY   (and delete the file)
import fs from 'node:fs';
const out = process.argv[2];
if (!out) { console.error('Give a file path for the private key.'); process.exit(1); }
const { webcrypto: c } = await import('node:crypto');
const kp = await c.subtle.generateKey({ name: 'ECDSA', namedCurve: 'P-256' }, true, ['sign', 'verify']);
const pub = Buffer.from(await c.subtle.exportKey('raw', kp.publicKey)).toString('base64url');
const { d } = await c.subtle.exportKey('jwk', kp.privateKey);
fs.writeFileSync(out, d, { mode: 0o600 });
console.log('VAPID_PUBLIC_KEY=' + pub);
