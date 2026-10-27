// Crawl queue consumer: executes one task, applies readings, records health.
import { one, run, now, settings, report } from '../lib/db.js';
import { SOURCES } from '../sources/index.js';
import { metroById } from '../data/countries.js';
import { upsertLotteries } from './lotteries.js';
import { keepItem, upsertListing, upsertStore, onlineStore, countryOf } from './catalog.js';
import { applyReading } from './state.js';
import { publishRestocks } from '../alerts/pipeline.js';
import { pingIndexNow } from '../seo/indexnow.js';

async function health(env, source, patch) {
  const t = now();
  await run(env, `INSERT INTO source_health (source, status, last_ok_at, last_block_at, last_error, updated_at) VALUES (?, ?, ?, ?, ?, ?)
    ON CONFLICT(source) DO UPDATE SET status = excluded.status,
      last_ok_at = COALESCE(excluded.last_ok_at, source_health.last_ok_at),
      last_block_at = COALESCE(excluded.last_block_at, source_health.last_block_at),
      last_error = COALESCE(excluded.last_error, source_health.last_error), updated_at = excluded.updated_at`,
    source, patch.status, patch.ok ? t : null, patch.blocked ? t : null, patch.error ?? null, t);
}

/** Canary (§3.4): the stock row that stayed in stock the longest. If it reads sold out, the source is not empty, it is broken. */
async function isCanary(env, source, listingId, storeId) {
  const c = await one(env, `SELECT k.listing_id, k.store_id FROM stock k JOIN stores s ON s.id = k.store_id
    WHERE s.source = ? AND k.in_stock = 1 AND k.in_since IS NOT NULL ORDER BY k.in_since LIMIT 1`, source);
  return c && c.listing_id === listingId && c.store_id === storeId && (await one(env, 'SELECT in_since FROM stock WHERE listing_id = ? AND store_id = ?', listingId, storeId))?.in_since < now() - 6 * 3600e3;
}

export async function runTask(env, task) {
  const src = SOURCES[task.source];
  if (!src) return;
  await settings(env);
  const t = now();
  const stale = (await one(env, 'SELECT status FROM source_health WHERE source = ?', src.id))?.status === 'stale';
  const restockIds = [];
  const changed = new Set();

  try {
    if (task.t === 'lottery') {
      const n = await upsertLotteries(env, src, (await src.lotteries(env, task.q)) ?? []);
      if (n.length) changed.add('/jp');
    } else if (task.t === 'search') {
      for (const item of (await src.search(env, task.q)) ?? []) if (keepItem(src.id, item)) await upsertListing(env, src.id, item);
    } else if (task.t === 'snapshot') {
      const storeId = await onlineStore(env, src.id);
      for (const x of (await src.snapshot(env, task.q)) ?? []) {
        if (!keepItem(src.id, x.item)) continue;
        const listingId = await upsertListing(env, src.id, x.item);
        const l = await one(env, 'SELECT l.sku_id, k.slug FROM listings l JOIN skus k ON k.id = l.sku_id WHERE l.id = ?', listingId);
        const id = await applyReading(env, { listingId, skuId: l.sku_id, source: src.id, storeId, inStock: x.inStock, price: x.item.price, at: t, sourceStale: stale });
        await run(env, "UPDATE lanes SET last_checked_at = ?, last_status = 'ok' WHERE listing_id = ? AND metro = ''", t, listingId);
        if (id) { restockIds.push(id); changed.add(`/${countryOf(src.id)}/${l.slug}`); }
      }
    } else {
      const l = await one(env, 'SELECT l.*, k.slug AS sku_slug FROM listings l JOIN skus k ON k.id = l.sku_id WHERE l.id = ?', task.listingId);
      if (!l || !l.active) return;
      if (task.t === 'area') {
        const metro = metroById[task.metro];
        const rows = (await src.checkArea(env, l, metro)) ?? [];
        for (const r of rows) {
          const storeId = await upsertStore(env, src.id, r.store, metro.id);
          if (!r.inStock && await isCanary(env, src.id, l.id, storeId)) {
            await health(env, src.id, { status: 'stale', error: `canary ${storeId} read sold out` });
            await report(env, 'canary', `${src.name}: the canary store read "sold out"; sold-out reads ignored until the source reads normally again.`);
            break;
          }
          const id = await applyReading(env, { listingId: l.id, skuId: l.sku_id, source: src.id, storeId, inStock: r.inStock, qty: r.qty, at: t, sourceStale: stale });
          if (id) { restockIds.push(id); changed.add(`/${countryOf(src.id)}/${l.sku_slug}`); changed.add(`/${countryOf(src.id)}/store/${(await one(env, 'SELECT slug FROM stores WHERE id = ?', storeId)).slug}`); }
        }
      } else if (task.t === 'online') {
        const r = await src.checkOnline(env, l);
        if (r?.gone) await run(env, 'UPDATE listings SET active = 0 WHERE id = ?', l.id);
        if (r && !r.gone) {
          const id = await applyReading(env, { listingId: l.id, skuId: l.sku_id, source: src.id, storeId: await onlineStore(env, src.id), inStock: r.inStock, price: r.price, at: t, sourceStale: stale });
          if (id) { restockIds.push(id); changed.add(`/${countryOf(src.id)}/${l.sku_slug}`); }
        }
      }
      await run(env, "UPDATE lanes SET last_checked_at = ?, last_status = 'ok' WHERE listing_id = ? AND metro = ?", t, l.id, task.metro ?? '');
    }
    if (!stale) await health(env, src.id, { status: 'ok', ok: true });
  } catch (e) {
    await health(env, src.id, { status: e.blocked ? 'blocked' : 'ok', blocked: e.blocked, error: String(e.message).slice(0, 300) });
    if (task.listingId) await run(env, 'UPDATE lanes SET last_checked_at = ?, last_status = ? WHERE listing_id = ? AND metro = ?', t, e.blocked ? 'blocked' : 'error', task.listingId, task.metro ?? '');
    if (!e.blocked) throw e; // retried once by the queue
  }

  if (restockIds.length) await publishRestocks(env, restockIds);
  if (changed.size) await pingIndexNow(env, [...changed]);
}
