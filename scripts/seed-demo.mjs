// LOCAL DEMO ONLY: fake products, stores and restocks to look at the pages and test alerts.
// node scripts/seed-demo.mjs > /tmp/seed.sql && npx wrangler d1 execute cardradar --local --file /tmp/seed.sql
// Never run against production (the release workflow never does).
const t = Date.now();
const out = [];
const q = (v) => (v == null ? 'NULL' : typeof v === 'number' ? v : `'${String(v).replace(/'/g, "''")}'`);
const ins = (table, row) => out.push(`INSERT INTO ${table} (${Object.keys(row).join(',')}) VALUES (${Object.values(row).map(q).join(',')});`);
let seed = 7; const rnd = () => ((seed = (seed * 16807) % 2147483647) / 2147483647);

out.push("UPDATE settings SET value = 'off' WHERE key = 'crawl';");
const sets = [[1, 'prismatic-evolutions', 'Prismatic Evolutions'], [2, 'surging-sparks', 'Surging Sparks'], [3, 'destined-rivals', 'Destined Rivals'], [4, 'journey-together', 'Journey Together']];
for (const [id, slug, name] of sets) ins('sets', { id, slug, name, created_at: t });
const skus = [
  [1, 'prismatic-evolutions-elite-trainer-box', 'Prismatic Evolutions Elite Trainer Box', 1, 'etb', 49.99],
  [2, 'surging-sparks-booster-box', 'Surging Sparks Booster Box', 2, 'booster_box', 160.99],
  [3, 'destined-rivals-elite-trainer-box', 'Destined Rivals Elite Trainer Box', 3, 'etb', 49.99],
  [4, 'journey-together-booster-bundle', 'Journey Together Booster Bundle', 4, 'booster_bundle', 26.94],
];
for (const [id, slug, name, set_id, type, msrp] of skus) ins('skus', { id, slug, name, set_id, type, msrp, created_at: t });

const metros = [['new-york', 'NY', 'New York'], ['los-angeles', 'CA', 'Los Angeles'], ['chicago', 'IL', 'Chicago']];
const physical = ['target', 'gamestop', 'bestbuy'];
const names = { target: 'Target', gamestop: 'GameStop', bestbuy: 'Best Buy' };
const stores = [];
let n = 100;
for (const [metro, state, city] of metros) for (const src of physical) for (let i = 1; i <= 2; i++) {
  const id = `${src}:${n++}`; const nm = `${city} ${['Downtown', 'North'][i - 1]}`;
  stores.push({ id, src, metro, state });
  ins('stores', { id, source: src, slug: `${src}-${city.toLowerCase().replace(/ /g, '-')}-${['downtown', 'north'][i - 1]}`, name: nm, address: `${100 * i} Main St`, city, state, zip: '10001', metro, online: 0 });
}
for (const src of ['pokemoncenter', 'costco', 'target', 'bestbuy']) {
  ins('stores', { id: `${src}:online`, source: src, slug: `${src}-online`, name: 'Online', online: 1 });
  stores.push({ id: `${src}:online`, src, online: true });
}
let lid = 1;
const listings = [];
for (const [skuId, slug, name, , , msrp] of skus) for (const src of ['target', 'gamestop', 'bestbuy', 'pokemoncenter', 'costco']) {
  if (src === 'costco' && skuId !== 2) continue;
  ins('listings', { id: lid, sku_id: skuId, source: src, source_sku: `demo-${src}-${skuId}`, title: name, url: `https://example.com/${src}/${slug}`, price: msrp, last_seen: t });
  listings.push({ id: lid++, skuId, src, msrp });
}
let rid = 1;
for (const l of listings) for (const s of stores.filter((x) => x.src === l.src)) {
  const count = Math.floor(rnd() * (l.skuId === 4 ? 3 : 8));
  for (let i = 0; i < count; i++) {
    const day = Math.floor(rnd() * 29) + 1;
    const hourEt = rnd() < 0.6 ? 8 + Math.floor(rnd() * 2) : Math.floor(rnd() * 24);
    const start = t - day * 864e5 - ((t / 3600e3) % 24) * 3600e3 + (hourEt + 4) * 3600e3 + Math.floor(rnd() * 3600e3);
    const lasted = (4 + Math.floor(rnd() * 60)) * 60e3;
    ins('restocks', { id: rid++, listing_id: l.id, sku_id: l.skuId, store_id: s.id, source: l.src, started_at: Math.floor(start), ended_at: Math.floor(start + lasted), qty: s.online ? null : 1 + Math.floor(rnd() * 4), price: l.msrp, matched_at: Math.floor(start) });
  }
  const inStock = rnd() < 0.15 ? 1 : 0;
  ins('stock', { listing_id: l.id, store_id: s.id, in_stock: inStock, qty: inStock ? 2 : 0, price: l.msrp, seen_at: t - Math.floor(rnd() * 240e3), in_since: inStock ? t - 20 * 60e3 : null });
  if (inStock) ins('restocks', { id: rid++, listing_id: l.id, sku_id: l.skuId, store_id: s.id, source: l.src, started_at: t - 20 * 60e3, qty: 2, price: l.msrp, matched_at: t - 20 * 60e3 });
}
for (const src of ['target', 'gamestop', 'bestbuy', 'pokemoncenter', 'costco']) ins('source_health', { source: src, status: 'ok', last_ok_at: t - 60e3, updated_at: t });
console.log(out.join('\n'));
