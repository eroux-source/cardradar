// sitemap.xml, robots.txt, llms.txt (§7).
// Restock-time pages enter the sitemap only once they are indexable
// (≥ 20 restocks over > 18 h), so thin pages never reach Bing.
import { all, now } from '../lib/db.js';
import { metros } from '../data/metros.js';
import { sourceList } from '../sources/index.js';

const xml = (body) => new Response(body, { headers: { 'content-type': 'application/xml; charset=utf-8', 'cache-control': 'public, max-age=900' } });
const txt = (body) => new Response(body, { headers: { 'content-type': 'text/plain; charset=utf-8', 'cache-control': 'public, max-age=3600' } });

export async function sitemap(env) {
  const B = env.BASE_URL;
  const since = now() - 30 * 864e5;
  const [skus, stores, skuR, storeR, cityR, srcR] = await Promise.all([
    all(env, 'SELECT slug FROM skus WHERE active = 1'),
    all(env, 'SELECT slug FROM stores WHERE online = 0'),
    all(env, 'SELECT k.slug, COUNT(*) n, MAX(r.started_at) - MIN(r.started_at) span FROM restocks r JOIN skus k ON k.id = r.sku_id WHERE r.started_at > ? GROUP BY k.id', since),
    all(env, 'SELECT s.slug, COUNT(*) n, MAX(r.started_at) - MIN(r.started_at) span FROM restocks r JOIN stores s ON s.id = r.store_id WHERE r.started_at > ? AND s.online = 0 GROUP BY s.id', since),
    all(env, 'SELECT s.metro AS slug, COUNT(*) n, MAX(r.started_at) - MIN(r.started_at) span FROM restocks r JOIN stores s ON s.id = r.store_id WHERE r.started_at > ? AND s.online = 0 GROUP BY s.metro', since),
    all(env, 'SELECT source AS slug, COUNT(*) n, MAX(started_at) - MIN(started_at) span FROM restocks WHERE started_at > ? GROUP BY source', since),
  ]);
  const ok = (rows) => rows.filter((r) => r.n >= 20 && r.span > 18 * 3600e3).map((r) => r.slug);
  const urls = ['/', '/us/cities', '/us/retailers', '/pricing', '/press',
    ...skus.map((k) => `/us/${k.slug}`),
    ...skus.flatMap((k) => metros.map((m) => `/us/${k.slug}/${m.slug}`)),
    ...stores.map((s) => `/us/store/${s.slug}`),
    ...ok(skuR).map((s) => `/us/${s}/restocks`),
    ...ok(storeR).map((s) => `/us/store/${s}/restocks`),
    ...ok(cityR).map((s) => `/us/restocks/${s}`),
    ...ok(srcR).map((s) => `/us/retailer/${s}`),
  ];
  if (ok(srcR).length) urls.push('/us/restocks');
  return xml(`<?xml version="1.0" encoding="UTF-8"?>\n<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">\n${urls.map((u) => `<url><loc>${B}${u}</loc></url>`).join('\n')}\n</urlset>`);
}

export const robots = (env) => txt(`User-agent: *
Allow: /
Disallow: /account
Disallow: /alerts
Disallow: /signin
Disallow: /owner
Disallow: /api/
Disallow: /dev/

Sitemap: ${env.BASE_URL}/sitemap.xml
`);

export const llms = (env) => txt(`# ${env.BRAND_NAME}

> Live Pokémon TCG (trading card game) stock and restock alerts for the United States.

${env.BRAND_NAME} checks sealed Pokémon TCG products (Elite Trainer Boxes, booster boxes, booster bundles, tins) store by store at Target, Best Buy and GameStop in the 50 largest US metro areas, and online at Pokémon Center and Costco, around the clock. Every restock is logged with its time and how long it lasted.

- Live stock for every product: ${env.BASE_URL}/
- When stores restock (real restock times by hour, by retailer, by city): ${env.BASE_URL}/us/restocks
- Retailers: ${env.BASE_URL}/us/retailers — ${sourceList.map((s) => s.name).join(', ')}
- Cities: ${env.BASE_URL}/us/cities
- Alerts by phone notification, Telegram or email: Solo $${env.PRICE_SOLO} or Multi $${env.PRICE_MULTI} for 30 days, cancel in 2 clicks: ${env.BASE_URL}/pricing
- Press data: ${env.BASE_URL}/press

Independent; not affiliated with any retailer or The Pokémon Company. It alerts, it never buys for you.
`);
