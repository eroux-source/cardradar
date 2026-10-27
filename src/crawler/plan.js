// Crawl planner, run every minute by the cron.
// For each source: take `budget.<source>` lanes for this minute, in the
// playbook's order — 1) paid lane (what paying customers watch), 2) wave-first
// (lanes that historically restock around this hour), 3) the rest, oldest first.
// Tasks are spread over the minute with queue delays so capacity does not
// oscillate (§3.2). Discovery runs every 6 hours per source.
import { all, numSetting, settings, isOn, now } from '../lib/db.js';
import { enabledSources } from '../sources/index.js';

const DISCOVERY_EVERY = 6 * 3600e3;

export async function planMinute(env) {
  if (!(await isOn(env, 'crawl'))) return { skipped: 'crawl off' };
  const s = await settings(env);
  const t = now();
  const hour = new Date(t).getUTCHours();
  const messages = [];

  for (const src of enabledSources(env)) {
    const health = (await all(env, 'SELECT * FROM source_health WHERE source = ?', src.id))[0];
    // a blocked source rests 10 minutes before trying again
    if (health?.status === 'blocked' && t - (health.last_block_at ?? 0) < 10 * 60e3) continue;
    // a stale source (canary failed) gets a fresh chance after 15 minutes
    if (health?.status === 'stale' && t - (health.updated_at ?? 0) > 15 * 60e3) {
      await env.DB.prepare("UPDATE source_health SET status = 'unknown', updated_at = ? WHERE source = ?").bind(t, src.id).run();
    }

    const budget = await numSetting(env, `budget.${src.id}`, 5);
    const tasks = [];

    // discovery
    const lastDisc = Number(s[`discovery.${src.id}`] ?? 0);
    // snapshot sources (shops) discover as they read: no separate burst of searches
    if (src.kind !== 'lottery' && !src.snapshot && t - lastDisc > DISCOVERY_EVERY) {
      const queries = [...src.queries, ...((await src.dynamicQueries?.(env)) ?? [])];
      for (const q of queries) tasks.push({ t: src.snapshot ? 'snapshot' : 'search', source: src.id, q });
      await env.DB.prepare('INSERT INTO settings (key, value, updated_at) VALUES (?, ?, ?) ON CONFLICT(key) DO UPDATE SET value = excluded.value, updated_at = excluded.updated_at')
        .bind(`discovery.${src.id}`, String(t), t).run();
    }

    // lottery sources (Japan): read the shop's lottery page every `every` minutes
    if (src.kind === 'lottery') {
      const every = src.everyMinutes ?? 10;
      if (Math.floor(t / 60e3) % every === 0) for (const q of src.queries) tasks.push({ t: 'lottery', source: src.id, q });
    } else if (src.snapshot) {
      // one query every `everyMinutes`, rotating through the list (gentle on small shops)
      const every = src.everyMinutes ?? 1; const minute = Math.floor(t / 60e3);
      const offset = [...src.id].reduce((h, ch) => (h * 31 + ch.charCodeAt(0)) >>> 0, 7) % every; // spread shops over the cycle
      if (src.queries.length && (minute + offset) % every === 0) tasks.push({ t: 'snapshot', source: src.id, q: src.queries[Math.floor((minute + offset) / every) % src.queries.length] });
    } else {
      const room = Math.max(0, budget - tasks.length);
      const picked = new Set();
      const take = (rows) => { for (const r of rows) { if (tasks.length >= budget) break; const k = `${r.listing_id}|${r.metro}`; if (picked.has(k)) continue; picked.add(k); tasks.push({ t: src.kind === 'stores' ? 'area' : 'online', source: src.id, listingId: r.listing_id, metro: r.metro }); } };
      if (room) {
        // 1) paid lane: lanes matching an active alert of a paying customer, not read in the last 30 s
        take(await all(env, `
          SELECT DISTINCT ln.listing_id, ln.metro, ln.last_checked_at FROM lanes ln
          JOIN listings l ON l.id = ln.listing_id JOIN skus k ON k.id = l.sku_id
          JOIN alerts a ON a.status = 'active' AND (a.sku_id = k.id OR (a.sku_id IS NULL AND a.set_id = k.set_id))
          JOIN passes p ON p.user_id = a.user_id AND p.status IN ('active','refunded_kept') AND p.ends_at > ?
          WHERE ln.source = ? AND l.active = 1 AND ln.last_checked_at < ?
            AND ((a.kind = 'online' AND ln.metro = '') OR (a.kind = 'stores' AND ln.metro = a.metro))
          ORDER BY ln.last_checked_at LIMIT ?`, t, src.id, t - 30e3, budget));
        // 2) wave-first: lanes with restocks at this hour (UTC) over the last 14 days
        take(await all(env, `
          SELECT ln.listing_id, ln.metro FROM lanes ln JOIN restocks r ON r.listing_id = ln.listing_id
          JOIN stores st ON st.id = r.store_id AND (st.metro = ln.metro OR (st.online = 1 AND ln.metro = ''))
          WHERE ln.source = ? AND r.started_at > ? AND CAST(strftime('%H', r.started_at / 1000, 'unixepoch') AS INTEGER) IN (?, ?)
            AND ln.last_checked_at < ?
          GROUP BY ln.listing_id, ln.metro ORDER BY COUNT(*) DESC LIMIT ?`, src.id, t - 14 * 864e5, hour, (hour + 1) % 24, t - 2 * 60e3, budget));
        // 3) the rest, oldest first
        take(await all(env, `SELECT ln.listing_id, ln.metro FROM lanes ln JOIN listings l ON l.id = ln.listing_id
          WHERE ln.source = ? AND l.active = 1 ORDER BY ln.last_checked_at LIMIT ?`, src.id, budget));
      }
    }

    // spread over the minute
    tasks.forEach((body, i) => messages.push({ body, delaySeconds: Math.floor((i * 60) / Math.max(1, tasks.length)) }));
  }

  for (let i = 0; i < messages.length; i += 100) await env.CRAWL_QUEUE.sendBatch(messages.slice(i, i + 100));
  return { tasks: messages.length };
}
