// Public, indexable pages (§1, §7):
//   /                       live overview
//   /us/{sku}               product: live stock everywhere + answer line + facts + 3 answers
//   /us/{sku}/{city}        product × city
//   /us/{sku}/restocks      when it restocks (indexable only with real history)
//   /us/store/{slug}        what is in stock in this store now + usual hour
//   /us/store/{slug}/restocks
//   /us/restocks/{city}     restock times in a city
//   /us/retailer/{id}       when a retailer restocks
import { escapeHtml as e, timeAgo, formatDuration, formatUtc, hourLabel } from '../../lib/util.js';
import { typeLabel } from '../../lib/catalog.js';
import { metros, metroBySlug } from '../../data/metros.js';
import { SOURCES, sourceList, sourceName } from '../../sources/index.js';
import * as d from '../data.js';
import { tcgCard, page, chip, crumbs, answers, hourChart, placeRows, latestTable, cityGrid, retailerGrid, alertCta, placeLabel, listJoin, DAYS } from '../html.js';
import { factsBlock } from '../facts.js';

const asOf = (ts) => (ts ? `Last check ${formatUtc(ts)}.` : 'Waiting for the first check.');

const ART = { etb: 'art-tiles', booster_box: 'art-leaf', booster_bundle: 'art-sky', tin: 'art-sun' };
const rarityOf = (k, pct) => (pct === 0 && !k.online_in ? ['★', 'Rare: in no store right now'] : pct < 20 ? ['◆', 'Uncommon: in few stores'] : ['●', 'Common: in many stores']);

/** Every product is a card: big number = stores with stock now, moves = what you need to know. */
function skuList(skus, suffix = '') {
  if (!skus.length) return '<p class="empty">Products appear after the first discovery run.</p>';
  return `<ul class="card-grid">${skus.map((k, i) => {
    const pct = k.stores ? Math.round((100 * k.stores_in) / k.stores) : 0;
    const [glyph, label] = rarityOf(k, pct);
    return `<li style="--i:${i}">${tcgCard({
      stage: typeLabel(k.type), name: k.name.replace(` ${typeLabel(k.type)}`, ''), num: k.stores_in, numLabel: 'stores',
      art: ART[k.type] ?? 'art-tiles', href: `/us/${e(k.slug)}${suffix}`,
      moves: [
        { cost: 1, label: 'Online', value: k.online_in ? k.online_in.split(',').map(sourceName).join(', ') : 'Sold out' },
        { cost: 2, label: 'Last restock', value: k.last_restock ? timeAgo(k.last_restock) : '—' },
      ],
      footer: `<span class="rar" title="${label}">${glyph}<span class="vh"> ${label}</span></span><span>${k.stores_in}/${k.stores} stores</span><span>${k.min_price ? `$${Number(k.min_price).toFixed(2)}` : ''}</span>`,
    })}</li>`;
  }).join('')}</ul>`;
}

/* ---------- radar HUD: one slot per retailer, filled by the share of places with stock now ---------- */
function hud(tally) {
  const by = Object.fromEntries(tally.map((t) => [t.source, t]));
  return `<section class="hud" aria-labelledby="hud-h"><h2 id="hud-h" class="vh">Live radar by retailer</h2><ul class="slots">${sourceList.map((s, i) => {
    const t = by[s.id]; const n = t?.in_stock ?? 0; const pct = t?.checked ? Math.round((100 * n) / t.checked) : 0;
    return `<li class="slot${n ? ' on' : ''}" style="--fill:${Math.max(pct, n ? 12 : 0)}%;--i:${i}"><a href="/us/retailer/${s.id}">
      <span class="slot-bar" aria-hidden="true"><i></i></span><span class="slot-orb" aria-hidden="true">${e(s.name[0])}</span>
      <strong>${e(s.name)}</strong><span>${t ? (n ? `${n} in stock` : 'all sold out') : 'warming up'}</span></a></li>`;
  }).join('')}</ul></section>`;
}

/* ---------- home ---------- */
export async function home(env) {
  const [c, skus, latest, all30, tally] = await Promise.all([d.counts(env), d.allSkus(env), d.restocks(env, '1=1', [], 30, 10), d.restocks(env), d.sourceTotals(env)]);
  const sum = d.summarize(all30);
  const last = latest[0];
  const lede = c.stores
    ? `Right now <strong>${c.stores_in} of ${c.stores} stores</strong> we track have Pokémon cards on the shelf.${last ? ` Latest restock: <strong>${e(last.sku_name)}</strong> at ${e(placeLabel(last))}, ${timeAgo(last.started_at)}.` : ''}${sum.typical ? ` A restock typically lasts <strong>${formatDuration(sum.typical)}</strong>.` : ''}`
    : 'Live Pokémon TCG stock at Target, Best Buy, GameStop, Costco and Pokémon Center, with restock times and instant alerts.';
  const hero = tcgCard({ stage: 'Live', name: 'Restock Tracker', num: c.stores_in ?? 0, numLabel: 'in stock', art: 'art-tiles', cls: 'hero-card',
    moves: [
      { cost: 1, label: 'Latest restock', value: last ? `${timeAgo(last.started_at)}` : '—' },
      { cost: 2, label: 'Typical stay', value: sum.typical ? formatDuration(sum.typical) : '—' },
      { cost: 3, label: 'Stores tracked', value: String(c.stores ?? 0) },
    ],
    footer: `<span>${sourceList.length} retailers</span><span>${c.skus ?? 0} products</span><span>#001</span>` });
  const body = `<div class="hero"><div class="answer"><h1>Pokémon cards in stock near you, live</h1><p class="lede">${lede}</p><p class="asof">${asOf(c.last_check)}</p></div>${hero}</div>
  ${hud(tally)}
  ${alertCta(env)}
  <section aria-labelledby="p-h"><h2 id="p-h">Every sealed product we track</h2><p class="sub">Hardest to find first.</p>${skuList(skus)}</section>
  <section aria-labelledby="l-h"><h2 id="l-h">Latest restocks</h2>${latestTable(latest)}</section>
  <section aria-labelledby="r-h"><h2 id="r-h">By retailer</h2>${retailerGrid()}</section>
  <section aria-labelledby="c-h"><h2 id="c-h">By city</h2>${cityGrid(await d.metroTotals(env), (m) => `/us/restocks/${m.slug}`)}</section>
  ${await factsBlock(env)}`;
  return page(env, { title: `Pokémon Restock Tracker — Pokémon Cards In Stock Near You, Live | ${env.BRAND_NAME}`, description: 'Pokémon restock tracker: live Pokémon card stock at Target, Best Buy, GameStop, Costco and Pokémon Center, real restock times and instant alerts.', path: '/', body,
    jsonLd: [{ '@context': 'https://schema.org', '@type': 'WebSite', name: env.BRAND_NAME, url: env.BASE_URL }] });
}

/* ---------- product ---------- */
export async function sku(env, slug, metroSlug = null) {
  const k = await d.skuBySlug(env, slug);
  const metro = metroSlug ? metroBySlug[metroSlug] : null;
  if (!k || (metroSlug && !metro)) return null;
  const [rows, rs, listings] = await Promise.all([
    d.availability(env, k.id, metroSlug),
    d.restocks(env, metro ? 'r.sku_id = ? AND (s.online = 1 OR s.metro = ?)' : 'r.sku_id = ?', metro ? [k.id, metro.slug] : [k.id]),
    d.listingsOf(env, k.id),
  ]);
  const sum = d.summarize(rs);
  const phys = rows.filter((r) => !r.online); const inStores = phys.filter((r) => r.in_stock); const online = rows.filter((r) => r.online && r.in_stock);
  const place = metro ? `${metro.name}, ${metro.state}` : 'the US';
  const lastCheck = rows.reduce((m, r) => Math.max(m, r.seen_at ?? 0), 0);
  const minPrice = Math.min(...listings.map((l) => l.price || Infinity));

  // Answer line: follows live restocks (§1)
  const parts = [];
  if (phys.length) parts.push(inStores.length ? `<strong>in stock at ${inStores.length} of ${phys.length} stores</strong> in ${e(place)}, including ${e(placeLabel(inStores[0]))} in ${e(inStores[0].city)}` : `<strong>sold out at all ${phys.length} stores</strong> we track in ${e(place)}`);
  parts.push(online.length ? `<strong>in stock online at ${e(listJoin(online.map((o) => sourceName(o.source))))}</strong>` : 'sold out online');
  let lede = rows.length ? `${e(k.name)} is ${parts.join(', and ')}.` : `We just started tracking ${e(k.name)}. Live stock appears within the hour.`;
  if (rs[0]) lede += ` Last restock: ${e(placeLabel(rs[0]))}, ${timeAgo(rs[0].started_at)}${rs[0].ended_at ? `; it lasted ${formatDuration(rs[0].ended_at - rs[0].started_at)}` : ''}.`;

  const path = metro ? `/us/${k.slug}/${metro.slug}` : `/us/${k.slug}`;
  const c = crumbs(env, [{ name: 'Live stock', path: '/' }, ...(k.set_name ? [{ name: k.set_name, path: `/us/${k.slug}` }] : []), ...(metro ? [{ name: k.name, path: `/us/${k.slug}` }, { name: metro.name, path }] : [{ name: k.name, path }])]);
  const a = answers([
    { q: `Where can I buy ${k.name} today?`, a: inStores.length || online.length ? `As of the last check: ${[...online.map((o) => `${sourceName(o.source)} online`), ...inStores.slice(0, 3).map((s) => `${placeLabel(s)} (${s.city})`)].join(', ')}. Buy or reserve on the retailer's site before you travel.` : `Sold out everywhere we track in ${place} right now. An alert tells you the second it restocks.` },
    { q: `When does ${k.name} restock?`, a: sum.count ? `${sum.count} restocks in the last 30 days${metro ? ` in ${metro.name}` : ''}; most landed around ${hourLabel(sum.peakHour)}${sum.peakDay != null ? `, ${DAYS[sum.peakDay]} the busiest day` : ''}. No retailer publishes a schedule.` : 'No restock logged yet. Every restock is recorded from the first day we track a product.' },
    { q: `How long does ${k.name} stay in stock?`, a: sum.typical ? `Typically ${formatDuration(sum.typical)}; the shortest restock we saw lasted ${formatDuration(sum.shortest)}. That is why alerts matter.` : 'Not enough data yet.' },
  ]);

  const byRetailer = sourceList.map((s) => {
    const mine = rows.filter((r) => r.source === s.id); if (!mine.length) return '';
    const n = mine.filter((r) => r.in_stock).length;
    return `<tr><td><a href="/us/retailer/${s.id}">${e(s.name)}</a></td><td>${s.kind === 'online' ? (n ? '<strong>In stock online</strong>' : 'Sold out online') : `${n ? `<strong>${n}` : n} of ${mine.length} stores${n ? '</strong>' : ''}`}</td></tr>`;
  }).join('');

  const pctIn = phys.length ? Math.round((100 * inStores.length) / phys.length) : 0;
  const [glyph, rlabel] = rarityOf({ online_in: online.length }, pctIn);
  const card = tcgCard({ stage: typeLabel(k.type), name: k.name.replace(` ${typeLabel(k.type)}`, ''), num: inStores.length, numLabel: 'stores', art: ART[k.type] ?? 'art-tiles', cls: 'hero-card',
    moves: [
      { cost: 1, label: 'Online', value: online.length ? online.map((o) => sourceName(o.source)).join(', ') : 'Sold out' },
      { cost: 2, label: 'Last restock', value: rs[0] ? timeAgo(rs[0].started_at) : '—' },
      { cost: 3, label: 'Typical stay', value: sum.typical ? formatDuration(sum.typical) : '—' },
    ],
    footer: `<span class="rar" title="${rlabel}">${glyph}<span class="vh"> ${rlabel}</span></span><span>${inStores.length}/${phys.length} stores${metro ? ` · ${e(metro.name)}` : ''}</span><span>${Number.isFinite(minPrice) ? `$${minPrice.toFixed(2)}` : ''}</span>` });
  const body = `${c.html}
  <div class="hero"><div class="answer"><h1>${e(k.name)} in stock${metro ? ` in ${e(metro.name)}` : ''}</h1><p class="lede">${lede}</p>
  <p class="asof">${asOf(lastCheck)}${Number.isFinite(minPrice) ? ` From $${minPrice.toFixed(2)}.` : ''}</p></div>${card}</div>
  ${alertCta(env, { sku: k, metro: metroSlug ?? '' })}
  ${byRetailer ? `<section aria-labelledby="b-h"><h2 id="b-h">By retailer</h2><table><thead><tr><th>Retailer</th><th>Right now</th></tr></thead><tbody>${byRetailer}</tbody></table></section>` : ''}
  <section aria-labelledby="w-h"><h2 id="w-h">Where it is${metro ? ` in ${e(metro.name)}` : ''}</h2>${placeRows(rows, { limit: metro ? 150 : 30 })}</section>
  <section aria-labelledby="h-h"><h2 id="h-h">When it restocks</h2>${hourChart(sum, k.name)}<p><a href="/us/${e(k.slug)}/restocks">Full restock history</a></p></section>
  ${a.html}
  ${metro ? '' : `<section aria-labelledby="c-h"><h2 id="c-h">${e(k.name)} by city</h2><details><summary>See all 50 cities</summary>${cityGrid(await d.metroTotals(env, k.id), (m) => `/us/${k.slug}/${m.slug}`)}</details></section>`}
  ${await factsBlock(env)}`;
  return page(env, {
    title: `${k.name} in stock${metro ? ` in ${metro.name}` : ''} — live stock + alerts`,
    description: `${k.name}: ${inStores.length} of ${phys.length} stores in ${place} have it${online.length ? `, online at ${listJoin(online.map((o) => sourceName(o.source)))}` : ''}. Restock times and instant alerts.`,
    path, body, jsonLd: [c.ld, a.ld],
  });
}

/* ---------- restock-time pages ---------- */
async function restockPage(env, { title, h1, path, rows, back, label }) {
  const sum = d.summarize(rows);
  const lede = sum.count
    ? `${sum.count} restocks logged in 30 days. Most land around <strong>${hourLabel(sum.peakHour)}</strong>${sum.peakDay != null ? `, <strong>${DAYS[sum.peakDay]}</strong> the busiest day` : ''}. Stock typically lasts <strong>${formatDuration(sum.typical)}</strong> (shortest ${formatDuration(sum.shortest)}, longest ${formatDuration(sum.longest)}).`
    : 'No retailer publishes a restock schedule. We log every restock; the real pattern shows here once there is enough history.';
  const body = `<p class="crumbs"><a href="${back.path}">${e(back.name)}</a> › Restock times</p>
  <div class="answer"><h1>${e(h1)}</h1><p class="lede">${lede}</p></div>
  ${alertCta(env)}
  <section><h2>By hour</h2>${hourChart(sum, label)}</section>
  <section><h2>Every restock, newest first</h2>${latestTable(rows.slice(0, 60))}</section>
  ${await factsBlock(env)}`;
  // Thin-content rule (§7): indexable only with ≥ 20 restocks over > 18 h
  return page(env, { title, description: `${h1}: real restock times from ${sum.count} logged restocks.`, path, body, noindex: !sum.indexable, nav: 'restocks' });
}

export async function skuRestocks(env, slug) {
  const k = await d.skuBySlug(env, slug); if (!k) return null;
  return restockPage(env, { title: `When does ${k.name} restock? Real restock times`, h1: `When does ${k.name} restock?`, path: `/us/${k.slug}/restocks`, rows: await d.restocks(env, 'r.sku_id = ?', [k.id]), back: { name: k.name, path: `/us/${k.slug}` }, label: k.name });
}
export async function cityRestocks(env, metroSlug) {
  const m = metroBySlug[metroSlug]; if (!m) return null;
  const [rows, stores] = await Promise.all([d.restocks(env, 's.metro = ?', [m.slug]), d.storesInMetro(env, m.slug)]);
  const res = await restockPage(env, { title: `When do stores restock Pokémon cards in ${m.name}?`, h1: `When do stores restock Pokémon cards in ${m.name}?`, path: `/us/restocks/${m.slug}`, rows, back: { name: 'Cities', path: '/us/cities' }, label: m.name });
  // add the store list of the city
  const html = (await res.text()).replace('<section><h2>By hour</h2>', `<section><h2>Stores in ${e(m.name)}</h2>${stores.length ? `<ul class="rows">${stores.map((s) => `<li class="row${s.in_count ? ' is-in' : ''}"><span class="name"><a href="/us/store/${e(s.slug)}">${e(placeLabel(s))}</a></span><span class="meta">${e(s.address ?? '')} · ${s.last_restock ? `last restock ${timeAgo(s.last_restock)}` : 'no restock seen yet'}</span><span class="side">${s.in_count ? `<span class="chip in">${s.in_count} in stock</span>` : '<span class="chip out">Sold out</span>'}</span></li>`).join('')}</ul>` : '<p class="empty">No stores yet.</p>'}</section><section><h2>By hour</h2>`);
  return new Response(html, res);
}
export async function storeRestocks(env, slug) {
  const s = await d.storeBySlug(env, slug); if (!s) return null;
  return restockPage(env, { title: `When does ${placeLabel(s)} restock Pokémon cards?`, h1: `When does ${placeLabel(s)} restock Pokémon cards?`, path: `/us/store/${s.slug}/restocks`, rows: await d.restocks(env, 'r.store_id = ?', [s.id]), back: { name: placeLabel(s), path: `/us/store/${s.slug}` }, label: placeLabel(s) });
}
export async function retailerPage(env, id) {
  const src = SOURCES[id]; if (!src) return null;
  return restockPage(env, { title: `When does ${src.name} restock Pokémon cards? Real restock times`, h1: `When does ${src.name} restock Pokémon cards?`, path: `/us/retailer/${id}`, rows: await d.restocks(env, 'r.source = ?', [id]), back: { name: 'Retailers', path: '/us/retailers' }, label: src.name });
}
export async function allRestocks(env) {
  return restockPage(env, { title: 'When do stores restock Pokémon cards? Real restock times', h1: 'When do stores restock Pokémon cards?', path: '/us/restocks', rows: await d.restocks(env), back: { name: 'Live stock', path: '/' }, label: 'All retailers' });
}

/* ---------- store ---------- */
export async function store(env, slug) {
  const s = await d.storeBySlug(env, slug); if (!s) return null;
  const [items, rs] = await Promise.all([d.storeStock(env, s.id), d.restocks(env, 'r.store_id = ?', [s.id])]);
  const sum = d.summarize(rs);
  const inNow = items.filter((i) => i.in_stock);
  const label = placeLabel(s);
  const lede = (inNow.length ? `${e(label)} has <strong>${inNow.length} Pokémon TCG product${inNow.length > 1 ? 's' : ''} in stock</strong>: ${inNow.slice(0, 3).map((i) => e(i.name)).join(', ')}.` : `${e(label)} has <strong>no Pokémon TCG product in stock</strong> right now.`)
    + (sum.peakHour != null ? ` Restocks here usually land around ${hourLabel(sum.peakHour)}.` : '');
  const m = metroBySlug[s.metro];
  const c = crumbs(env, [{ name: 'Live stock', path: '/' }, ...(m ? [{ name: m.name, path: `/us/restocks/${m.slug}` }] : []), { name: label, path: `/us/store/${s.slug}` }]);
  const body = `${c.html}<div class="answer"><h1>${e(label)}: Pokémon cards in stock</h1><p class="lede">${lede}</p><p class="asof">${e([s.address, s.city, s.state, s.zip].filter(Boolean).join(', '))}</p></div>
  ${alertCta(env, { metro: s.metro ?? '' })}
  <section><h2>Here right now</h2>${items.length ? `<ul class="rows">${items.map((i) => `<li class="row${i.in_stock ? ' is-in' : ''}"><span class="name"><a href="/us/${e(i.slug)}">${e(i.name)}</a></span><span class="meta">${i.last_restock ? `last restock ${timeAgo(i.last_restock)}` : 'no restock seen yet'} · checked ${timeAgo(i.seen_at)}</span><span class="side">${chip(i.in_stock, i.seen_at)}${i.qty > 1 ? `<span class="qty">${i.qty} available</span>` : ''}</span></li>`).join('')}</ul>` : '<p class="empty">Nothing checked here yet.</p>'}</section>
  <section><h2>When this store restocks</h2>${hourChart(sum, label)}<p><a href="/us/store/${e(s.slug)}/restocks">Full restock history</a></p></section>
  ${await factsBlock(env)}`;
  return page(env, { title: `Pokémon cards in stock at ${label}${s.city ? ` (${s.city})` : ''} — live + alerts`, description: `${label}: ${inNow.length} Pokémon TCG products in stock now. Usual restock hour and alerts.`, path: `/us/store/${s.slug}`, body, jsonLd: [c.ld] });
}

/* ---------- indexes ---------- */
export async function cities(env) {
  return page(env, { title: 'Pokémon cards in stock by city', description: 'Live Pokémon TCG stock and restock times in the 50 largest US cities.', path: '/us/cities', nav: 'cities',
    body: `<div class="answer"><h1>Pokémon cards in stock, by city</h1></div>${cityGrid(await d.metroTotals(env), (m) => `/us/restocks/${m.slug}`)}` });
}
export async function retailers(env) {
  return page(env, { title: 'Pokémon cards in stock by retailer', description: 'Restock times and live stock at Target, Best Buy, GameStop, Costco and Pokémon Center.', path: '/us/retailers', nav: 'retailers',
    body: `<div class="answer"><h1>Pokémon cards in stock, by retailer</h1><p class="lede">Store by store at Target, Best Buy and GameStop; online at Pokémon Center and Costco.</p></div>${retailerGrid()}` });
}

export async function pricing(env) {
  return page(env, { title: `Pricing — ${env.BRAND_NAME}`, description: 'Restock alert plans.', path: '/pricing',
    body: `<div class="answer"><h1>Pricing</h1><p class="lede">Live stock pages are free. Alerts are paid, for 30 days, cancel in 2 clicks.</p></div>
    <table><thead><tr><th>Plan</th><th>What you watch</th><th>30 days</th></tr></thead><tbody>
    <tr><td>Solo</td><td>1 product in 1 store, 1 city or online</td><td>$${e(env.PRICE_SOLO)}</td></tr>
    <tr><td>Multi</td><td>Several products and places, or any sealed product of a set</td><td>$${e(env.PRICE_MULTI)}</td></tr></tbody></table>
    <p class="sub">Taxes may be added at checkout depending on your country. We alert, you buy from the retailer: we never buy for you.</p>
    <p><a class="btn" href="/alerts">Set up my alert</a></p>` });
}

/** Press kit from real restock data (§7). */
export async function press(env) {
  const rows = await d.restocks(env);
  const sum = d.summarize(rows);
  const bySource = sourceList.map((s) => ({ s, sum: d.summarize(rows.filter((r) => r.source === s.id)) })).filter((x) => x.sum.count);
  return page(env, { title: `Press — ${env.BRAND_NAME}`, description: 'Pokémon TCG restock data for journalists.', path: '/press',
    body: `<div class="answer"><h1>Press kit: Pokémon card restocks, in numbers</h1><p class="lede">${sum.count} restocks logged in the last 30 days across US retailers. Most land around ${sum.peakHour != null ? hourLabel(sum.peakHour) : '—'}; stock typically lasts ${formatDuration(sum.typical)}, the shortest ${formatDuration(sum.shortest)}.</p></div>
    <table><thead><tr><th>Retailer</th><th>Restocks</th><th>Usual hour</th><th>Typical time in stock</th></tr></thead><tbody>${bySource.map(({ s, sum: x }) => `<tr><td>${e(s.name)}</td><td>${x.count}</td><td>${hourLabel(x.peakHour)}</td><td>${formatDuration(x.typical)}</td></tr>`).join('')}</tbody></table>
    <p class="sub">Data: each retailer's public availability, read every few minutes. Contact: <a href="mailto:${e(env.SUPPORT_EMAIL)}">${e(env.SUPPORT_EMAIL)}</a>.</p>` });
}

export const legal = (env, kind) => page(env, { title: kind === 'terms' ? 'Terms' : 'Privacy', description: kind, path: `/${kind}`, noindex: false,
  body: kind === 'terms'
    ? `<div class="prose"><h1>Terms</h1><p>${e(env.BRAND_NAME)} sends stock alerts; it never buys products for you. Stock data comes from retailers' public availability and can be wrong or late: always confirm with the retailer. Alerts are sold for 30 days and renew unless cancelled; cancel in 2 clicks from your account. [Legal entity, address and governing law: to be completed by the founder.]</p></div>`
    : `<div class="prose"><h1>Privacy</h1><p>We store your email, the alerts you set, your notification channels and your payments. One cookie keeps you signed in. Visit measurement uses no cookie: a per-tab id lives in your browser's session storage and is deleted when you close the tab. A 2-hour link between a Safari visit and the Home Screen app is made only if you install it. We never sell data. Contact: ${e(env.SUPPORT_EMAIL)}. [Controller details: to be completed by the founder.]</p></div>` });
