// Turns a retailer search result into catalogue rows (set, sku, listing) and lanes.
import { one, run, now } from '../lib/db.js';
import { classify } from '../lib/catalog.js';
import { slugify } from '../lib/util.js';
import { COUNTRIES } from '../data/countries.js';
import { SOURCES } from '../sources/index.js';

// Keep sealed TCG products, drop accessories and apparel that mention "TCG".
const KEEP = /(trading card|tcg|booster|elite trainer|etb|collection|tin|blister|build & battle|battle deck|card game|sammelkarten|top-trainer|display|coffret|cartes?|kaarten|carte|cartas|sobres|buste|set allenatore|caja de entrenador|拡張パック|ハイクラスパック|box)/i;
const DROP = /\b(binder|sleeves?|deck box|playmat|portfolio|plush|t-shirt|shirt|hoodie|pin|dice|card case|toploader|storage|album|keychain|sticker|puzzle|squishmallow|figure(?! collection))\b/i;

export function keepItem(source, item) {
  if (!item?.sourceSku || !item?.title) return false;
  const pokemon = SOURCES[source]?.titleNeedsPokemon === false || /pok[eé]mon/i.test(item.title);
  return pokemon && KEEP.test(item.title) && !DROP.test(item.title);
}

/** Upsert set + sku + listing; create the lanes the crawler will read. Returns listing id. */
export const countryOf = (source) => SOURCES[source]?.country ?? 'us';

export async function upsertListing(env, source, item, metroSlugs = (COUNTRIES[countryOf(source)] ?? COUNTRIES.us).metros.map((m) => m.id)) {
  const c = classify(item.title);
  const t = now();
  let setId = null;
  if (c.set) {
    await run(env, 'INSERT INTO sets (slug, name, created_at) VALUES (?, ?, ?) ON CONFLICT(slug) DO NOTHING', c.setSlug, c.set, t);
    setId = (await one(env, 'SELECT id FROM sets WHERE slug = ?', c.setSlug)).id;
  }
  await run(env, `INSERT INTO skus (slug, name, set_id, type, msrp, created_at) VALUES (?, ?, ?, ?, ?, ?)
    ON CONFLICT(slug) DO UPDATE SET active = 1, set_id = COALESCE(skus.set_id, excluded.set_id), msrp = COALESCE(skus.msrp, excluded.msrp)`,
    c.skuSlug || slugify(item.title), c.name, setId, c.type, item.price ?? null, t);
  const sku = await one(env, 'SELECT id FROM skus WHERE slug = ?', c.skuSlug || slugify(item.title));
  await run(env, `INSERT INTO listings (sku_id, source, source_sku, title, url, price, active, last_seen, country, image) VALUES (?, ?, ?, ?, ?, ?, 1, ?, ?, ?)
    ON CONFLICT(source, source_sku) DO UPDATE SET sku_id = excluded.sku_id, title = excluded.title, url = COALESCE(excluded.url, listings.url),
      price = COALESCE(excluded.price, listings.price), image = COALESCE(excluded.image, listings.image), active = 1, last_seen = excluded.last_seen`,
    sku.id, source, String(item.sourceSku), item.title, item.url ?? null, item.price ?? null, t, countryOf(source), item.image ?? null);
  const listing = await one(env, 'SELECT id FROM listings WHERE source = ? AND source_sku = ?', source, String(item.sourceSku));

  if (SOURCES[source].kind === 'stores') {
    const stmts = metroSlugs.map((m) => env.DB.prepare('INSERT INTO lanes (source, listing_id, metro) VALUES (?, ?, ?) ON CONFLICT DO NOTHING').bind(source, listing.id, m));
    await env.DB.batch(stmts);
  } else {
    await run(env, "INSERT INTO lanes (source, listing_id, metro) VALUES (?, ?, '') ON CONFLICT DO NOTHING", source, listing.id);
  }
  return listing.id;
}

/** Physical store row; returns our id "<source>:<id>". */
export async function upsertStore(env, source, s, metro) {
  const id = `${source}:${s.id}`;
  const slug = slugify(`${SOURCES[source].name} ${s.name} ${s.city ?? ''} ${s.state ?? ''} ${s.id}`);
  await run(env, `INSERT INTO stores (id, source, slug, name, address, city, state, zip, lat, lng, metro, online, country)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 0, ?)
    ON CONFLICT(id) DO UPDATE SET name = excluded.name, address = COALESCE(excluded.address, stores.address),
      city = COALESCE(excluded.city, stores.city), state = COALESCE(excluded.state, stores.state), zip = COALESCE(excluded.zip, stores.zip),
      lat = COALESCE(excluded.lat, stores.lat), lng = COALESCE(excluded.lng, stores.lng), metro = COALESCE(stores.metro, excluded.metro)`,
    id, source, slug, s.name, s.address ?? null, s.city ?? null, s.state ?? null, s.zip ?? null, s.lat ?? null, s.lng ?? null, metro, countryOf(source));
  return id;
}

export async function onlineStore(env, source) {
  const id = `${source}:online`;
  await run(env, `INSERT INTO stores (id, source, slug, name, online, country) VALUES (?, ?, ?, ?, 1, ?) ON CONFLICT(id) DO NOTHING`,
    id, source, `${source}-online`, `${SOURCES[source].name} online`, countryOf(source));
  return id;
}
