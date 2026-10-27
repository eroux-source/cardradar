// Restocks → matcher → claims → deliveries (playbook §4).
// publishRestocks() matches right away AND queues a late copy 60 s later
// (skipped if the first one finished). alert_sent is the dedupe: one row per
// alert × restock, so re-running the matcher can never double-send.
import { all, one, run, now, isOn } from '../lib/db.js';
import { deliver } from './deliver.js';

const INLINE_MAX = 12;

export async function publishRestocks(env, restockIds) {
  if (!restockIds.length || !(await isOn(env, 'alert_pipeline'))) return;
  try {
    await matchRestocks(env, restockIds);
  } finally {
    await env.ALERT_QUEUE.send({ restockIds, late: true }, { delaySeconds: 60 });
  }
}

/** Matching alerts for one restock, only for customers with a valid pass. */
async function alertsFor(env, r) {
  return all(env, `
    SELECT a.id AS alert_id FROM alerts a
    JOIN passes p ON p.user_id = a.user_id AND p.status IN ('active','refunded_kept') AND p.ends_at > ?
    WHERE a.status = 'active'
      AND (a.sku_id = ? OR (a.sku_id IS NULL AND a.set_id = ?))
      AND ((a.kind = 'online' AND ? = 1 AND a.country = ?)
        OR (a.kind = 'stores' AND ? = 0 AND (a.metro = ? OR EXISTS (SELECT 1 FROM json_each(a.store_ids) WHERE value = ?))))
    GROUP BY a.id`, now(), r.sku_id, r.set_id, r.online, r.country, r.online, r.metro, r.store_id);
}

export async function matchRestocks(env, restockIds, { late = false } = {}) {
  let claimed = 0;
  for (const id of restockIds) {
    const r = await one(env, `SELECT r.*, k.set_id, s.online, s.metro, s.country FROM restocks r JOIN skus k ON k.id = r.sku_id JOIN stores s ON s.id = r.store_id WHERE r.id = ?`, id);
    if (!r || (late && r.matched_at)) continue;
    const jobs = [];
    for (const a of await alertsFor(env, r)) {
      const res = await run(env, 'INSERT OR IGNORE INTO alert_sent (alert_id, restock_id, claimed_at) VALUES (?, ?, ?)', a.alert_id, id, now());
      if (res.meta.changes) jobs.push({ alertId: a.alert_id, restockId: id });
    }
    claimed += jobs.length;
    if (jobs.length <= INLINE_MAX || !(await isOn(env, 'deliver_fanout'))) {
      await Promise.all(jobs.map((j) => deliver(env, j).catch((e) => env.DELIVER_QUEUE.send({ ...j, error: String(e.message) }))));
    } else {
      await Promise.all(jobs.slice(0, INLINE_MAX).map((j) => deliver(env, j).catch((e) => env.DELIVER_QUEUE.send({ ...j, error: String(e.message) }))));
      const rest = jobs.slice(INLINE_MAX).map((body) => ({ body }));
      for (let i = 0; i < rest.length; i += 100) await env.DELIVER_QUEUE.sendBatch(rest.slice(i, i + 100));
    }
    await run(env, 'UPDATE restocks SET matched_at = ? WHERE id = ?', now(), id);
  }
  return claimed;
}

/** Nightly heal (§4): re-match the last 24 h; any new claim = an alert we had missed. */
export async function heal(env) {
  const ids = (await all(env, 'SELECT id FROM restocks WHERE started_at > ?', now() - 864e5)).map((r) => r.id);
  const missed = await matchRestocks(env, ids);
  const failed = await one(env, "SELECT COUNT(*) AS n FROM alert_sent WHERE status = 'failed' AND claimed_at > ?", now() - 864e5);
  const dead = await one(env, 'SELECT COUNT(*) AS n FROM dead_letters WHERE at > ?', now() - 864e5);
  const text = `Nuit : ${ids.length} réassorts sur 24 h re-vérifiés. ${missed ? `${missed} alerte(s) manquée(s) retrouvée(s) et envoyée(s).` : 'Aucune alerte manquée.'} ${failed.n} échec(s) d'envoi, ${dead.n} message(s) en lettre morte.`;
  await run(env, 'INSERT INTO reports (kind, at, text) VALUES (?, ?, ?)', 'heal', now(), text);
  return text;
}
