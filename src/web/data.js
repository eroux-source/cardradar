// Read-side queries for pages. Pages read small, indexed slices of data;
// owner analytics read mk_stats, never raw events (playbook §0.4).
import { all, one, now } from '../lib/db.js';
import { median } from '../lib/util.js';

const DAY = 864e5;
const TZ = {
  AL: 'America/Chicago', AZ: 'America/Phoenix', CA: 'America/Los_Angeles', CO: 'America/Denver', CT: 'America/New_York', DC: 'America/New_York',
  FL: 'America/New_York', GA: 'America/New_York', IL: 'America/Chicago', IN: 'America/Indiana/Indianapolis', KY: 'America/New_York',
  LA: 'America/Chicago', MA: 'America/New_York', MD: 'America/New_York', MI: 'America/Detroit', MN: 'America/Chicago', MO: 'America/Chicago',
  NC: 'America/New_York', NV: 'America/Los_Angeles', NY: 'America/New_York', OH: 'America/New_York', OK: 'America/Chicago', OR: 'America/Los_Angeles',
  PA: 'America/New_York', RI: 'America/New_York', TN: 'America/Chicago', TX: 'America/Chicago', UT: 'America/Denver', VA: 'America/New_York',
  WA: 'America/Los_Angeles', WI: 'America/Chicago', NJ: 'America/New_York', NH: 'America/New_York',
};
const fmts = {};
const part = (ts, state, kind) => {
  const tz = TZ[state] ?? 'America/New_York';
  const k = tz + kind;
  fmts[k] ??= new Intl.DateTimeFormat('en-US', kind === 'h' ? { hour: 'numeric', hourCycle: 'h23', timeZone: tz } : { weekday: 'short', timeZone: tz });
  return fmts[k].format(ts);
};
export const localHour = (ts, state) => Number(part(ts, state, 'h')) % 24;
export const localDow = (ts, state) => ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'].indexOf(part(ts, state, 'd'));

export function summarize(rows) {
  const hours = Array(24).fill(0); const days = Array(7).fill(0); const durs = [];
  for (const r of rows) {
    hours[localHour(r.started_at, r.state)]++; days[localDow(r.started_at, r.state)]++;
    if (r.ended_at) durs.push(r.ended_at - r.started_at);
  }
  const argmax = (a) => (a.some(Boolean) ? a.indexOf(Math.max(...a)) : null);
  const span = rows.length ? rows[0].started_at - rows[rows.length - 1].started_at : 0;
  return {
    count: rows.length, hours, days, peakHour: argmax(hours), peakDay: argmax(days), typical: median(durs),
    shortest: durs.length ? Math.min(...durs) : null, longest: durs.length ? Math.max(...durs) : null, span,
    // index rule (§7): a restock page is indexable only with ≥ 20 restocks over > 18 h
    indexable: rows.length >= 20 && span > 18 * 3600e3,
  };
}

const R_COLS = `r.id, r.started_at, r.ended_at, r.qty, r.price, r.source, r.store_id, k.id AS sku_id, k.name AS sku_name, k.slug AS sku_slug,
  s.name AS store_name, s.slug AS store_slug, s.city, s.state, s.metro, s.online`;
export const restocks = (env, where = '1=1', args = [], days = 30, limit = 5000) => all(env,
  `SELECT ${R_COLS} FROM restocks r JOIN skus k ON k.id = r.sku_id JOIN stores s ON s.id = r.store_id
   WHERE r.started_at > ? AND ${where} ORDER BY r.started_at DESC LIMIT ${limit}`, now() - days * DAY, ...args);

export const skuBySlug = (env, slug) => one(env, 'SELECT k.*, st.name AS set_name, st.slug AS set_slug FROM skus k LEFT JOIN sets st ON st.id = k.set_id WHERE k.slug = ?', slug);
export const storeBySlug = (env, slug) => one(env, 'SELECT * FROM stores WHERE slug = ?', slug);
export const listingsOf = (env, skuId) => all(env, 'SELECT * FROM listings WHERE sku_id = ? AND active = 1 ORDER BY source', skuId);

export const availability = (env, skuId, metro = null) => all(env, `
  SELECT s.*, k.in_stock, k.qty, k.seen_at, k.price, l.source AS l_source, l.url,
    (SELECT MAX(started_at) FROM restocks r WHERE r.listing_id = k.listing_id AND r.store_id = k.store_id) AS last_restock
  FROM stock k JOIN listings l ON l.id = k.listing_id JOIN stores s ON s.id = k.store_id
  WHERE l.sku_id = ? ${metro ? 'AND (s.online = 1 OR s.metro = ?)' : ''}
  ORDER BY k.in_stock DESC, s.online DESC, last_restock DESC NULLS LAST, s.name`, ...(metro ? [skuId, metro] : [skuId]));

export const storeStock = (env, storeId) => all(env, `
  SELECT k2.*, st.in_stock, st.qty, st.seen_at, l.url,
    (SELECT MAX(started_at) FROM restocks r WHERE r.listing_id = st.listing_id AND r.store_id = st.store_id) AS last_restock
  FROM stock st JOIN listings l ON l.id = st.listing_id JOIN skus k2 ON k2.id = l.sku_id
  WHERE st.store_id = ? ORDER BY st.in_stock DESC, last_restock DESC NULLS LAST, k2.name`, storeId);

export const allSkus = (env) => all(env, `
  SELECT k.*, st.name AS set_name,
    (SELECT COUNT(*) FROM stock x JOIN listings l ON l.id = x.listing_id JOIN stores s ON s.id = x.store_id WHERE l.sku_id = k.id AND s.online = 0) AS stores,
    (SELECT COUNT(*) FROM stock x JOIN listings l ON l.id = x.listing_id JOIN stores s ON s.id = x.store_id WHERE l.sku_id = k.id AND s.online = 0 AND x.in_stock = 1) AS stores_in,
    (SELECT GROUP_CONCAT(DISTINCT s.source) FROM stock x JOIN listings l ON l.id = x.listing_id JOIN stores s ON s.id = x.store_id WHERE l.sku_id = k.id AND s.online = 1 AND x.in_stock = 1) AS online_in,
    (SELECT MAX(r.started_at) FROM restocks r WHERE r.sku_id = k.id) AS last_restock,
    (SELECT MIN(price) FROM listings l WHERE l.sku_id = k.id AND l.price > 0) AS min_price
  FROM skus k LEFT JOIN sets st ON st.id = k.set_id WHERE k.active = 1
  ORDER BY (stores_in * 1.0 / MAX(stores, 1)) + (online_in IS NOT NULL) ASC, last_restock DESC NULLS LAST`);

export const storesInMetro = (env, metro) => all(env, `
  SELECT s.*, (SELECT COUNT(*) FROM stock k WHERE k.store_id = s.id AND k.in_stock = 1) AS in_count,
    (SELECT MAX(started_at) FROM restocks r WHERE r.store_id = s.id) AS last_restock
  FROM stores s WHERE s.metro = ? AND s.online = 0 ORDER BY in_count DESC, last_restock DESC NULLS LAST, s.source, s.name`, metro);

export const metroTotals = (env, skuId = null) => all(env, `
  SELECT s.metro, COUNT(DISTINCT s.id) AS stores, COUNT(DISTINCT CASE WHEN k.in_stock = 1 THEN s.id END) AS in_stock
  FROM stock k JOIN listings l ON l.id = k.listing_id JOIN stores s ON s.id = k.store_id
  WHERE s.online = 0 ${skuId ? 'AND l.sku_id = ?' : ''} GROUP BY s.metro`, ...(skuId ? [skuId] : []));

export const counts = (env) => one(env, `SELECT
  (SELECT COUNT(*) FROM skus WHERE active = 1) AS skus,
  (SELECT COUNT(*) FROM stores WHERE online = 0) AS stores,
  (SELECT COUNT(DISTINCT store_id) FROM stock k JOIN stores s ON s.id = k.store_id WHERE s.online = 0 AND k.in_stock = 1) AS stores_in,
  (SELECT COUNT(*) FROM restocks WHERE started_at > ?) AS restocks_7d,
  (SELECT MAX(seen_at) FROM stock) AS last_check`, now() - 7 * DAY);

/** Measured alert speed (detected → sent), p50/p90 over 7 days. "Promise what you measured" (§0.8). */
export async function measuredSpeed(env) {
  const rows = await all(env, "SELECT detected_to_sent_ms AS ms FROM alert_sent WHERE status = 'sent' AND claimed_at > ? AND detected_to_sent_ms IS NOT NULL ORDER BY ms", now() - 7 * DAY);
  if (rows.length < 20) return null;
  const q = (p) => rows[Math.min(rows.length - 1, Math.floor(p * rows.length))].ms;
  return { p50: q(0.5), p90: q(0.9), n: rows.length };
}

export const sourceHealth = (env) => all(env, 'SELECT * FROM source_health');

/** Per-retailer live tally for the home "radar HUD": checked places and how many have stock now. */
export const sourceTotals = (env) => all(env, `
  SELECT s.source, COUNT(*) AS checked, SUM(k.in_stock) AS in_stock, MAX(k.seen_at) AS last_seen
  FROM stock k JOIN stores s ON s.id = k.store_id GROUP BY s.source`);
