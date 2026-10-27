// Payment provider abstraction (§6): Stripe closed InStock Radar's account on
// day 2 ("stock alert" looks like scalper tooling). Whop is the main provider;
// keep a second one ready. BILLING_PROVIDER=fake for local tests (scripts/fake-whop.mjs).
//
// Whop specifics to confirm in Whop's docs/dashboard before launch (not guessed here):
//  - the checkout link format for a plan and whether the email can be pre-filled;
//  - the webhook signature header and scheme (we verify HMAC-SHA256 of the raw
//    body, header name in WHOP_SIGNATURE_HEADER, default "x-whop-signature");
//  - event names (membership.went_valid / membership.went_invalid / payment.succeeded / refund…)
//    and where the buyer's email and the plan id sit in the payload (paths below).
// Pitfalls reported by the playbook: cancel is immediate unless flagged,
// initial_price is ADDED on top, tax is added on top in USD/EUR (say it on the plan step).
import { one, run, now } from '../lib/db.js';
import { grantPass, stopRenewal } from './pass.js';
import { userByEmail } from '../auth/session.js';

const enc = new TextEncoder();
const hex = (buf) => [...new Uint8Array(buf)].map((b) => b.toString(16).padStart(2, '0')).join('');

export async function hmacHex(secret, body) {
  const key = await crypto.subtle.importKey('raw', enc.encode(secret), { name: 'HMAC', hash: 'SHA-256' }, false, ['sign']);
  return hex(await crypto.subtle.sign('HMAC', key, enc.encode(body)));
}

// One Whop plan per plan × currency: WHOP_PLAN_SOLO (USD), WHOP_PLAN_SOLO_GBP, WHOP_PLAN_MULTI_EUR, …
// Missing local plan → falls back to the USD plan (Whop converts at checkout).
const CURRENCIES = ['USD', 'GBP', 'CAD', 'AUD', 'EUR', 'JPY'];
const planIdFor = (env, plan, cur = 'USD') => {
  const k = `WHOP_PLAN_${plan === 'multi' ? 'MULTI' : 'SOLO'}`;
  return (cur !== 'USD' && env[`${k}_${cur}`]) || env[k];
};
const planFromId = (env, id) => {
  for (const p of ['solo', 'multi']) for (const c of CURRENCIES) if (id && planIdFor(env, p, c) === id && (c === 'USD' || env[`WHOP_PLAN_${p.toUpperCase()}_${c}`])) return p;
  return null;
};

/** Where to send the buyer. The pass is linked to THIS email (email-less checkout is a bug). */
export function checkoutUrl(env, { plan, email, currency = 'USD' }) {
  if (env.BILLING_PROVIDER === 'fake') return `${env.BASE_URL}/dev/fake-checkout?plan=${plan}&email=${encodeURIComponent(email)}`;
  const u = new URL(`https://whop.com/checkout/${planIdFor(env, plan, currency)}`);
  u.searchParams.set('email', email); // confirm param name with Whop
  return u.toString();
}

const pick = (o, paths) => { for (const p of paths) { const v = p.split('.').reduce((x, k) => x?.[k], o); if (v != null) return v; } return null; };

/** POST /api/billing/webhook */
export async function billingWebhook(env, request) {
  const raw = await request.text();
  const header = env.WHOP_SIGNATURE_HEADER || 'x-whop-signature';
  const given = String(request.headers.get(header) ?? '').replace(/^sha256=/, '');
  if (!env.WHOP_WEBHOOK_SECRET || given !== await hmacHex(env.WHOP_WEBHOOK_SECRET, raw)) return new Response('bad signature', { status: 401 });

  const evt = JSON.parse(raw);
  const type = evt.action ?? evt.type ?? evt.event;
  const data = evt.data ?? {};
  const email = pick(data, ['user.email', 'email', 'customer.email', 'membership.user.email']);
  const planId = pick(data, ['plan.id', 'plan_id', 'membership.plan_id']);
  const ref = String(pick(data, ['id', 'payment_id', 'membership_id']) ?? '');
  const amount = Number(pick(data, ['final_amount', 'amount', 'subtotal']) ?? 0);
  if (!email) return new Response('no email', { status: 200 });
  const user = await userByEmail(env, email, { create: true, source: 'checkout' });

  await run(env, 'INSERT OR IGNORE INTO payments (provider, provider_ref, user_id, amount, currency, kind, at, raw) VALUES (?, ?, ?, ?, ?, ?, ?, ?)',
    'whop', `${type}:${ref}`, user.id, amount, pick(data, ['currency']) ?? 'usd', type, now(), raw.slice(0, 4000));

  if (/went_valid|payment\.succeeded|renewed/.test(type)) {
    await grantPass(env, { userId: user.id, plan: planFromId(env, planId) ?? 'solo', provider: 'whop', ref: `${type}:${ref}` });
    await run(env, "UPDATE leads SET step = 'paid', updated_at = ? WHERE email = ?", now(), user.email);
    await run(env, 'INSERT INTO events (at, name, props) VALUES (?, ?, ?)', now(), 'paid', JSON.stringify({ plan: planFromId(env, planId), amount }));
  } else if (/went_invalid|cancel/.test(type)) {
    await stopRenewal(env, user.id); // access runs until the end of the paid period
  }
  return new Response('ok');
}

/**
 * "Cancel in 2 clicks" (§2): stop renewal at the END of the paid period, never
 * immediately (Whop cancels immediately unless told otherwise).
 * TO CONFIRM in Whop's API docs before launch: endpoint and the "at period end" flag.
 * Until confirmed, a failed call queues an email to support so a human cancels it.
 */
export async function cancelRenewal(env, user) {
  if (env.BILLING_PROVIDER === 'fake') return true;
  const ref = await one(env, "SELECT raw FROM payments WHERE user_id = ? AND provider = 'whop' ORDER BY at DESC LIMIT 1", user.id);
  const membership = ref ? pick(JSON.parse(ref.raw).data ?? {}, ['membership_id', 'membership.id', 'id']) : null;
  let ok = false;
  if (env.WHOP_API_KEY && membership) {
    const res = await fetch(`https://api.whop.com/api/v2/memberships/${membership}/cancel`, {
      method: 'POST', headers: { authorization: `Bearer ${env.WHOP_API_KEY}`, 'content-type': 'application/json' },
      body: JSON.stringify({ at_period_end: true }),
    }).catch(() => null);
    ok = !!res?.ok;
  }
  if (!ok) {
    const { queueEmail } = await import('../email/outbox.js');
    await queueEmail(env, { to: env.SUPPORT_EMAIL, kind: 'ops', subject: `Cancel renewal by hand: ${user.email}`, text: `Automatic cancel failed for ${user.email} (membership ${membership ?? 'unknown'}). Cancel at period end in Whop.` });
  }
  return ok;
}

/** Dev only: the fake provider "pays" and calls our own webhook, signed. */
export async function fakeCheckout(env, url) {
  if (env.BILLING_PROVIDER !== 'fake') return new Response('not found', { status: 404 });
  const plan = url.searchParams.get('plan'); const email = url.searchParams.get('email');
  const body = JSON.stringify({ action: 'payment.succeeded', data: { id: `fake_${crypto.randomUUID()}`, user: { email }, plan: { id: plan === 'multi' ? env.WHOP_PLAN_MULTI : env.WHOP_PLAN_SOLO }, final_amount: plan === 'multi' ? Number(env.PRICE_MULTI) : Number(env.PRICE_SOLO), currency: 'usd' } });
  const sig = await hmacHex(env.WHOP_WEBHOOK_SECRET, body);
  await billingWebhook(env, new Request('http://x/api/billing/webhook', { method: 'POST', body, headers: { [env.WHOP_SIGNATURE_HEADER || 'x-whop-signature']: sig } }));
  return Response.redirect(`${env.BASE_URL}/account?paid=1`, 302);
}
