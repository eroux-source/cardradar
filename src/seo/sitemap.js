// sitemap.xml, robots.txt, llms.txt (§7).
// Restock-time pages enter the sitemap only once they are indexable
// (≥ 20 restocks over > 18 h), so thin pages never reach Bing.
import { all, now } from '../lib/db.js';
import { COUNTRIES, countryList } from '../data/countries.js';
import { sourceList, sourcesOf } from '../sources/index.js';
import { liveCountries } from '../web/data.js';
import { JP_SETS } from '../data/sets_jp.js';
import { JP_SHOPS } from '../web/pages/lottery.js';

const xml = (body) => new Response(body, { headers: { 'content-type': 'application/xml; charset=utf-8', 'cache-control': 'public, max-age=900' } });
const txt = (body) => new Response(body, { headers: { 'content-type': 'text/plain; charset=utf-8', 'cache-control': 'public, max-age=3600' } });

// Only countries with live data enter the sitemap ("coming soon" pages stay out: no thin pages).
export async function sitemap(env) {
  const B = env.BASE_URL;
  const since = now() - 30 * 864e5;
  const live = await liveCountries(env);
  const urls = ['/press'];
  for (const cc of live) {
    if (cc === 'jp') continue;
    const P = `/${cc}`; const home = cc === 'us' ? '/' : P;
    const [skus, stores, skuR, storeR, cityR, srcR] = await Promise.all([
      all(env, 'SELECT DISTINCT k.slug FROM skus k JOIN listings l ON l.sku_id = k.id AND l.country = ? AND l.active = 1 WHERE k.active = 1', cc),
      all(env, 'SELECT slug FROM stores WHERE online = 0 AND country = ?', cc),
      all(env, 'SELECT k.slug, COUNT(*) n, MAX(r.started_at) - MIN(r.started_at) span FROM restocks r JOIN skus k ON k.id = r.sku_id JOIN stores s ON s.id = r.store_id WHERE r.started_at > ? AND s.country = ? GROUP BY k.id', since, cc),
      all(env, 'SELECT s.slug, COUNT(*) n, MAX(r.started_at) - MIN(r.started_at) span FROM restocks r JOIN stores s ON s.id = r.store_id WHERE r.started_at > ? AND s.online = 0 AND s.country = ? GROUP BY s.id', since, cc),
      all(env, 'SELECT s.metro AS id, COUNT(*) n, MAX(r.started_at) - MIN(r.started_at) span FROM restocks r JOIN stores s ON s.id = r.store_id WHERE r.started_at > ? AND s.online = 0 AND s.country = ? GROUP BY s.metro', since, cc),
      all(env, 'SELECT r.source AS slug, COUNT(*) n, MAX(r.started_at) - MIN(r.started_at) span FROM restocks r JOIN stores s ON s.id = r.store_id WHERE r.started_at > ? AND s.country = ? GROUP BY r.source', since, cc),
    ]);
    const ok = (rows) => rows.filter((r) => r.n >= 20 && r.span > 18 * 3600e3);
    const metros = COUNTRIES[cc].metros;
    const hasStores = sourcesOf(cc).some((s) => s.checkArea);
    urls.push(home, `${P}/retailers`, cc === 'us' ? '/pricing' : `${P}/pricing`,
      ...skus.map((k) => `${P}/${k.slug}`),
      ...ok(skuR).map((r) => `${P}/${r.slug}/restocks`),
      ...ok(srcR).map((r) => `${P}/retailer/${r.slug}`));
    if (hasStores) {
      urls.push(`${P}/cities`,
        ...skus.flatMap((k) => metros.map((m) => `${P}/${k.slug}/${m.slug}`)),
        ...stores.map((s) => `${P}/store/${s.slug}`),
        ...ok(storeR).map((r) => `${P}/store/${r.slug}/restocks`),
        ...ok(cityR).map((r) => `${P}/restocks/${metros.find((m) => m.id === r.id)?.slug ?? r.id}`));
    }
    if (ok(srcR).length) urls.push(`${P}/restocks`);
  }
  // Japan: the lottery calendar is useful as soon as one lottery is listed
  const jp = await all(env, 'SELECT DISTINCT source, set_slug FROM lotteries WHERE country = ? AND last_seen > ?', 'jp', since);
  if (jp.length) {
    urls.push('/jp',
      ...JP_SETS.filter((s) => jp.some((l) => l.set_slug === s.slug)).map((s) => `/jp/set/${s.slug}`),
      ...Object.keys(JP_SHOPS).filter((id) => jp.some((l) => l.source === id)).map((id) => `/jp/shop/${id}`));
  }
  return xml(`<?xml version="1.0" encoding="UTF-8"?>\n<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">\n${[...new Set(urls)].map((u) => `<url><loc>${B}${u}</loc></url>`).join('\n')}\n</urlset>`);
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

export const llms = async (env) => {
  const live = await liveCountries(env);
  const lines = countryList.filter((c) => c.code === 'jp' || live.has(c.code)).map((c) => c.code === 'jp'
    ? `- Japan (日本): Pokémon card lottery, pre-order and re-sale calendar (抽選・予約・再販) with closing-time reminders: ${env.BASE_URL}/jp`
    : `- ${c.name}: live stock at ${[...new Set(sourcesOf(c.code).map((s) => s.name))].join(', ')}: ${env.BASE_URL}${c.code === 'us' ? '/' : `/${c.code}`}`);
  return txt(`# ${env.BRAND_NAME}

> Live Pokémon TCG (trading card game) stock, restock alerts and Japanese lottery calendar.

${env.BRAND_NAME} checks sealed Pokémon TCG products (Elite Trainer Boxes, booster boxes, booster bundles, tins) at major retailers, store by store where retailers publish it, around the clock. Every restock is logged with its time and how long it lasted.

Countries:
${lines.join('\n')}

- When stores restock in the US (real restock times by hour, by retailer, by city): ${env.BASE_URL}/us/restocks
- Retailers: ${sourceList.map((s) => s.name).filter((v, i, a) => a.indexOf(v) === i).join(', ')}
- Alerts by phone notification, Telegram, LINE (Japan) or email, sold for 30 days, cancel in 2 clicks: ${env.BASE_URL}/pricing
- Press data: ${env.BASE_URL}/press

Independent; not affiliated with any retailer or The Pokémon Company. It alerts, it never buys for you.
`);
};
