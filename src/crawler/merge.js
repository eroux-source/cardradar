// One page per product (2026-11-06). The catalogue rules in lib/catalog.js decide which page a
// shop listing belongs to; when they improve, this job (hourly) moves existing listings to their
// page, moves alerts and restock history with them, and leaves a 301 from every emptied page.
import { all, run, now } from '../lib/db.js';
import { classify } from '../lib/catalog.js';
import { slugify } from '../lib/util.js';
import { notSealed } from './catalog.js';

const chunks = (a, n) => Array.from({ length: Math.ceil(a.length / n) }, (_, i) => a.slice(i * n, i * n + n));
const batch = async (env, stmts) => { for (const c of chunks(stmts, 50)) await env.DB.batch(c); };

export async function mergeSkus(env) {
  // listings that are not a sealed product (rip & ship, breaks, events) stop being read and shown
  const off = (await all(env, 'SELECT id, title FROM listings WHERE active = 1')).filter((r) => notSealed(r.title));
  await batch(env, off.map((r) => env.DB.prepare('UPDATE listings SET active = 0 WHERE id = ?').bind(r.id)));
  const rows = await all(env, 'SELECT l.id, l.sku_id, l.title, l.price, k.slug FROM listings l JOIN skus k ON k.id = l.sku_id');
  const moves = [];
  for (const r of rows) {
    const c = classify(r.title);
    const to = c.skuSlug || slugify(r.title);
    if (to && to !== r.slug) moves.push({ ...r, c, to });
  }
  if (!moves.length) return { moved: 0 };
  const t = now();

  // 1. the pages listings move to
  const targets = new Map();
  for (const m of moves) if (!targets.has(m.to)) targets.set(m.to, m);
  const sets = [...new Map([...targets.values()].filter((m) => m.c.set).map((m) => [m.c.setSlug, m.c.set]))];
  await batch(env, sets.map(([slug, name]) => env.DB.prepare('INSERT INTO sets (slug, name, created_at) VALUES (?, ?, ?) ON CONFLICT(slug) DO NOTHING').bind(slug, name, t)));
  const setId = new Map((await all(env, 'SELECT id, slug FROM sets')).map((s) => [s.slug, s.id]));
  await batch(env, [...targets.values()].map((m) => env.DB.prepare(`INSERT INTO skus (slug, name, set_id, type, msrp, created_at) VALUES (?, ?, ?, ?, ?, ?)
    ON CONFLICT(slug) DO UPDATE SET active = 1, set_id = COALESCE(skus.set_id, excluded.set_id)`).bind(m.to, m.c.name, m.c.set ? setId.get(m.c.setSlug) ?? null : null, m.c.type, m.price ?? null, t)));
  const skuId = new Map((await all(env, 'SELECT id, slug FROM skus')).map((s) => [s.slug, s.id]));

  // 2. move the listings
  await batch(env, moves.filter((m) => skuId.has(m.to)).map((m) => env.DB.prepare('UPDATE listings SET sku_id = ? WHERE id = ?').bind(skuId.get(m.to), m.id)));

  // 3. pages left empty: alerts, leads and restock history follow, the old address redirects
  const left = new Set((await all(env, 'SELECT DISTINCT sku_id FROM listings')).map((r) => r.sku_id));
  const byOld = new Map();
  for (const m of moves) {
    if (left.has(m.sku_id) || !skuId.has(m.to)) continue;
    const o = byOld.get(m.sku_id) ?? { slug: m.slug, votes: new Map() };
    o.votes.set(m.to, (o.votes.get(m.to) ?? 0) + 1);
    byOld.set(m.sku_id, o);
  }
  const stmts = [];
  for (const [oldId, o] of byOld) {
    const to = [...o.votes].sort((a, b) => b[1] - a[1])[0][0];
    const newId = skuId.get(to);
    stmts.push(
      env.DB.prepare('UPDATE alerts SET sku_id = ? WHERE sku_id = ?').bind(newId, oldId),
      env.DB.prepare('UPDATE leads SET sku_id = ? WHERE sku_id = ?').bind(newId, oldId),
      env.DB.prepare('UPDATE restocks SET sku_id = ? WHERE sku_id = ?').bind(newId, oldId),
      env.DB.prepare('UPDATE skus SET active = 0 WHERE id = ?').bind(oldId),
      env.DB.prepare('INSERT INTO sku_redirects (old_slug, new_slug, created_at) VALUES (?, ?, ?) ON CONFLICT(old_slug) DO UPDATE SET new_slug = excluded.new_slug').bind(o.slug, to, t),
      env.DB.prepare('UPDATE sku_redirects SET new_slug = ? WHERE new_slug = ?').bind(to, o.slug), // no redirect chains
      env.DB.prepare('DELETE FROM sku_redirects WHERE old_slug = ?').bind(to), // the kept page is a live page again
    );
  }
  await batch(env, stmts);
  await run(env, "INSERT INTO settings (key, value, updated_at) VALUES ('merge.last', ?, ?) ON CONFLICT(key) DO UPDATE SET value = excluded.value, updated_at = excluded.updated_at",
    JSON.stringify({ moved: moves.length, merged: byOld.size }), t);
  return { moved: moves.length, merged: byOld.size };
}
