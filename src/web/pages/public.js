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

const asOf = (T, ts) => (ts ? T.asOf(T.f.when(ts)) : T.waiting);

/** hreflang alternates for the country homes that are live. */
const homeAlternates = (live) => Object.fromEntries(countryList.filter((c) => live.has(c.code)).map((c) => [c.code, homePath(c.code)]));

/* ---------- home ---------- */
export async function home(env, cc) {
  const T = t(cc);
  const live = await d.liveCountries(env);
  const [c, skus, latest, all30] = await Promise.all([d.counts(env, cc), d.allSkus(env, cc), d.restocks(env, cc, '1=1', [], 30, 10), d.restocks(env, cc)]);
  const sum = d.summarize(all30);
  const last = latest[0];
  const shops = shopsText(T, cc);
  const hasData = live.has(cc);
  const lede = !hasData ? T.home.soon(T.cc.name)
    : c.stores ? T.home.lede(c.stores_in, c.stores) + (last ? T.home.latest(e(last.sku_name), e(placeLabel(T, last)), T.f.ago(last.started_at)) : '') + (sum.typical ? T.home.typical(T.f.dur(sum.typical)) : '')
      : T.home.fallback(shops);
  const head = `<div class="answer"><h1>${e(T.home.h1)}</h1><p class="lede">${lede}</p><p class="asof">${e(asOf(T, c.last_check))}</p></div>`;
  const I = T.intro;
  const hasStores = sourcesOf(cc).some((x) => x.kind === 'stores');
  const faq = answers(I.faq(shops, T.f.money(T.cc.prices.solo)), I.faqH);
  // Layout for a first-time visitor: what this is → how it works → the products → the rest.
  const body = !hasData ? `${head}${await factsBlock(env, T)}` : `
  <section class="intro">
    <h1>${e(I.h1)}</h1>
    <p class="lede">${e(I.what(shops))}</p>
    <p class="intro-cta"><a class="btn" href="#products">${e(I.seeStock)}</a> <a class="btn ghost" href="/alerts?c=${cc}" data-ev="sheet_open">${e(I.freeAlert)}</a></p>
    ${c.stores ? `<p class="now"><span class="dot" aria-hidden="true"></span>${I.now(c.stores_in, c.stores, e(T.f.ago(c.last_check)))}</p>` : ''}
  </section>
  <section class="how" aria-labelledby="how-h"><h2 id="how-h">${e(I.howH)}</h2><ol>${I.steps.map((x) => `<li>${e(x)}</li>`).join('')}</ol></section>
  <section id="products" aria-labelledby="p-h"><h2 id="p-h">${e(I.productsH)}</h2><p class="sub">${e(I.productsSub)}</p>${productGrid(T, skus)}</section>
  ${latest.length ? `<section aria-labelledby="l-h"><h2 id="l-h">${e(I.latestH)}</h2>${latestTable(T, latest.slice(0, 5))}<p><a href="${base(cc)}/restocks">${e(I.allTimes)}</a></p></section>` : ''}
  ${alertCta(env, T)}
  <section aria-labelledby="r-h"><h2 id="r-h">${e(I.placesH)}</h2>${retailerGrid(T)}
    ${hasStores ? `<details class="city-pick"><summary>${e(T.sku.allCities(T.cc.metros.length))}</summary>${cityGrid(T, await d.metroTotals(env, cc), (m) => `${base(cc)}/restocks/${m.slug}`)}</details>` : ''}</section>
  ${faq.html}
  ${await factsBlock(env, T)}`;
  return page(env, T, { title: T.home.title(env.BRAND_NAME), description: T.home.desc(shops), path: homePath(cc), body, noindex: !hasData, alternates: homeAlternates(live), live,
    jsonLd: [...(hasData ? [faq.ld] : []), { '@context': 'https://schema.org', '@type': 'WebSite', name: env.BRAND_NAME, url: `${env.BASE_URL}${homePath(cc)}`, inLanguage: T.cc.locale },
      { '@context': 'https://schema.org', '@type': 'Organization', name: env.BRAND_NAME, url: env.BASE_URL, logo: `${env.BASE_URL}/icon.svg`, email: env.SUPPORT_EMAIL },
      { '@context': 'https://schema.org', '@type': 'WebApplication', name: env.BRAND_NAME, url: `${env.BASE_URL}${homePath(cc)}`, applicationCategory: 'ShoppingApplication', operatingSystem: 'Any (web browser)',
        description: T.home.desc(shops), inLanguage: T.cc.locale,
        offers: [{ '@type': 'Offer', name: 'Live stock pages', price: '0', priceCurrency: T.cc.currency },
          { '@type': 'Offer', name: 'Solo alerts, 30 days', price: T.cc.prices.solo, priceCurrency: T.cc.currency },
          { '@type': 'Offer', name: 'Multi alerts, 30 days', price: T.cc.prices.multi, priceCurrency: T.cc.currency }] }] });
}

/* ---------- product ---------- */
export async function sku(env, cc, slug, metroSlug = null) {
  const T = t(cc);
  const k = await d.skuBySlug(env, slug);
  const metro = metroSlug ? metroInCountry(cc, metroSlug) : null;
  if (!k || (metroSlug && !metro) || !(await d.skuInCountry(env, k.id, cc))) return null;
  const [rows, rs, listings] = await Promise.all([
    d.availability(env, cc, k.id, metro?.id),
    d.restocks(env, cc, metro ? 'r.sku_id = ? AND (s.online = 1 OR s.metro = ?)' : 'r.sku_id = ?', metro ? [k.id, metro.id] : [k.id]),
    d.listingsOf(env, k.id, cc),
  ]);
  const sum = d.summarize(rs);
  const phys = rows.filter((r) => !r.online); const inStores = phys.filter((r) => r.in_stock); const online = rows.filter((r) => r.online && r.in_stock);
  const place = metro ? metro.name : T.cc.name;
  const lastCheck = rows.reduce((m, r) => Math.max(m, r.seen_at ?? 0), 0);
  const minPrice = Math.min(...listings.map((l) => l.price || Infinity));
  const onlineList = T.f.list(online.map((o) => sourceName(o.source)));

  const parts = [];
  if (phys.length) parts.push(inStores.length ? T.sku.inStores(inStores.length, phys.length, e(place), e(placeLabel(T, inStores[0])), e(inStores[0].city ?? '')) : T.sku.outStores(phys.length, e(place)));
  parts.push(online.length ? T.sku.onlineAt(e(onlineList)) : T.sku.outOnline);
  let lede = rows.length ? T.sku.is(e(k.name), parts.join(T.sku.joinParts)) : T.sku.new(e(k.name));
  if (rs[0]) lede += T.sku.lastLine(e(placeLabel(T, rs[0])), T.f.ago(rs[0].started_at), rs[0].ended_at ? T.f.dur(rs[0].ended_at - rs[0].started_at) : null);

  const path = metro ? `${base(cc)}/${k.slug}/${metro.slug}` : `${base(cc)}/${k.slug}`;
  const c = crumbs(env, [{ name: T.sku.crumbLive, path: homePath(cc) }, ...(metro ? [{ name: k.name, path: `${base(cc)}/${k.slug}` }, { name: metro.name, path }] : [{ name: k.name, path }])]);
  const a = answers([
    { q: T.sku.q1(k.name), a: inStores.length || online.length ? T.sku.a1yes([...online.map((o) => placeLabel(T, o)), ...inStores.slice(0, 3).map((s) => `${placeLabel(T, s)} (${s.city ?? ''})`)].join(', ')) : T.sku.a1no(place) },
    { q: T.sku.q2(k.name), a: sum.count ? T.sku.a2yes(sum.count, metro?.name, T.f.hour(sum.peakHour), sum.peakDay != null ? T.f.day(sum.peakDay) : null) : T.sku.a2no },
    { q: T.sku.q3(k.name), a: sum.typical ? T.sku.a3yes(T.f.dur(sum.typical), T.f.dur(sum.shortest)) : T.sku.a3no },
  ], 'FAQ');

  const byRetailer = sourcesOf(cc).map((s) => {
    const mine = rows.filter((r) => r.source === s.id); if (!mine.length) return '';
    const n = mine.filter((r) => r.in_stock).length;
    return `<tr><td><a href="${base(cc)}/retailer/${s.id}">${e(s.name)}</a></td><td>${s.kind !== 'stores' ? (n ? `<strong>${e(T.sku.inOnline)}</strong>` : e(T.sku.outOnlineCell)) : `${n ? '<strong>' : ''}${e(T.sku.ofStores(n, mine.length))}${n ? '</strong>' : ''}`}</td></tr>`;
  }).join('');
  const buy = listings.filter((l) => l.url).slice(0, 6).map((l) => `<a class="btn ghost small" href="${e(l.url)}" rel="nofollow noopener sponsored">${e(sourceName(l.source))}${l.price ? ` · ${e(T.f.money(l.price))}` : ''}</a>`).join(' ');

  const body = `${c.html}
  <div class="hero"><div class="answer"><h1>${e(T.sku.h1(k.name, metro?.name))}</h1><p class="lede">${lede}</p>
  <p class="asof">${e(asOf(T, lastCheck))}${Number.isFinite(minPrice) ? e(T.sku.from(T.f.money(minPrice))) : ''}</p>${buy ? `<p class="buy">${buy}</p>` : ''}</div>
  ${k.image ? `<figure class="hero-photo"><img src="${e(k.image)}" alt="${e(k.name)}" referrerpolicy="no-referrer"></figure>` : ''}</div>
  ${alertCta(env, T, { sku: k, metro: metro?.slug ?? '' })}
  ${byRetailer ? `<section aria-labelledby="b-h"><h2 id="b-h">${e(T.home.byRetailer)}</h2><table><thead><tr><th>${e(T.th.retailer)}</th><th>${e(T.th.rightNow)}</th></tr></thead><tbody>${byRetailer}</tbody></table></section>` : ''}
  <section aria-labelledby="w-h"><h2 id="w-h">${e(T.sku.whereIs(metro?.name))}</h2>${placeRows(T, rows, { limit: metro ? 150 : 30 })}</section>
  <section aria-labelledby="h-h"><h2 id="h-h">${e(T.sku.when)}</h2>${hourChart(T, sum, k.name)}<p><a href="${base(cc)}/${e(k.slug)}/restocks">${e(T.sku.history)}</a></p></section>
  ${a.html}
  ${metro ? '' : `<section aria-labelledby="c-h"><h2 id="c-h">${e(T.sku.byCity(k.name))}</h2><details><summary>${e(T.sku.allCities(T.cc.metros.length))}</summary>${cityGrid(T, await d.metroTotals(env, cc, k.id), (m) => `${base(cc)}/${k.slug}/${m.slug}`)}</details></section>`}
  ${await factsBlock(env, T)}`;
  const productLd = { '@context': 'https://schema.org', '@type': 'Product', name: k.name, ...(k.image ? { image: k.image } : {}),
    ...(Number.isFinite(minPrice) ? { offers: { '@type': 'AggregateOffer', priceCurrency: T.cc.currency, lowPrice: minPrice, offerCount: listings.length, availability: inStores.length || online.length ? 'https://schema.org/InStock' : 'https://schema.org/OutOfStock' } } : {}) };
  return page(env, T, { title: T.sku.title(k.name, metro?.name), description: T.sku.desc(k.name, inStores.length, phys.length, place, online.length ? onlineList : null), path, body, jsonLd: [c.ld, a.ld, productLd], noindex: !rows.length && !rs.length });
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
