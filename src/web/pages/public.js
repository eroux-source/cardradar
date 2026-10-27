// Public, indexable pages, one country each (cc), in its language.
//   /{cc}                    home (the US keeps "/")
//   /{cc}/{sku}              product: live stock + answer line + facts + 3 answers
//   /{cc}/{sku}/{city}       product × city
//   /{cc}/{sku}/restocks     when it restocks (indexable only with real history)
//   /{cc}/store/{slug}       a store
//   /{cc}/restocks[/{city}]  restock times
//   /{cc}/retailer/{id}      a retailer
import { escapeHtml as e } from '../../lib/util.js';
import { COUNTRIES, countryList, metroInCountry, metroById } from '../../data/countries.js';
import { SOURCES, sourcesOf, sourceName } from '../../sources/index.js';
import { t } from '../../i18n/index.js';
import * as d from '../data.js';
import { page, home as homePath, base, chip, crumbs, answers, hourChart, placeRows, latestTable, cityGrid, retailerGrid, alertCta, placeLabel, shopsText, productGrid } from '../html.js';
import { factsBlock } from '../facts.js';
import { stockPage } from './stock.js';

const asOf = (T, ts) => (ts ? T.asOf(T.f.when(ts)) : T.waiting);

/** hreflang alternates for the country homes that are live. */
const homeAlternates = (live) => Object.fromEntries(countryList.filter((c) => live.has(c.code)).map((c) => [c.code, homePath(c.code)]));

/* ---------- home ---------- */
export async function home(env, cc) {
  const T = t(cc);
  const live = await d.liveCountries(env);
  const skus = live.has(cc) ? await d.allSkus(env, cc) : [];
  const shops = shopsText(T, cc);
  const ld = [{ '@context': 'https://schema.org', '@type': 'WebSite', name: env.BRAND_NAME, url: `${env.BASE_URL}${homePath(cc)}`, inLanguage: T.cc.locale },
    { '@context': 'https://schema.org', '@type': 'Organization', name: env.BRAND_NAME, url: env.BASE_URL, logo: `${env.BASE_URL}/icon.svg`, email: env.SUPPORT_EMAIL },
    { '@context': 'https://schema.org', '@type': 'WebApplication', name: env.BRAND_NAME, url: `${env.BASE_URL}${homePath(cc)}`, applicationCategory: 'ShoppingApplication', operatingSystem: 'Any (web browser)',
      description: T.home.desc(shops), inLanguage: T.cc.locale,
      offers: [{ '@type': 'Offer', name: 'Live stock pages + daily email alert', price: '0', priceCurrency: T.cc.currency },
        { '@type': 'Offer', name: 'Solo alerts, 30 days', price: T.cc.prices.solo, priceCurrency: T.cc.currency },
        { '@type': 'Offer', name: 'Multi alerts, 30 days', price: T.cc.prices.multi, priceCurrency: T.cc.currency }] }];
  // Like InStock Radar: the home IS the live stock of the product people chase most (hardest to find first)
  if (skus.length) {
    const k = await d.skuBySlug(env, skus[0].slug);
    return stockPage(env, T, cc, k, { isHome: true, live, alternates: homeAlternates(live), extraLd: ld });
  }
  const body = `<div class="answer"><h1>${e(T.home.h1)}</h1><p class="lede">${T.home.soon(T.cc.name)}</p></div>${await factsBlock(env, T)}`;
  return page(env, T, { title: T.home.title(env.BRAND_NAME), description: T.home.desc(shops), path: homePath(cc), body, noindex: true, alternates: homeAlternates(live), live, jsonLd: ld });
}

/* ---------- product ---------- */
export async function sku(env, cc, slug, metroSlug = null) {
  const T = t(cc);
  const k = await d.skuBySlug(env, slug);
  const metro = metroSlug ? metroInCountry(cc, metroSlug) : null;
  if (!k || (metroSlug && !metro) || !(await d.skuInCountry(env, k.id, cc))) return null;
  return stockPage(env, T, cc, k, { metro });
}

/** /{cc}/search?q= : one clear match → its page; else the matching products (or all of them). */
export async function search(env, cc, q) {
  const T = t(cc); const S = T.sv;
  const skus = await d.allSkus(env, cc);
  const strip = (x) => String(x ?? '').toLowerCase().normalize('NFKD').replace(/[\u0300-\u036f]/g, '');
  const words = strip(q).replace(/\betb\b/g, 'elite trainer box').split(/[^a-z0-9]+/).filter((w) => w.length > 1 && !['pokemon', 'tcg', 'the'].includes(w));
  const scored = skus.map((k) => ({ k, n: words.filter((w) => strip(k.name).includes(w)).length })).filter((x) => x.n).sort((a, b) => b.n - a.n);
  const exact = skus.find((k) => strip(k.name) === strip(q).trim());
  if (exact || (scored.length && (scored.length === 1 || scored[0].n > scored[1].n))) return Response.redirect(`${env.BASE_URL}${base(cc)}/${(exact ?? scored[0].k).slug}`, 302);
  const list = scored.length ? scored.map((x) => x.k) : skus;
  return page(env, T, { title: S.matches(q), description: S.matches(q), path: `${base(cc)}/search`, noindex: true,
    body: `<div class="answer"><h1>${e(scored.length ? S.matches(q) : S.noMatch(q))}</h1></div>${productGrid(T, list)}` });
}

/* ---------- restock-time pages ---------- */
async function restockPage(env, T, { title, h1, path, rows, back, label, extra = '' }) {
  const sum = d.summarize(rows);
  const lede = sum.count ? T.rp.lede(sum.count, T.f.hour(sum.peakHour), sum.peakDay != null ? T.f.day(sum.peakDay) : null, T.f.dur(sum.typical), T.f.dur(sum.shortest), T.f.dur(sum.longest)) : T.rp.none;
  const body = `<p class="crumbs"><a href="${back.path}">${e(back.name)}</a> › ${e(T.rp.crumb)}</p>
  <div class="answer"><h1>${e(h1)}</h1><p class="lede">${lede}</p></div>
  ${alertCta(env, T)}
  ${extra}
  <section><h2>${e(T.rp.byHour)}</h2>${hourChart(T, sum, label)}</section>
  <section><h2>${e(T.rp.every)}</h2>${latestTable(T, rows.slice(0, 60))}</section>
  ${await factsBlock(env, T)}`;
  // Thin-content rule (§7): indexable only with ≥ 20 restocks over > 18 h
  return page(env, T, { title, description: T.rp.desc(h1, sum.count), path, body, noindex: !sum.indexable, nav: 'restocks' });
}

export async function skuRestocks(env, cc, slug) {
  const T = t(cc); const k = await d.skuBySlug(env, slug); if (!k || !(await d.skuInCountry(env, k.id, cc))) return null;
  const h1 = T.rp.sku(k.name);
  return restockPage(env, T, { title: h1 + T.rp.titleSuffix, h1, path: `${base(cc)}/${k.slug}/restocks`, rows: await d.restocks(env, cc, 'r.sku_id = ?', [k.id]), back: { name: k.name, path: `${base(cc)}/${k.slug}` }, label: k.name });
}
export async function cityRestocks(env, cc, metroSlug) {
  const T = t(cc); const m = metroInCountry(cc, metroSlug); if (!m) return null;
  const [rows, stores] = await Promise.all([d.restocks(env, cc, 's.metro = ?', [m.id]), d.storesInMetro(env, m.id)]);
  const extra = `<section><h2>${e(T.rp.storesIn(m.name))}</h2>${stores.length ? `<ul class="rows">${stores.map((s) => `<li class="row${s.in_count ? ' is-in' : ''}"><span class="name"><a href="${base(cc)}/store/${e(s.slug)}">${e(placeLabel(T, s))}</a></span><span class="meta">${e(s.address ?? '')} · ${e(s.last_restock ? T.lastRestockAgo(T.f.ago(s.last_restock)) : T.noRestockYet)}</span><span class="side">${s.in_count ? `<span class="chip in">${e(T.nInStock(s.in_count))}</span>` : `<span class="chip out">${e(T.chip.out)}</span>`}</span></li>`).join('')}</ul>` : `<p class="empty">${e(T.rp.noStores)}</p>`}</section>`;
  const h1 = T.rp.city(m.name);
  return restockPage(env, T, { title: h1, h1, path: `${base(cc)}/restocks/${m.slug}`, rows, back: { name: T.rp.cities, path: `${base(cc)}/cities` }, label: m.name, extra });
}
export async function storeRestocks(env, cc, slug) {
  const T = t(cc); const s = await d.storeBySlug(env, slug); if (!s || s.country !== cc) return null;
  const h1 = T.rp.store(placeLabel(T, s));
  return restockPage(env, T, { title: h1, h1, path: `${base(cc)}/store/${s.slug}/restocks`, rows: await d.restocks(env, cc, 'r.store_id = ?', [s.id]), back: { name: placeLabel(T, s), path: `${base(cc)}/store/${s.slug}` }, label: placeLabel(T, s) });
}
export async function retailerPage(env, cc, id) {
  const T = t(cc); const src = SOURCES[id]; if (!src || src.country !== cc) return null;
  const h1 = T.rp.retailer(src.name);
  return restockPage(env, T, { title: h1 + T.rp.titleSuffix, h1, path: `${base(cc)}/retailer/${id}`, rows: await d.restocks(env, cc, 'r.source = ?', [id]), back: { name: T.rp.retailers, path: `${base(cc)}/retailers` }, label: src.name });
}
export async function allRestocks(env, cc) {
  const T = t(cc);
  return restockPage(env, T, { title: T.rp.all + T.rp.titleSuffix, h1: T.rp.all, path: `${base(cc)}/restocks`, rows: await d.restocks(env, cc), back: { name: T.nav.live, path: homePath(cc) }, label: T.rp.allRetailers });
}

/* ---------- store ---------- */
export async function store(env, cc, slug) {
  const T = t(cc); const s = await d.storeBySlug(env, slug); if (!s || s.country !== cc) return null;
  const [items, rs] = await Promise.all([d.storeStock(env, s.id), d.restocks(env, cc, 'r.store_id = ?', [s.id])]);
  const sum = d.summarize(rs);
  const inNow = items.filter((i) => i.in_stock);
  const label = placeLabel(T, s);
  const lede = (inNow.length ? T.store.has(e(label), inNow.length, inNow.slice(0, 3).map((i) => e(i.name)).join(', ')) : T.store.none(e(label))) + (sum.peakHour != null ? T.store.usual(T.f.hour(sum.peakHour)) : '');
  const m = metroById[s.metro];
  const c = crumbs(env, [{ name: T.nav.live, path: homePath(cc) }, ...(m ? [{ name: m.name, path: `${base(cc)}/restocks/${m.slug}` }] : []), { name: label, path: `${base(cc)}/store/${s.slug}` }]);
  const body = `${c.html}<div class="answer"><h1>${e(T.store.h1(label))}</h1><p class="lede">${lede}</p><p class="asof">${e([s.address, s.city, s.state, s.zip].filter(Boolean).join(', '))}</p></div>
  ${alertCta(env, T, { metro: m?.slug ?? '' })}
  <section><h2>${e(T.store.here)}</h2>${items.length ? `<ul class="rows">${items.map((i) => `<li class="row${i.in_stock ? ' is-in' : ''}"><span class="name"><a href="${base(cc)}/${e(i.slug)}">${e(i.name)}</a></span><span class="meta">${e(i.last_restock ? T.lastRestockAgo(T.f.ago(i.last_restock)) : T.noRestockYet)} · ${e(T.checkedAgo(T.f.ago(i.seen_at)))}</span><span class="side">${chip(T, i.in_stock, i.seen_at)}${i.qty > 1 ? `<span class="qty">${e(T.available(i.qty))}</span>` : ''}</span></li>`).join('')}</ul>` : `<p class="empty">${e(T.store.nothing)}</p>`}</section>
  <section><h2>${e(T.store.when)}</h2>${hourChart(T, sum, label)}<p><a href="${base(cc)}/store/${e(s.slug)}/restocks">${e(T.sku.history)}</a></p></section>
  ${await factsBlock(env, T)}`;
  return page(env, T, { title: T.store.title(label, s.city), description: T.store.desc(label, inNow.length), path: `${base(cc)}/store/${s.slug}`, body, jsonLd: [c.ld] });
}

/* ---------- indexes ---------- */
export async function cities(env, cc) {
  const T = t(cc);
  return page(env, T, { title: T.idx.citiesTitle, description: T.idx.citiesDesc(T.cc.metros.length, T.cc.name), path: `${base(cc)}/cities`, nav: 'cities',
    body: `<div class="answer"><h1>${e(T.idx.citiesH1)}</h1></div>${cityGrid(T, await d.metroTotals(env, cc), (m) => `${base(cc)}/restocks/${m.slug}`)}` });
}
export async function retailers(env, cc) {
  const T = t(cc); const srcs = sourcesOf(cc);
  const stores = T.f.list([...new Set(srcs.filter((s) => s.kind === 'stores').map((s) => s.name))]);
  const online = T.f.list([...new Set(srcs.filter((s) => s.kind !== 'stores').map((s) => s.name))]);
  return page(env, T, { title: T.idx.retTitle, description: T.idx.retDesc(shopsText(T, cc)), path: `${base(cc)}/retailers`, nav: 'retailers',
    body: `<div class="answer"><h1>${e(T.idx.retH1)}</h1><p class="lede">${e(T.idx.retLede(stores, online))}</p></div>${retailerGrid(T)}` });
}

export async function pricing(env, cc) {
  const T = t(cc);
  return page(env, T, { title: T.pricing.title(env.BRAND_NAME), description: T.pricing.lede, path: '/pricing', noindex: cc !== 'us',
    body: `<div class="answer"><h1>${e(T.pricing.h1)}</h1><p class="lede">${e(T.pricing.lede)}</p></div>
    <table><thead><tr><th>${e(T.th.plan)}</th><th>${e(T.th.watch)}</th><th>${e(T.th.days30)}</th></tr></thead><tbody>
    ${T.pricing.free && cc !== 'jp' ? `<tr><td>Free</td><td>${e(T.pricing.free)}</td><td>${e(T.f.money(0))}</td></tr>` : ''}
    <tr><td>Solo</td><td>${e(T.pricing.solo)}</td><td>${e(T.f.money(T.cc.prices.solo))}</td></tr>
    <tr><td>Multi</td><td>${e(T.pricing.multi)}</td><td>${e(T.f.money(T.cc.prices.multi))}</td></tr></tbody></table>
    <p class="sub">${e(T.pricing.tax)}</p>
    <p><a class="btn" href="/alerts?c=${cc}">${e(T.cta.btn)}</a></p>` });
}

/** Press kit from real restock data (§7), US numbers. */
export async function press(env) {
  const T = t('us');
  const rows = await d.restocks(env, 'us');
  const sum = d.summarize(rows);
  const bySource = sourcesOf('us').map((s) => ({ s, sum: d.summarize(rows.filter((r) => r.source === s.id)) })).filter((x) => x.sum.count);
  return page(env, T, { title: T.press.title(env.BRAND_NAME), description: T.press.h1, path: '/press',
    body: `<div class="answer"><h1>${e(T.press.h1)}</h1><p class="lede">${e(T.press.lede(sum.count, T.f.hour(sum.peakHour), T.f.dur(sum.typical), T.f.dur(sum.shortest)))}</p></div>
    <table><thead><tr><th>${e(T.th.retailer)}</th><th>${e(T.th.restocks)}</th><th>${e(T.th.usualHour)}</th><th>${e(T.th.typical)}</th></tr></thead><tbody>${bySource.map(({ s, sum: x }) => `<tr><td>${e(s.name)}</td><td>${x.count}</td><td>${e(T.f.hour(x.peakHour))}</td><td>${e(T.f.dur(x.typical))}</td></tr>`).join('')}</tbody></table>
    <p class="sub">${e(T.press.data)} <a href="mailto:${e(env.SUPPORT_EMAIL)}">${e(env.SUPPORT_EMAIL)}</a>.</p>` });
}

export const legal = (env, kind) => page(env, t('us'), { title: kind === 'terms' ? 'Terms' : 'Privacy', description: kind, path: `/${kind}`,
  body: kind === 'terms'
    ? `<div class="prose"><h1>Terms</h1><p>${e(env.BRAND_NAME)} sends stock and lottery alerts; it never buys products for you. Stock data comes from retailers' public availability and can be wrong or late: always confirm with the retailer. Alerts are sold for 30 days and renew unless cancelled; cancel in 2 clicks from your account. [Legal entity, address and governing law: to be completed by the founder.]</p></div>`
    : `<div class="prose"><h1>Privacy</h1><p>We store your email, the alerts you set, your notification channels and your payments. One cookie keeps you signed in. Visit measurement uses no cookie: a per-tab id lives in your browser's session storage and is deleted when you close the tab. We never sell data. Contact: ${e(env.SUPPORT_EMAIL)}. [Controller details: to be completed by the founder.]</p></div>` });

export function notFound(env, cc = 'us') {
  const T = t(cc);
  const r = page(env, T, { title: T.notFound.title, description: '', path: '/404', noindex: true, body: `<div class="answer"><h1>${e(T.notFound.h1)}</h1><p class="lede">${T.notFound.lede}</p></div>` });
  return new Response(r.body, { status: 404, headers: r.headers });
}
