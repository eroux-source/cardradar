// Page shell + shared components. One country per page (cc), its language via t(cc).
// Design: simple and literal — real product photos from the retailers, a clear
// "in stock / sold out" status, the price. No metaphors.
import { escapeHtml as e } from '../lib/util.js';
import { COUNTRIES, countryList } from '../data/countries.js';
import { sourcesOf, sourceName } from '../sources/index.js';

/** URL helpers. The US keeps "/" as home and "/us/…" for pages. */
export const home = (cc) => (cc === 'us' ? '/' : `/${cc}`);
export const base = (cc) => `/${cc}`;
export const placeLabel = (T, s) => (s.online ? `${sourceName(s.source)} ${T.online}` : `${sourceName(s.source)} ${s.name ?? s.store_name}`);
export const shopsText = (T, cc, max = 6) => {
  const names = [...new Set(sourcesOf(cc).map((s) => s.name))];
  return names.length > max + 1 ? T.f.list([...names.slice(0, max), T.nav.moreShops(names.length - max)]) : T.f.list(names);
};

const LOGO = '<svg viewBox="0 0 24 24" aria-hidden="true"><circle cx="12" cy="12" r="10" fill="none" stroke="currentColor" stroke-width="2.4"/><circle cx="12" cy="12" r="5.5" fill="none" stroke="currentColor" stroke-width="2.4"/><path d="M12 12 19 5" stroke="currentColor" stroke-width="2.6" stroke-linecap="round"/><circle cx="12" cy="12" r="2" fill="currentColor"/></svg>';

export function page(env, T, { title, description, path, body, jsonLd = [], noindex = false, nav = '', alternates = null, live = null }) {
  const cc = T.cc.code;
  const canonical = `${env.BASE_URL}${path}`;
  const cur = (k) => (k === nav ? ' aria-current="page"' : '');
  const b = base(cc);
  const alt = alternates ? Object.entries(alternates).map(([code, p]) => `<link rel="alternate" hreflang="${COUNTRIES[code].locale}" href="${env.BASE_URL}${p}">`).join('') + `<link rel="alternate" hreflang="x-default" href="${env.BASE_URL}/">` : '';
  const shops = [...new Set(sourcesOf(cc).map((s) => s.name))].join(', ');
  const countries = countryList.map((c) => `<a href="${home(c.code)}" hreflang="${c.locale}"${c.code === cc ? ' aria-current="true"' : ''}>${e(c.name)}${live && !live.has(c.code) ? ` <small>(${e(T.soon)})</small>` : ''}</a>`).join('');
  return new Response(`<!doctype html>
<html lang="${T.cc.locale}"><head>
<meta charset="utf-8"><meta name="viewport" content="width=device-width, initial-scale=1, viewport-fit=cover">
${env.GA_ID ? `<script async src="https://www.googletagmanager.com/gtag/js?id=${e(env.GA_ID)}"></script>
<script>window.dataLayer=window.dataLayer||[];function gtag(){dataLayer.push(arguments);}
gtag('consent','default',{ad_storage:'denied',ad_user_data:'denied',ad_personalization:'denied',analytics_storage:'granted'});
gtag('consent','default',{analytics_storage:'denied',region:['AT','BE','BG','HR','CY','CZ','DK','EE','FI','FR','DE','GR','HU','IE','IT','LV','LT','LU','MT','NL','PL','PT','RO','SK','SI','ES','SE','IS','LI','NO','GB','CH']});
gtag('js',new Date());gtag('config','${e(env.GA_ID)}',{country:'${cc}'});</script>
` : ''}<title>${e(title)}</title><meta name="description" content="${e(description)}">
<link rel="canonical" href="${e(canonical)}">${alt}${noindex ? '<meta name="robots" content="noindex,follow">' : ''}
<meta property="og:title" content="${e(title)}"><meta property="og:description" content="${e(description)}"><meta property="og:url" content="${e(canonical)}"><meta property="og:type" content="website"><meta property="og:locale" content="${T.cc.locale.replace('-', '_')}">
<meta name="theme-color" content="#ffffff"><link rel="manifest" href="/manifest.webmanifest"><link rel="icon" href="/icon.svg" type="image/svg+xml">
<link rel="preload" href="/fonts/bc-800.woff2" as="font" type="font/woff2" crossorigin>
<link rel="stylesheet" href="/site.css">
${jsonLd.map((j) => `<script type="application/ld+json">${JSON.stringify(j).replace(/</g, '\\u003c')}</script>`).join('')}
</head><body>
<header class="site-head"><div class="wrap">
  <a class="brand" href="${home(cc)}"><span class="brand-mark">${LOGO}</span><span class="brand-text"><span class="brand-word">${e(env.BRAND_NAME)}</span><span class="brand-tag">${e(T.tag)}</span></span></a>
  <nav class="site-nav" aria-label="Main">${cc === 'jp' ? `
    <a class="long" href="/jp"${cur('restocks')}>${e(T.nav.restocks)}</a>
    <a class="long" href="/jp#shops">${e(T.nav.retailers)}</a>` : `
    <a href="${b}/restocks"${cur('restocks')}><span class="long">${e(T.nav.restocks)}</span><span class="short">${e(T.nav.restocksShort)}</span></a>
    <a class="long" href="${b}/retailers"${cur('retailers')}>${e(T.nav.retailers)}</a>
    <a class="long" href="${b}/cities"${cur('cities')}>${e(T.nav.cities)}</a>`}
    <a class="acct" href="/account?c=${cc}"${cur('account')}>${e(T.nav.account)}</a>
    <a class="cta" href="/alerts?c=${cc}"${cur('alerts')}><span class="long">${e(T.nav.alerts)}</span><span class="short">${e(T.nav.alertsShort)}</span></a>
  </nav></div></header>
<main class="wrap">${body}</main>
<footer class="site-foot"><div class="wrap">
  <nav aria-label="Footer"><a href="${home(cc)}">${e(T.nav.live)}</a>${cc === 'jp' ? '' : `<a href="${b}/restocks">${e(T.nav.restocks)}</a><a href="${b}/retailers">${e(T.nav.retailers)}</a><a href="${b}/cities">${e(T.nav.cities)}</a>`}<a href="/pricing?c=${cc}">${e(T.nav.pricing)}</a><a href="/account?c=${cc}">${e(T.nav.account)}</a><a href="/press">${e(T.nav.press)}</a><a href="/best-pokemon-restock-trackers">Compare trackers</a><a href="/how-it-works">How it works</a><a href="/terms">${e(T.nav.terms)}</a><a href="/privacy">${e(T.nav.privacy)}</a><a href="mailto:${e(env.SUPPORT_EMAIL)}">${e(T.nav.contact)}</a></nav>
  <nav class="countries" aria-label="${e(T.nav.countries)}"><span>${e(T.countryPicker)}:</span> ${countries}</nav>
  <p>${e(T.disclaimer(env.BRAND_NAME, shops))}</p>
</div></footer>
<script src="/app.js" defer></script>
</body></html>`, { headers: { 'content-type': 'text/html; charset=utf-8', 'cache-control': 'public, max-age=30' } });
}

export function chip(T, inStock, seen) {
  if (inStock) return `<span class="chip in">${e(T.chip.in)}</span>`;
  if (seen) return `<span class="chip out">${e(T.chip.out)}</span>`;
  return `<span class="chip unknown">${e(T.chip.unknown)}</span>`;
}

export function crumbs(env, items) {
  return {
    html: `<p class="crumbs">${items.map((it, i) => (i < items.length - 1 ? `<a href="${it.path}">${e(it.name)}</a> › ` : e(it.name))).join('')}</p>`,
    ld: { '@context': 'https://schema.org', '@type': 'BreadcrumbList', itemListElement: items.map((it, i) => ({ '@type': 'ListItem', position: i + 1, name: it.name, item: `${env.BASE_URL}${it.path}` })) },
  };
}

/** "3 short answers per product" (§1) as visible FAQ + FAQPage data. */
export function answers(items, title = 'FAQ') {
  return {
    html: `<section class="faq" aria-labelledby="faq-h"><h2 id="faq-h">${e(title)}</h2>${items.map((f) => `<details open><summary>${e(f.q)}</summary><p>${e(f.a)}</p></details>`).join('')}</section>`,
    ld: { '@context': 'https://schema.org', '@type': 'FAQPage', mainEntity: items.map((f) => ({ '@type': 'Question', name: f.q, acceptedAnswer: { '@type': 'Answer', text: f.a } })) },
  };
}

export function hourChart(T, sum, label) {
  if (!sum.count) return `<p class="empty">${e(T.chartEmpty)}</p>`;
  const max = Math.max(...sum.hours, 1);
  return `<figure class="chart"><div class="bars">${sum.hours.map((n, h) => `<span style="height:${Math.max(2, Math.round((n / max) * 100))}%"${h === sum.peakHour ? ' class="peak"' : ''} title="${e(T.f.hour(h))}: ${n}"></span>`).join('')}</div>
  <div class="axis">${T.axis.map((a) => `<span>${e(a)}</span>`).join('')}</div>
  <figcaption>${e(T.chartCaption(label, sum.count, T.f.dur(sum.typical)))}</figcaption></figure>`;
}

export function placeRows(T, rows, { limit = 30 } = {}) {
  const cc = T.cc.code;
  if (!rows.length) return `<p class="empty">${e(T.nothingChecked)}</p>`;
  return `<ul class="rows">${rows.slice(0, limit).map((s) => `<li class="row${s.in_stock ? ' is-in' : ''}">
    <span class="name">${s.online ? `<a href="${e(s.url ?? '#')}" rel="nofollow noopener">${e(placeLabel(T, s))}</a>` : `<a href="${base(cc)}/store/${e(s.slug)}">${e(placeLabel(T, s))}</a>`}</span>
    <span class="meta">${s.online ? e(T.shipsNationwide) : `${e(s.city ?? '')}${s.state ? `, ${e(s.state)}` : ''}`} · ${e(s.last_restock ? T.lastRestockAgo(T.f.ago(s.last_restock)) : T.noRestockYet)} · ${e(T.checkedAgo(T.f.ago(s.seen_at)))}</span>
    <span class="side">${chip(T, s.in_stock, s.seen_at)}${s.qty > 1 ? `<span class="qty">${e(T.available(s.qty))}</span>` : ''}</span></li>`).join('')}</ul>${rows.length > limit ? `<p class="more">${e(T.morePlaces(rows.length - limit))}</p>` : ''}`;
}

export function latestTable(T, rows) {
  const cc = T.cc.code;
  if (!rows.length) return `<p class="empty">${e(T.noRestocks)}</p>`;
  return `<table><thead><tr><th>${e(T.th.product)}</th><th>${e(T.th.where)}</th><th>${e(T.th.when)}</th><th class="hide-sm">${e(T.th.lasted)}</th></tr></thead><tbody>${rows.map((r) => `<tr>
    <td><a href="${base(cc)}/${e(r.sku_slug)}">${e(r.sku_name)}</a></td>
    <td>${r.online ? e(placeLabel(T, r)) : `<a href="${base(cc)}/store/${e(r.store_slug)}">${e(placeLabel(T, r))}</a>, ${e(r.city ?? '')}`}</td>
    <td>${e(T.f.ago(r.started_at))}</td><td class="hide-sm">${e(r.ended_at ? T.f.dur(r.ended_at - r.started_at) : T.stillInStock)}</td></tr>`).join('')}</tbody></table>`;
}

export function cityGrid(T, totals, href) {
  const by = Object.fromEntries(totals.map((x) => [x.metro, x]));
  return `<ul class="cities">${T.cc.metros.map((m) => `<li><a href="${href(m)}"><strong>${e(m.name)}</strong><span>${e(by[m.id] ? T.storesInStock(by[m.id].in_stock, by[m.id].stores) : T.notChecked)}</span></a></li>`).join('')}</ul>`;
}

export function retailerGrid(T) {
  const cc = T.cc.code;
  return `<ul class="cities">${sourcesOf(cc).filter((s) => s.listed !== false).map((s) => `<li><a href="${base(cc)}/retailer/${s.id}"><strong>${e(s.name)}</strong><span>${e(s.kind === 'online' ? T.onlineStock : T.storeByStore)}</span></a></li>`).join('')}</ul>`;
}

/** Product grid: the retailer's own photo, the name, a plain status, the price. */
export function productGrid(T, skus) {
  const cc = T.cc.code;
  if (!skus.length) return `<p class="empty">${e(T.home.emptyProducts)}</p>`;
  return `<ul class="products">${skus.map((k) => {
    const online = k.online_in ? k.online_in.split(',').map(sourceName) : [];
    const status = k.stores_in
      ? `<span class="chip in">${e(T.nInStock(k.stores_in))}</span><span class="where">${e(T.card.storesFrac(k.stores_in, k.stores))}</span>`
      : online.length ? `<span class="chip in">${e(T.chip.in)}</span><span class="where">${e(`${T.card.online}: ${online.join(', ')}`)}</span>`
        : k.stores || k.last_restock ? `<span class="chip out">${e(T.chip.out)}</span>` : `<span class="chip unknown">${e(T.chip.unknown)}</span>`;
    return `<li><a class="product" href="${base(cc)}/${e(k.slug)}">
      <span class="ph">${k.image ? `<img src="${e(k.image)}" alt="" loading="lazy" decoding="async" referrerpolicy="no-referrer">` : '<span class="ph-empty" aria-hidden="true"></span>'}</span>
      <span class="pname">${e(k.name)}</span>
      <span class="pstatus">${status}</span>
      <span class="pmeta">${k.min_price ? `<strong>${e(T.f.money(k.min_price))}</strong>` : ''}${k.last_restock ? ` · ${e(T.lastRestockAgo(T.f.ago(k.last_restock)))}` : ''}</span>
    </a></li>`;
  }).join('')}</ul>`;
}

/** The call to action: opens the stepped alert form with the product pre-selected. */
export function alertCta(env, T, { sku = null, metro = '' } = {}) {
  const cc = T.cc.code;
  const href = `/alerts?${new URLSearchParams({ c: cc, ...(sku ? { sku: sku.slug } : {}), ...(metro ? { metro } : {}) })}`;
  return `<section class="alert-box" aria-labelledby="cta-h" id="alerts">
    <div class="bell" aria-hidden="true"><svg viewBox="0 0 48 48"><path d="M24 6c-7 0-12 5.5-12 13v8l-4 6h32l-4-6v-8c0-7.5-5-13-12-13z"/><circle cx="24" cy="39" r="4.5"/></svg></div>
    <div><h2 id="cta-h">${e(T.cta.h2(sku?.name))}</h2>
      <p>${T.cta.effect.replace(/<strong>[^<]*<\/strong>\s*/, '').replace(/^\p{Ll}/u, (c) => c.toUpperCase())}</p>
      <p><a class="btn" href="${href}" data-ev="sheet_open">${e(T.cta.btn)}</a></p>
      <p class="fine">${e(T.cta.fine(T.f.money(T.cc.prices.solo)))}</p></div></section>`;
}
