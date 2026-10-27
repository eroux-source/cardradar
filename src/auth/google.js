// "Continue with Google" — offered first on sign-in (it avoids Gmail code delays, §5).
// The OAuth `state` is signed (HMAC) instead of stored in a second cookie.
import { userByEmail, startSession } from './session.js';
import { run } from '../lib/db.js';

const enc = new TextEncoder();
async function hmac(env, data) {
  const key = await crypto.subtle.importKey('raw', enc.encode(env.SESSION_SECRET || 'dev-secret'), { name: 'HMAC', hash: 'SHA-256' }, false, ['sign']);
  return [...new Uint8Array(await crypto.subtle.sign('HMAC', key, enc.encode(data)))].map((b) => b.toString(16).padStart(2, '0')).join('');
}

export async function googleStart(env, next = '/account') {
  const payload = `${Date.now()}.${encodeURIComponent(next)}`;
  const state = `${payload}.${await hmac(env, payload)}`;
  const u = new URL('https://accounts.google.com/o/oauth2/v2/auth');
  u.search = new URLSearchParams({ client_id: env.GOOGLE_CLIENT_ID, redirect_uri: `${env.BASE_URL}/auth/google/callback`, response_type: 'code', scope: 'openid email', state, prompt: 'select_account' });
  return Response.redirect(u.toString(), 302);
}

export async function googleCallback(env, url) {
  const [ts, next, sig] = String(url.searchParams.get('state') ?? '').split('.');
  if (!sig || sig !== await hmac(env, `${ts}.${next}`) || Date.now() - Number(ts) > 15 * 60e3) return new Response('Sign-in expired, please try again.', { status: 400 });
  const tokenRes = await fetch('https://oauth2.googleapis.com/token', {
    method: 'POST', headers: { 'content-type': 'application/x-www-form-urlencoded' },
    body: new URLSearchParams({ code: url.searchParams.get('code') ?? '', client_id: env.GOOGLE_CLIENT_ID, client_secret: env.GOOGLE_CLIENT_SECRET, redirect_uri: `${env.BASE_URL}/auth/google/callback`, grant_type: 'authorization_code' }),
  });
  const tok = await tokenRes.json();
  // The id_token comes straight from Google over TLS: its payload can be read without re-verifying the signature.
  const claims = JSON.parse(atob(String(tok.id_token ?? '').split('.')[1]?.replace(/-/g, '+').replace(/_/g, '/') ?? 'e30='));
  if (!claims.email || !claims.email_verified) return new Response('Google did not share a verified email.', { status: 400 });
  const user = await userByEmail(env, claims.email, { create: true, source: 'google' });
  await run(env, 'UPDATE users SET google_sub = ?, email_verified = 1 WHERE id = ?', claims.sub, user.id);
  return new Response(null, { status: 302, headers: { location: decodeURIComponent(next) || '/account', 'set-cookie': await startSession(env, user.id) } });
}
