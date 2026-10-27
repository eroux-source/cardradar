// Applies one reading to the stock table and decides what is a real restock.
// Playbook §3.3: a flip to in-stock is published at once; a flip to sold-out
// needs a second read; a pair that flips 3 times in 10 minutes is quarantined
// (no restock published) for 30 minutes. §3.4: when the source is stale
// (canary failed, blocked), sold-out flips are ignored: never show "sold out"
// from a bad read.
import { one, run, now } from '../lib/db.js';

const FLIP_WINDOW = 10 * 60e3;
const QUARANTINE = 30 * 60e3;

/**
 * @returns {Promise<number|null>} id of a NEW restock to alert on, else null
 */
export async function applyReading(env, { listingId, skuId, source, storeId, inStock, qty = null, price = null, at = now(), sourceStale = false }) {
  const prev = await one(env, 'SELECT * FROM stock WHERE listing_id = ? AND store_id = ?', listingId, storeId);

  if (!prev) {
    // First sight: record state, no restock (we did not see it arrive).
    await run(env, `INSERT INTO stock (listing_id, store_id, in_stock, qty, price, seen_at, in_since) VALUES (?, ?, ?, ?, ?, ?, ?)`,
      listingId, storeId, inStock ? 1 : 0, qty, price, at, inStock ? at : null);
    return null;
  }

  const flips = (prev.flips ? prev.flips.split(',').map(Number) : []).filter((t) => at - t < FLIP_WINDOW);
  const quarantined = prev.quarantined_until && prev.quarantined_until > at;

  // ---- in stock now ----
  if (inStock) {
    if (prev.in_stock) {
      // still in stock; a pending sold-out read is cancelled
      await run(env, 'UPDATE stock SET qty = ?, price = COALESCE(?, price), seen_at = ?, pending_out_at = NULL WHERE listing_id = ? AND store_id = ?', qty, price, at, listingId, storeId);
      if (qty) await run(env, 'UPDATE restocks SET qty = MAX(COALESCE(qty, 0), ?) WHERE listing_id = ? AND store_id = ? AND ended_at IS NULL', qty, listingId, storeId);
      return null;
    }
    flips.push(at);
    const quarantineNow = flips.length >= 3;
    await run(env, `UPDATE stock SET in_stock = 1, qty = ?, price = COALESCE(?, price), seen_at = ?, in_since = ?, pending_out_at = NULL, flips = ?, quarantined_until = ?
      WHERE listing_id = ? AND store_id = ?`, qty, price, at, at, flips.join(','), quarantineNow ? at + QUARANTINE : prev.quarantined_until, listingId, storeId);
    if (quarantined || quarantineNow) return null;
    const r = await run(env, 'INSERT INTO restocks (listing_id, sku_id, store_id, source, started_at, qty, price) VALUES (?, ?, ?, ?, ?, ?, ?)',
      listingId, skuId, storeId, source, at, qty, price ?? prev.price);
    return r.meta.last_row_id;
  }

  // ---- sold out now ----
  if (!prev.in_stock) {
    await run(env, 'UPDATE stock SET seen_at = ? WHERE listing_id = ? AND store_id = ?', at, listingId, storeId);
    return null;
  }
  if (sourceStale) return null; // do not trust a sold-out read from a blocked/stale source
  if (!prev.pending_out_at) {
    await run(env, 'UPDATE stock SET pending_out_at = ?, seen_at = ? WHERE listing_id = ? AND store_id = ?', at, at, listingId, storeId);
    return null;
  }
  // second consecutive sold-out read: confirm
  flips.push(at);
  await run(env, `UPDATE stock SET in_stock = 0, qty = 0, seen_at = ?, in_since = NULL, pending_out_at = NULL, flips = ?, quarantined_until = ?
    WHERE listing_id = ? AND store_id = ?`, at, flips.join(','), flips.length >= 3 ? at + QUARANTINE : prev.quarantined_until, listingId, storeId);
  // the restock ended at the FIRST sold-out read
  await run(env, 'UPDATE restocks SET ended_at = ? WHERE listing_id = ? AND store_id = ? AND ended_at IS NULL', prev.pending_out_at, listingId, storeId);
  return null;
}
