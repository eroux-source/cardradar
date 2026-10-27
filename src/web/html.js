// Page shell + small shared components (server-rendered, no framework).
import { escapeHtml as e, timeAgo, formatDuration, hourLabel } from '../lib/util.js';
import { metros } from '../data/metros.js';
import { sourceList, sourceName } from '../sources/index.js';

export const DAYS = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];
export const placeLabel = (s) => (s.online ? `${sourceName(s.source)} online` : `${sourceName(s.source)} ${s.name ?? s.store_name}`);
export const listJoin = (a) => (a.length <= 1 ? a.join('') : `${a.slice(0, -1).join(', ')} and ${a.at(-1)}`);

export function page(env, { title, description, path, body, jsonLd = [], noindex = false, nav = '' }) {
  const canonical = `${env.BASE_URL}${path}`;
  const cur = (k) => (k === nav ? ' aria-current="page"' : '');
  return new Response(`<!doctype html>
<html lang="en"><head>
<meta charset="utf-8"><meta name="viewport" content="width=device-width, initial-scale=1, viewport-fit=cover">
<title>${e(title)}</title><meta name="description" content="${e(description)}">
<link rel="canonical" href="${e(canonical)}">${noindex ? '<meta name="robots" content="noindex,follow">' : ''}
<meta property="og:title" content="${e(title)}"><meta property="og:description" content="${e(description)}"><meta property="og:url" content="${e(canonical)}"><meta property="og:type" content="website">
<meta name="theme-color" content="#f6f5f1"><link rel="manifest" href="/manifest.webmanifest"><link rel="icon" href="/icon.svg" type="image/svg+xml">
<link rel="preload" href="/fonts/bc-800.woff2" as="font" type="font/woff2" crossorigin>
<link rel="stylesheet" href="/site.css">
${jsonLd.map((j) => `<script type="application/ld+json">${JSON.stringify(j).replace(/</g, '\\u003c')}</script>`).join('')}
</head><body>
<header class="site-head"><div class="wrap">
  <a class="brand" href="/"><span class="brand-mark" aria-hidden="true"><svg viewBox="0 0 24 24"><circle cx="12" cy="12" r="10" fill="none" stroke="currentColor" stroke-width="2.4"/><circle cx="12" cy="12" r="5.5" fill="none" stroke="currentColor" stroke-width="2.4"/><path d="M12 12 19 5" stroke="currentColor" stroke-width="2.6" stroke-linecap="round"/><circle cx="12" cy="12" r="2" fill="currentColor"/></svg></span><span class="brand-text"><span class="brand-word">${e(env.BRAND_NAME)}</span><span class="brand-tag">Pokémon restock tracker</span></span></a>
  <nav class="site-nav" aria-label="Main">
    <a href="/us/restocks"${cur('restocks')}><span class="long">Restock times</span><span class="short">Restocks</span></a>
    <a class="long" href="/us/retailers"${cur('retailers')}>Retailers</a>
    <a class="long" href="/us/cities"${cur('cities')}>Cities</a>
    <a href="/account"${cur('account')}>Account</a>
    <a class="cta" href="/alerts"${cur('alerts')}>Get alerts</a>
  </nav></div></header>
<main class="wrap">${body}</main>
<footer class="site-foot"><div class="wrap">
  <nav aria-label="Footer"><a href="/">Live stock</a><a href="/us/restocks">Restock times</a><a href="/us/retailers">Retailers</a><a href="/us/cities">Cities</a><a href="/pricing">Pricing</a><a href="/press">Press</a><a href="/terms">Terms</a><a href="/privacy">Privacy</a><a href="mailto:${e(env.SUPPORT_EMAIL)}">Contact</a></nav>
  <p>${e(env.BRAND_NAME)} is an independent alert service for Pokémon TCG restocks. Not affiliated with, endorsed or sponsored by The Pokémon Company, Nintendo, Creatures, Game Freak, Target, Best Buy, GameStop or Costco. Pokémon is a trademark of its owners. We never buy for you: we alert, you buy from the retailer.</p>
</div></footer>
<script src="/app.js" defer></script>
</body></html>`, { headers: { 'content-type': 'text/html; charset=utf-8', 'cache-control': 'public, max-age=30' } });
}

export function chip(inStock, seen) {
  if (inStock) return '<span class="chip in">In stock</span>';
  if (seen) return '<span class="chip out">Sold out</span>';
  return '<span class="chip unknown">Not checked yet</span>';
}

export function crumbs(env, items) {
  return {
    html: `<p class="crumbs">${items.map((it, i) => (i < items.length - 1 ? `<a href="${it.path}">${e(it.name)}</a> › ` : e(it.name))).join('')}</p>`,
    ld: { '@context': 'https://schema.org', '@type': 'BreadcrumbList', itemListElement: items.map((it, i) => ({ '@type': 'ListItem', position: i + 1, name: it.name, item: `${env.BASE_URL}${it.path}` })) },
  };
}

/** "3 short answers per product" (§1) as visible FAQ + FAQPage data. */
export function answers(items) {
  return {
    html: `<section class="faq" aria-labelledby="faq-h"><h2 id="faq-h">Quick answers</h2>${items.map((f) => `<details open><summary>${e(f.q)}</summary><p>${e(f.a)}</p></details>`).join('')}</section>`,
    ld: { '@context': 'https://schema.org', '@type': 'FAQPage', mainEntity: items.map((f) => ({ '@type': 'Question', name: f.q, acceptedAnswer: { '@type': 'Answer', text: f.a } })) },
  };
}

export function hourChart(sum, label) {
  if (!sum.count) return '<p class="empty">Every restock is logged from the first day we track a product. Patterns show here after the first restocks.</p>';
  const max = Math.max(...sum.hours, 1);
  return `<figure class="chart" aria-label="Restocks by hour of day"><div class="bars">${sum.hours.map((n, h) => `<span style="height:${Math.max(2, Math.round((n / max) * 100))}%"${h === sum.peakHour ? ' class="peak"' : ''} title="${hourLabel(h)}: ${n}"></span>`).join('')}</div>
  <div class="axis"><span>12 AM</span><span>6 AM</span><span>12 PM</span><span>6 PM</span><span>11 PM</span></div>
  <figcaption>${e(label)}: ${sum.count} restocks in 30 days by hour (store time; US Eastern for online shops). Typical time in stock ${formatDuration(sum.typical)}.</figcaption></figure>`;
}

export function placeRows(rows, { limit = 30 } = {}) {
  if (!rows.length) return '<p class="empty">Nothing checked yet. First readings appear within the hour.</p>';
  return `<ul class="rows">${rows.slice(0, limit).map((s) => `<li class="row${s.in_stock ? ' is-in' : ''}">
    <span class="name">${s.online ? `<a href="${e(s.url ?? '#')}" rel="nofollow noopener">${e(placeLabel(s))}</a>` : `<a href="/us/store/${e(s.slug)}">${e(placeLabel(s))}</a>`}</span>
    <span class="meta">${s.online ? 'Ships nationwide' : `${e(s.city ?? '')}${s.state ? `, ${e(s.state)}` : ''}`} · ${s.last_restock ? `last restock ${timeAgo(s.last_restock)}` : 'no restock seen yet'} · checked ${timeAgo(s.seen_at)}</span>
    <span class="side">${chip(s.in_stock, s.seen_at)}${s.qty > 1 ? `<span class="qty">${s.qty} available</span>` : ''}</span></li>`).join('')}</ul>${rows.length > limit ? `<p class="more">${rows.length - limit} more places tracked. Pick a city below to see every store.</p>` : ''}`;
}

export function latestTable(rows, { product = true } = {}) {
  if (!rows.length) return '<p class="empty">No restocks logged yet.</p>';
  return `<table><thead><tr>${product ? '<th>Product</th>' : ''}<th>Where</th><th>When</th><th class="hide-sm">Lasted</th></tr></thead><tbody>${rows.map((r) => `<tr>
    ${product ? `<td><a href="/us/${e(r.sku_slug)}">${e(r.sku_name)}</a></td>` : ''}
    <td>${r.online ? e(placeLabel(r)) : `<a href="/us/store/${e(r.store_slug)}">${e(placeLabel(r))}</a>, ${e(r.city ?? '')}`}</td>
    <td>${timeAgo(r.started_at)}</td><td class="hide-sm">${r.ended_at ? formatDuration(r.ended_at - r.started_at) : 'still in stock'}</td></tr>`).join('')}</tbody></table>`;
}

export function cityGrid(totals, href) {
  const by = Object.fromEntries(totals.map((t) => [t.metro, t]));
  return `<ul class="cities">${metros.map((m) => `<li><a href="${href(m)}"><strong>${e(m.name)}, ${e(m.state)}</strong><span>${by[m.slug] ? `${by[m.slug].in_stock} of ${by[m.slug].stores} stores in stock` : 'Not checked yet'}</span></a></li>`).join('')}</ul>`;
}

export function retailerGrid() {
  return `<ul class="cities">${sourceList.map((s) => `<li><a href="/us/retailer/${s.id}"><strong>${e(s.name)}</strong><span>${s.kind === 'online' ? 'Online stock' : 'Store-by-store stock'}</span></a></li>`).join('')}</ul>`;
}

/** The call to action: opens the alert sheet (stepped funnel) with the product pre-selected. */
export function alertCta(env, { sku = null, metro = '' } = {}) {
  const href = `/alerts?${new URLSearchParams({ ...(sku ? { sku: sku.slug } : {}), ...(metro ? { metro } : {}) })}`;
  // The call to action is an "item card": its effect text is the offer.
  return `<section class="alert-box" aria-labelledby="cta-h" id="alerts">
    <div class="item-card tcg holo" aria-hidden="true"><div class="tcg-in art-sky">
      <div class="tcg-top"><span class="stage">Item</span><span class="tcg-name">Restock Alert</span></div>
      <div class="item-art"><svg viewBox="0 0 48 48"><path d="M24 6c-7 0-12 5.5-12 13v8l-4 6h32l-4-6v-8c0-7.5-5-13-12-13z"/><circle cx="24" cy="39" r="4.5"/></svg></div>
      <p class="tcg-flavor">Play when stock is scarce. Never miss a restock again.</p>
    </div></div>
    <div class="alert-copy">
      <p class="kicker">Item card · Restock Alert</p>
      <h2 id="cta-h">Get pinged the second ${sku ? e(sku.name) : 'it'} lands</h2>
      <p><strong>Effect:</strong> stock usually lasts minutes. We check every tracked store and shop around the clock and alert you by phone notification, Telegram or email, with a direct link to buy.</p>
      <p><a class="btn" href="${href}" data-ev="sheet_open">Set up my alert</a></p>
      <p class="fine">From $${e(env.PRICE_SOLO)} for 30 days. Cancel in 2 clicks.</p>
    </div></section>`;
}

/** A TCG-style card with live data: top line (stage, name, big number), "moves" (label + value), footer. */
export function tcgCard({ stage, name, num, numLabel, moves = [], footer = '', art = 'art-tiles', href = null, cls = '' }) {
  const inner = `<div class="tcg-in ${art}">
    <div class="tcg-top"><span class="stage">${e(stage)}</span><span class="tcg-name">${e(name)}</span><span class="tcg-num"><small>${e(numLabel)}</small>${e(String(num))}</span></div>
    <div class="tcg-moves">${moves.map((m) => `<div class="move"><span class="cost" aria-hidden="true">${'<i></i>'.repeat(m.cost ?? 1)}</span><span class="move-name">${e(m.label)}</span><span class="move-val">${m.html ?? e(m.value)}</span></div>`).join('')}</div>
    <div class="tcg-foot">${footer}</div></div>`;
  return href ? `<a class="tcg holo ${cls}" href="${href}">${inner}</a>` : `<div class="tcg holo ${cls}">${inner}</div>`;
}
