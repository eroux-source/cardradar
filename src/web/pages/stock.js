// The stock view, laid out like InStock Radar (it works): one product at a time.
//   hero: crumbs, H1, what we check, the answer line ("As of …: X is in stock at N of M places")
//   sticky controls: product pills (with photo), city picker, live dot
//   two columns: left = 30-day stats + alert card; right = one card per place, in stock first
//   below: how to get it today, when it restocks, latest restocks, other products, good to know
// Used by the country home (hardest product to find) and every product page.
import { escapeHtml as e } from '../../lib/util.js';
import { sourceName, sourcesOf } from '../../sources/index.js';
import * as d from '../data.js';
import { page, home as homePath, base, crumbs, answers, hourChart, latestTable, shopsText, productGrid, placeLabel } from '../html.js';
import { factsBlock } from '../facts.js';

const maps = (s) => `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent([sourceName(s.source), s.address, s.city, s.state, s.zip].filter(Boolean).join(' '))}`;

function placeCard(T, cc, s, alertHref) {
  const S = T.sv;
  const name = s.online ? `${sourceName(s.source)}` : (s.name ?? s.store_name);
  const sub = s.online ? `${S.online} · ${S.ships}` : [sourceName(s.source), s.city].filter(Boolean).join(' · ');
  const chip = s.in_stock ? `<span class="tag in">✓ ${e(T.chip.in)}</span>` : s.seen_at ? `<span class="tag out">${e(T.chip.out)}</span>` : `<span class="tag wait">${e(S.checking)}</span>`;
  const meta = s.in_stock
    ? `${s.in_since ? `${e(S.since(T.f.ago(s.in_since)))} · ` : ''}${s.qty > 1 ? `${e(T.available(s.qty))} · ` : ''}${e(T.checkedAgo(T.f.ago(s.seen_at)))}`
    : s.seen_at ? `${e(s.last_restock ? T.lastRestockAgo(T.f.ago(s.last_restock)) : T.noRestockYet)} · ${e(T.checkedAgo(T.f.ago(s.seen_at)))}` : '';
  const go = s.url ? `<a class="btn ${s.in_stock ? 'go' : 'dark'} small" href="${e(s.url)}" rel="nofollow noopener sponsored" target="_blank">${e(s.online ? S.buy : S.reserve)} ↗</a>` : '';
  const dir = !s.online && s.address ? `<a class="btn dark small" href="${e(maps(s))}" rel="noopener" target="_blank">${e(S.directions)}</a>` : '';
  const alert = !s.in_stock ? `<a class="btn go small" href="${e(alertHref)}" data-ev="sheet_open">🔔 ${e(S.alertBtn)}</a>` : `<a class="btn dark small" href="${e(alertHref)}" data-ev="sheet_open">🔔 ${e(S.alertBtn)}</a>`;
  const title = s.online ? e(name) : `<a href="${base(cc)}/store/${e(s.slug)}">${e(name)}</a>`;
  return `<li class="place${s.in_stock ? ' in' : ''}"><div class="place-head"><div><strong>${title}</strong><span>${e(sub)}</span></div>${chip}</div>
    ${meta ? `<p class="place-meta">${meta}</p>` : ''}<div class="place-actions">${s.in_stock ? go + dir + alert : alert + go + dir}</div></li>`;
}

export async function stockPage(env, T, cc, k, { metro = null, isHome = false, live = null, alternates = null, extraLd = [] } = {}) {
  const S = T.sv;
  const [rows, rs, listings, skus, latest] = await Promise.all([
    d.availability(env, cc, k.id, metro?.id),
    d.restocks(env, cc, metro ? 'r.sku_id = ? AND (s.online = 1 OR s.metro = ?)' : 'r.sku_id = ?', metro ? [k.id, metro.id] : [k.id]),
    d.listingsOf(env, k.id, cc),
    d.allSkus(env, cc),
    d.restocks(env, cc, '1=1', [], 30, 8),
  ]);
  const sum = d.summarize(rs);
  // Places not read yet still show, so the page says what we watch (online listings without a reading)
  const seen = new Set(rows.filter((r) => r.online).map((r) => r.source));
  const pending = listings.filter((l) => !seen.has(l.source) && (sourcesOf(cc).find((s) => s.id === l.source)?.kind ?? 'online') !== 'stores')
    .map((l) => ({ source: l.source, online: 1, url: l.url, in_stock: 0, seen_at: null }));
  const places = [...rows, ...pending];
  const inNow = rows.filter((r) => r.in_stock);
  const hasStores = sourcesOf(cc).some((s) => s.kind === 'stores');
  const shops = shopsText(T, cc);
  const lastCheck = rows.reduce((m, r) => Math.max(m, r.seen_at ?? 0), 0);
  const alertHref = `/alerts?${new URLSearchParams({ c: cc, sku: k.slug, ...(metro ? { metro: metro.slug } : {}) })}`;
  const path = isHome ? homePath(cc) : metro ? `${base(cc)}/${k.slug}/${metro.slug}` : `${base(cc)}/${k.slug}`;

  // answer line
  const where = inNow.slice(0, 4).map((r) => (r.online ? sourceName(r.source) : r.city ?? r.name)).filter((v, i, a) => a.indexOf(v) === i);
  const last = rs[0] ? `${T.f.ago(rs[0].started_at)} · ${placeLabel(T, rs[0])}` : null;
  const answer = rows.length ? S.asOf(T.f.when(lastCheck), k.name, inNow.length, rows.length, T.f.list(where), last, sum.typical ? T.f.dur(sum.typical) : null) : S.asOfNone(k.name);

  // most restocks place
  const byPlace = {}; for (const r of rs) { const n = placeLabel(T, r); byPlace[n] = (byPlace[n] ?? 0) + 1; }
  const top = Object.entries(byPlace).sort((a, b) => b[1] - a[1])[0];
  const placesRestocked = new Set(rs.map((r) => r.store_id)).size;

  const c = crumbs(env, [{ name: T.nav.live, path: homePath(cc) }, ...(isHome ? [{ name: T.cc.name, path }] : [{ name: k.name, path: `${base(cc)}/${k.slug}` }, ...(metro ? [{ name: metro.name, path }] : [])])]);
  const pills = skus.slice(0, 10).map((x) => `<a class="pill${x.id === k.id ? ' on' : ''}" href="${base(cc)}/${e(x.slug)}${metro ? `/${e(metro.slug)}` : ''}"${x.id === k.id ? ' aria-current="page"' : ''}>${x.image ? `<img src="${e(x.image)}" alt="" loading="lazy" referrerpolicy="no-referrer">` : ''}${e(x.name)}</a>`).join('');
  const citySel = hasStores ? `<label class="ctl-label" for="city-pick">${e(S.city)}</label><select id="city-pick" data-nav>
      <option value="${base(cc)}/${e(k.slug)}">${e(S.allCities)}</option>${T.cc.metros.map((m) => `<option value="${base(cc)}/${e(k.slug)}/${e(m.slug)}"${metro?.id === m.id ? ' selected' : ''}>${e(m.name)}</option>`).join('')}</select>` : '';

  const faq = answers([
    { q: T.sku.q1(k.name), a: inNow.length ? T.sku.a1yes(inNow.slice(0, 4).map((s) => placeLabel(T, s)).join(', ')) : T.sku.a1no(metro?.name ?? T.cc.name) },
    { q: T.sku.q2(k.name), a: sum.count ? T.sku.a2yes(sum.count, metro?.name, T.f.hour(sum.peakHour), sum.peakDay != null ? T.f.day(sum.peakDay) : null) : T.sku.a2no },
    { q: T.sku.q3(k.name), a: sum.typical ? T.sku.a3yes(T.f.dur(sum.typical), T.f.dur(sum.shortest)) : T.sku.a3no },
  ], S.goodH);

  const body = `<section class="hero2">${c.html}
    <div class="hero2-grid"><div>
      <h1>${e(isHome ? (hasStores ? S.homeH1(T.cc.name) : S.homeH1Online(T.cc.name)) : S.skuH1(k.name, metro?.name))}</h1>
      <p class="lede">${e(S.lede(shops))}</p>
      <p class="answer-line">${e(answer)}</p></div>
      ${k.image ? `<figure class="hero2-photo"><img src="${e(k.image)}" alt="${e(k.name)}" referrerpolicy="no-referrer"></figure>` : ''}</div></section>
  <section class="controls" aria-label="${e(S.products)}">
    <form class="find" action="${base(cc)}/search" method="get" role="search">
      <input name="q" list="sku-list" autocomplete="off" placeholder="${e(S.findPh)}" aria-label="${e(S.findPh)}" data-find>
      <datalist id="sku-list">${skus.map((x) => `<option value="${e(x.name)}" data-href="${base(cc)}/${e(x.slug)}"></option>`).join('')}</datalist>
      <button class="btn small" type="submit">${e(S.findBtn)}</button></form>
    <div class="pills">${pills}</div>
    <div class="ctl-row"><span class="live"><span class="dot" aria-hidden="true"></span>${e(S.live)}</span>${citySel}<span class="fine">${e(S.sorted)}</span></div>
  </section>
  <div class="layout">
    <aside class="side">
      <div class="side-card"><h2>${e(S.statsH(k.name))}</h2><dl class="stats">
        <div><dt>${e(S.stats.seen)}</dt><dd>${sum.count}</dd></div>
        <div><dt>${e(S.stats.places)}</dt><dd>${placesRestocked}</dd></div>
        <div><dt>${e(S.stats.typical)}</dt><dd>${e(sum.typical ? T.f.dur(sum.typical) : '—')}</dd></div>
        <div><dt>${e(S.stats.hour)}</dt><dd>${e(sum.peakHour != null ? T.f.hour(sum.peakHour) : '—')}</dd></div>
        <div><dt>${e(S.stats.most)}</dt><dd>${e(top ? top[0] : '—')}</dd></div>
        <div><dt>${e(S.stats.last)}</dt><dd>${e(rs[0] ? T.f.ago(rs[0].started_at) : '—')}</dd></div></dl>
        <p class="fine">${e(S.statsNote)}</p><p><a href="${base(cc)}/${e(k.slug)}/restocks">${e(S.whenLink(k.name))} →</a></p></div>
      <div class="side-card alert-card" id="alerts"><h2>${e(S.alertH)}</h2><p>${e(S.alertP(T.f.money(T.cc.prices.solo), sum.typical ? T.f.dur(sum.typical) : null))}</p>
        <a class="btn go" href="${e(alertHref)}" data-ev="sheet_open">🔔 ${e(S.alertBtn)}</a></div>
    </aside>
    <section class="main" aria-labelledby="now-h">
      <h2 id="now-h">${e(S.nowH(inNow.length))}</h2>
      ${places.length ? `<p class="sub">${e(S.nowSub(places.length))}</p><ul class="places">${places.slice(0, metro ? 200 : 60).map((s) => placeCard(T, cc, s, alertHref)).join('')}</ul>` : `<p class="empty">${e(S.asOfNone(k.name))}</p>`}
    </section>
  </div>
  <section class="content"><h2>${e(S.howH(k.name))}</h2><ol class="steps-list">${S.how(k.name).map((x) => `<li>${e(x)}</li>`).join('')}</ol></section>
  <section class="content"><h2>${e(T.sku.when)}</h2>${hourChart(T, sum, k.name)}</section>
  ${latest.length ? `<section class="content"><h2>${e(S.latestH)}</h2>${latestTable(T, latest)}</section>` : ''}
  <section class="content"><h2>${e(S.otherH)}</h2>${productGrid(T, skus.filter((x) => x.id !== k.id).slice(0, 12))}</section>
  ${faq.html}
  ${await factsBlock(env, T)}`;

  const minPrice = Math.min(...listings.map((l) => l.price || Infinity));
  const productLd = { '@context': 'https://schema.org', '@type': 'Product', name: k.name, ...(k.image ? { image: k.image } : {}),
    ...(Number.isFinite(minPrice) ? { offers: { '@type': 'AggregateOffer', priceCurrency: T.cc.currency, lowPrice: minPrice, offerCount: listings.length, availability: inNow.length ? 'https://schema.org/InStock' : 'https://schema.org/OutOfStock' } } : {}) };
  const title = isHome ? T.home.title(env.BRAND_NAME) : T.sku.title(k.name, metro?.name);
  const description = isHome ? T.home.desc(shops) : T.sku.desc(k.name, inNow.filter((r) => !r.online).length, rows.filter((r) => !r.online).length, metro?.name ?? T.cc.name, inNow.some((r) => r.online) ? T.f.list([...new Set(inNow.filter((r) => r.online).map((r) => sourceName(r.source)))]) : null);
  return page(env, T, { title, description, path, body, live, alternates, jsonLd: [c.ld, faq.ld, productLd, ...extraLd], noindex: !isHome && !rows.length && !rs.length });
}
