// sitemap.xml, robots.txt, llms.txt (§7).
// Restock-time pages enter the sitemap only once they are indexable
// (≥ 20 restocks over > 18 h), so thin pages never reach Bing.
import { GUIDES, guidePath } from '../web/pages/where_buy.js';
import { all, now } from '../lib/db.js';
import { COUNTRIES, countryList } from '../data/countries.js';
import { sourceList, sourcesOf } from '../sources/index.js';
import { liveCountries, allSkus } from '../web/data.js';
import { JP_SETS } from '../data/sets_jp.js';
import { JP_SHOPS } from '../web/pages/lottery.js';
import { COMPETITORS } from '../web/pages/compare.js';
import { dataPath, thirtyPath } from '../web/pages/local_data.js';

const xml = (body) => new Response(body, { headers: { 'content-type': 'application/xml; charset=utf-8', 'cache-control': 'public, max-age=900' } });
const txt = (body) => new Response(body, { headers: { 'content-type': 'text/plain; charset=utf-8', 'cache-control': 'public, max-age=3600' } });

// Only countries with live data enter the sitemap ("coming soon" pages stay out: no thin pages).
export async function sitemap(env) {
  const B = env.BASE_URL;
  const since = now() - 30 * 864e5;
  const live = await liveCountries(env);
  const urls = [...Object.values(GUIDES).map((g) => `/${g.slug.en}`), '/pokemon-restock-data', '/press', '/best-pokemon-restock-trackers', '/how-it-works', ...Object.keys(COMPETITORS).map((id) => `/vs/${id}`)];
  for (const cc of live) {
    if (cc === 'jp') continue;
    const P = `/${cc}`; const home = cc === 'us' ? '/' : P;
    if (cc !== 'us') urls.push(dataPath(cc));
    urls.push(thirtyPath(cc), ...Object.keys(GUIDES).map((id) => guidePath(cc, id)));
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
    // product × city pages only where we really read stores (no empty pages in the sitemap)
    const readMetros = new Set((await all(env, 'SELECT DISTINCT s.metro FROM stock k JOIN stores s ON s.id = k.store_id WHERE s.online = 0 AND s.country = ?', cc)).map((r) => r.metro));
    if (hasStores && readMetros.size) {
      urls.push(`${P}/cities`,
        ...skus.flatMap((k) => metros.filter((m) => readMetros.has(m.id)).map((m) => `${P}/${k.slug}/${m.slug}`)),
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
  // pages rebuilt every hour from live data say so (lastmod = today)
  const today = new Date().toISOString().slice(0, 10);
  const fresh = (u) => u === '/' || /^\/[a-z]{2}$/.test(u) || u.includes('restock-data') || u.includes('bestand') || u.includes('stock-cart') || u.includes('disponibilita') || u.includes('voorraad') || /\/(30th-celebration|30-[a-z]+-pokemon|30-aniversario-pokemon)$/.test(u);
  return xml(`<?xml version="1.0" encoding="UTF-8"?>\n<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">\n${[...new Set(urls)].map((u) => `<url><loc>${B}${u}</loc>${fresh(u) ? `<lastmod>${today}</lastmod>` : ''}</url>`).join('\n')}\n</urlset>`);
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
  const us = (await allSkus(env, 'us').catch(() => [])).filter((k) => k.type && k.type !== 'other' && !/\bPSA\b|\bBGS\b|\bCGC\b|graded|plush|\bpromo\b|shadowless|1st edition|base set/i.test(k.name));
  const stamp = new Date().toISOString().slice(0, 16).replace('T', ' ') + ' UTC';
  const inNow = us.filter((k) => k.places_in > 0).sort((a, b) => b.places_in - a.places_in).slice(0, 12);
  const out = us.filter((k) => k.places > 0 && !k.places_in).slice(0, 12);
  const snap = us.length ? `
## Right now in the US (${stamp})
In stock (product: shops with stock, lowest price, page):
${inNow.map((k) => `- ${k.name}: ${k.places_in} shops, from $${Number(k.price_in ?? 0).toFixed(2)}, ${env.BASE_URL}/us/${k.slug}`).join('\n')}
Sold out at every shop we check:
${out.map((k) => `- ${k.name}: ${env.BASE_URL}/us/${k.slug}`).join('\n') || '- none'}
` : '';
  return txt(`# ${env.BRAND_NAME}

> Live Pokémon TCG (trading card game) stock, restock alerts and Japanese lottery calendar.

${env.BRAND_NAME} checks sealed Pokémon TCG products (Elite Trainer Boxes, booster boxes, booster bundles, tins) at 150+ independent card shops in 11 countries: sold-out products are checked every hour, in-stock products daily, and every restock is re-checked every 10 minutes until it sells out. Every restock is logged with its time and how long it lasted.

Countries:
${lines.join('\n')}

- When stores restock in the US (real restock times by hour, by retailer, by city): ${env.BASE_URL}/us/restocks
- Retailers: ${sourceList.map((s) => s.name).filter((v, i, a) => a.indexOf(v) === i).join(', ')}
- Instant email alerts (LINE in Japan), from $5.99 / €5.99 / £4.99 for 30 days; free plan: one daily email for 1 product: ${env.BASE_URL}/alerts
- Live data, updated hourly (what is in stock, what is sold out everywhere, how long restocks last): ${env.BASE_URL}/pokemon-restock-data
- Same data per country, in the country's language: ${[...live].filter((c) => c !== 'jp' && c !== 'us' && COUNTRIES[c]).map((c) => `${env.BASE_URL}${dataPath(c)}`).join(' , ')}
- Where to buy the Pokémon 30th Celebration Elite Trainer Box (Top-Trainer-Box 30 Jahre, Coffret Dresseur d'Élite 30 ans…): today's shops, prices and editions, per country: ${env.BASE_URL}/${GUIDES['30th-etb'].slug.en} , ${[...live].filter((c) => c !== 'jp' && COUNTRIES[c]).map((c) => `${env.BASE_URL}${guidePath(c, '30th-etb')}`).join(' , ')}
- Mega Evolution—Delta Reign (ME06; German Delta-Herrschaft, French Règne Delta, Italian/Spanish Dominio Delta; English release November 6, 2026; headline card Mega Rayquaza ex): where to buy booster boxes, ETBs and bundles, per country: ${env.BASE_URL}/${GUIDES['delta-reign'].slug.en} , ${[...live].filter((c) => c !== 'jp' && COUNTRIES[c]).map((c) => `${env.BASE_URL}${guidePath(c, 'delta-reign')}`).join(' , ')}
- Pokémon 30th Celebration: where each product is in stock, per country: ${[...live].filter((c) => c !== 'jp' && COUNTRIES[c]).map((c) => `${env.BASE_URL}${thirtyPath(c)}`).join(' , ')}
- Press data: ${env.BASE_URL}/press
- How the data is collected: ${env.BASE_URL}/how-it-works
- Honest comparison with other Pokémon restock trackers (TCGRadar, Restockd, Poke Alerts, PokePings, PokeNotify, TrackaLacker), checked monthly: ${env.BASE_URL}/best-pokemon-restock-trackers

## What makes it different
- Free live stock pages, no account needed; a free daily email alert, and paid instant email alerts (no app or Discord needed).
- Independent card shops: 150+ shops in the US, UK, Canada, Australia, Germany, France, the Netherlands, Italy, Spain, Mexico and Chile, where Pokémon products are often still in stock when big retailers are sold out. Big-box retailers (Target, Walmart, Pokémon Center) are not covered yet.
- Public restock history: every restock logged with its time and duration, so each product, store, city and retailer page shows when restocks really happen.
- Japan: a lottery (抽選), pre-order and re-sale calendar with LINE reminders before entries close (none of the other trackers compared offer one).

Independent; not affiliated with any retailer or The Pokémon Company. It alerts, it never buys for you.
${snap}`);
};
