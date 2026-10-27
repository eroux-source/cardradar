// Who has access. A pass = 30 days of alerts (Solo or Multi), renewed by the provider.
// Rule (§6): when refunding someone who keeps access, write the grant row FIRST.
import { one, run, now } from '../lib/db.js';

export const PLANS = {
  solo: { id: 'solo', name: 'Solo', blurb: '1 product, 1 store or area', maxAlerts: 1 },
  multi: { id: 'multi', name: 'Multi', blurb: 'Several products and places, any product of a set', maxAlerts: 25 },
};

export const activePass = (env, userId) =>
  one(env, "SELECT * FROM passes WHERE user_id = ? AND status IN ('active','refunded_kept') AND ends_at > ? ORDER BY ends_at DESC LIMIT 1", userId, now());

/** Idempotent on (provider, ref): a webhook replay extends nothing twice. */
export async function grantPass(env, { userId, plan, provider, ref, days = 30 }) {
  const t = now();
  const existing = ref ? await one(env, 'SELECT * FROM passes WHERE provider = ? AND provider_ref = ?', provider, ref) : null;
  if (existing) return existing;
  const current = await activePass(env, userId);
  const start = current ? current.ends_at : t;
  await run(env, `INSERT INTO passes (user_id, plan, provider, provider_ref, status, starts_at, ends_at, renews, created_at)
    VALUES (?, ?, ?, ?, 'active', ?, ?, 1, ?)`, userId, plan, provider, ref, start, start + days * 864e5, t);
  return one(env, 'SELECT * FROM passes WHERE provider = ? AND provider_ref = ?', provider, ref);
}

export async function stopRenewal(env, userId) {
  await run(env, "UPDATE passes SET renews = 0 WHERE user_id = ? AND status = 'active'", userId);
}
