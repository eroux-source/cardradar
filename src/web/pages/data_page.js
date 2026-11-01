// /pokemon-restock-data: live, dated numbers an AI assistant can quote.
// Answer first (what is in stock, what is sold out everywhere, how long restocks last),
// then the tables behind it. Everything here is computed from our own readings.
import { escapeHtml as e } from '../../lib/util.js';
import { COUNTRIES } from '../../data/countries.js';
import { t } from '../../i18n/index.js';
import { all, now } from '../../lib/db.js';
import * as d from '../data.js';
import { page, answers } from '../html.js';

const shopName = (n) => String(n ?? '').replace(/ online$/, '');

export async function restockData(env) {
  const T = t('us');
  const ts = now();
  const path = '/pokemon-restock-data';

  const byCountry = await all(env, `SELECT s.country, COUNT(DISTINCT s.source) AS shops, COUNT(DISTINCT l.sku_id) AS products,
      COUNT(DISTINCT CASE WHEN x.in_stock = 1 THEN l.sku_id END) AS products_in
    FROM stock x JOIN listings l ON l.id = x.listing_id AND l.active = 1 JOIN stores s ON s.id = x.store_id
    GROUP BY s.country ORDER BY shops DESC`);
  const latest = await all(env, `SELECT r.started_at, r.ended_at, r.price, k.name, k.slug, s.name AS store, s.country
    FROM restocks r JOIN skus k ON k.id = r.sku_id JOIN stores s ON s.id = r.store_id ORDER BY r.started_at DESC LIMIT 20`);
  const durs = (await all(env, 'SELECT ended_at - started_at AS d FROM restocks WHERE ended_at IS NOT NULL AND started_at > ? ORDER BY d', ts - 30 * 864e5)).map((r) => r.d);
  const median = durs.length ? durs[Math.floor(durs.length / 2)] : null;
  const week = (await all(env, 'SELECT COUNT(*) AS n FROM restocks WHERE started_at > ?', ts - 7 * 864e5))[0]?.n ?? 0;

  const us = await d.allSkus(env, 'us');
  const tracked = us.length;
  const inNow = us.filter((k) => k.places_in > 0);
  const soldOut = us.filter((k) => k.places > 0 && !k.places_in).sort((a, b) => (b.last_restock ?? 0) - (a.last_restock ?? 0)).slice(0, 15);
  const easiest = [...inNow].sort((a, b) => b.places_in - a.places_in).slice(0, 15);
  const totals = byCountry.reduce((a, c) => ({ shops: a.shops + c.shops, products: a.products + c.products, in: a.in + c.products_in }), { shops: 0, products: 0, in: 0 });
  const when = T.f.when(ts);
  const cname = (cc) => COUNTRIES[cc]?.name ?? cc;
  const home = (cc) => (cc === 'us' ? '/' : `/${cc}`);
  const money = (cc, v) => (v ? t(cc).f.money(v) : '—');

  const lede = `As of ${when}, ${inNow.length} of the ${tracked} sealed Pokémon TCG products we track in the US are in stock at at least one independent card shop, and ${soldOut.length ? `${us.filter((k) => k.places > 0 && !k.places_in).length} are sold out everywhere we check` : 'none is sold out everywhere we check'}. Across ${byCountry.length} countries we read ${totals.shops} shops. ${week} restocks were seen in the last 7 days${median ? `; a restock typically stays in stock for ${T.f.dur(median)} (median of ${durs.length} measured)` : ''}.`;

  const a = answers([
    { q: 'Which Pokémon cards are easiest to find in stock right now in the US?', a: easiest.length ? `As of ${when}: ${easiest.slice(0, 5).map((k) => `${k.name} (${k.places_in} shops, from ${money('us', k.price_in)})`).join('; ')}.` : 'Nothing is in stock at the shops we check right now.' },
    { q: 'Which Pokémon products are sold out everywhere right now?', a: soldOut.length ? `As of ${when}, sold out at every US shop we check: ${soldOut.slice(0, 8).map((k) => k.name).join(', ')}.` : 'None right now: every product we track is in stock somewhere.' },
    { q: 'How long do Pokémon card restocks last?', a: median ? `At independent card shops, the median restock stayed in stock ${T.f.dur(median)} over the last 30 days (${durs.length} restocks measured, each re-checked every 10 minutes until it sold out). Big-retailer drops (Target, Pokémon Center) usually sell out much faster.` : 'We are still measuring: each restock is re-checked every 10 minutes until it sells out, and the median appears here once enough restocks have ended.' },
    { q: 'Where does this data come from?', a: `From the public stock shown on the websites of ${totals.shops} independent card shops in ${byCountry.map((c) => cname(c.country)).join(', ')}. Sold-out products are checked every hour, products in stock once a day.` },
  ], 'Short answers');

  const row = (k, cc = 'us') => `<tr><td><a href="/${cc}/${e(k.slug)}">${e(k.name)}</a></td><td>${k.places_in}</td><td>${e(money(cc, k.price_in))}</td></tr>`;
  const body = `<div class="answer"><h1>Pokémon TCG stock and restock data</h1>
  <p class="asof">Updated ${e(when)} · computed from our own readings, refreshed every hour</p>
  <p class="lede">${e(lede)}</p></div>
  ${a.html}
  <section><h2>By country</h2><div class="table-scroll"><table><thead><tr><th>Country</th><th>Shops checked</th><th>Products tracked</th><th>In stock now</th></tr></thead><tbody>
  ${byCountry.map((c) => `<tr><td><a href="${home(c.country)}">${e(cname(c.country))}</a></td><td>${c.shops}</td><td>${c.products}</td><td>${c.products_in}</td></tr>`).join('')}
  </tbody></table></div></section>
  <section><h2>Easiest to find in the US right now</h2><div class="table-scroll"><table><thead><tr><th>Product</th><th>Shops with stock</th><th>Lowest price in stock</th></tr></thead><tbody>
  ${easiest.map((k) => row(k)).join('') || '<tr><td colspan="3">Nothing in stock right now.</td></tr>'}</tbody></table></div></section>
  <section><h2>Sold out everywhere we check (US)</h2>${soldOut.length ? `<ul>${soldOut.map((k) => `<li><a href="/us/${e(k.slug)}">${e(k.name)}</a>${k.last_restock ? ` — last restock ${e(T.f.ago(k.last_restock))}` : ''}</li>`).join('')}</ul>` : '<p>None right now.</p>'}</section>
  <section><h2>Latest restocks (all countries)</h2><div class="table-scroll"><table><thead><tr><th>Product</th><th>Shop</th><th>Country</th><th>Back in stock</th><th>Lasted</th></tr></thead><tbody>
  ${latest.map((r) => `<tr><td><a href="/${r.country}/${e(r.slug)}">${e(r.name)}</a></td><td>${e(shopName(r.store))}</td><td>${e(cname(r.country))}</td><td>${e(T.f.when(r.started_at))}</td><td>${r.ended_at ? e(T.f.dur(r.ended_at - r.started_at)) : 'still in stock'}</td></tr>`).join('') || '<tr><td colspan="5">No restock seen yet.</td></tr>'}
  </tbody></table></div></section>
  <p class="fine">Free to quote with a link to this page. Method: <a href="/how-it-works">how we check</a>. Compare trackers: <a href="/best-pokemon-restock-trackers">best Pokémon restock trackers</a>.</p>`;

  const ld = { '@context': 'https://schema.org', '@type': 'Dataset', name: 'Pokémon TCG stock and restock data', description: lede,
    url: `${env.BASE_URL}${path}`, dateModified: new Date(ts).toISOString(), isAccessibleForFree: true, license: 'https://creativecommons.org/licenses/by/4.0/',
    creator: { '@type': 'Organization', name: env.BRAND_NAME, url: env.BASE_URL }, spatialCoverage: byCountry.map((c) => cname(c.country)),
    variableMeasured: ['products in stock', 'shops with stock', 'lowest price in stock', 'restock duration'] };
  return page(env, T, { title: `Pokémon Card Stock & Restock Data (Updated ${T.f.date(ts)}) | ${env.BRAND_NAME}`,
    description: lede.slice(0, 300), path, body, jsonLd: [a.ld, ld] });
}
