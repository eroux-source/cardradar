// /for-shops: what we read from a card shop, how to remove it, and a free "Stock tracked live" badge to paste on its site.
// The badge is a static SVG in /public/badge/<lang>.svg linking to the country home (one honest link, no tracking).
import { escapeHtml as e } from '../../lib/util.js';
import { t } from '../../i18n/index.js';
import { countryList } from '../../data/countries.js';
import { sourcesOf } from '../../sources/index.js';
import * as d from '../data.js';
import { page, answers } from '../html.js';

// alt text = the link's anchor for search engines, in the shop's language
const ALT = {
  en: 'Pokémon card restock tracker', de: 'Pokémon Karten Restock Tracker', fr: 'Suivi des restocks de cartes Pokémon',
  it: 'Restock carte Pokémon', es: 'Restock de cartas Pokémon', nl: 'Pokémon kaarten restock tracker',
};
const BADGES = new Set(Object.keys(ALT));
const EN = new Intl.DisplayNames(['en'], { type: 'region' });
const cname = (cc) => EN.of(cc === 'uk' ? 'GB' : cc.toUpperCase());

export const badgeCode = (env, cc, lang) => {
  const l = BADGES.has(lang) ? lang : 'en';
  return `<a href="${env.BASE_URL}${cc === 'us' ? '/' : `/${cc}`}"><img src="${env.BASE_URL}/badge/${l}.svg" width="240" height="48" alt="${ALT[l]}"></a>`;
};

export async function forShops(env) {
  const T = t('us');
  const live = await d.liveCountries(env);
  const ccs = countryList.filter((c) => c.code !== 'jp' && live.has(c.code));
  const online = (cc) => [...new Set(sourcesOf(cc).filter((s) => s.kind !== 'stores').map((s) => s.name))].sort((a, b) => a.localeCompare(b));
  const total = new Set(ccs.flatMap((c) => sourcesOf(c.code).filter((s) => s.kind !== 'stores').map((s) => s.id))).size;
  const a = answers([
    { q: 'What do you read from my shop?', a: 'Only what any visitor sees: the Pokémon products on your public website, whether each one is in stock and its price. We never add to cart, never place orders and never use checkout bots. Products in stock are re-read about once a day and sold-out ones about every hour, so the load on your site stays tiny.' },
    { q: 'Where do your visitors go?', a: 'Straight to your own product page. We do not sell the products ourselves. Where a shop runs an affiliate programme, its links may be affiliate links; that never changes which shops we list or in what order.' },
    { q: 'Does it cost anything?', a: 'No. Being listed is free, and so is the badge.' },
    { q: 'Can I be removed, or fix a wrong product?', a: `Yes. Write to ${env.SUPPORT_EMAIL} from your shop's address and we remove your shop or fix the product the same day.` },
    { q: 'Will the badge slow my site down?', a: 'No. It is one small image (about 2 KB) with a plain link, no script and no cookie.' },
  ], 'Questions from shops');
  const body = `<div class="answer"><h1>For card shops: get a free "Stock tracked live" badge</h1>
  <p class="lede">Card Restock Tracker shows Pokémon collectors which independent card shops have a product in stock right now, and sends them straight to the shop's own page. We check ${total} online shops (mostly independent card shops) in ${ccs.length} countries. If your shop is one of them, you can show it on your site with the badge below: copy the code for your country and paste it in your footer or on your "About" page.</p></div>
  <section><h2>Your badge</h2>
  ${ccs.map((c) => { const code = badgeCode(env, c.code, c.lang); return `<div style="margin:0 0 18px;padding:14px 16px;border:1px solid var(--rule);border-radius:12px"><h3>${e(cname(c.code))}</h3>
    <p><img src="/badge/${BADGES.has(c.lang) ? c.lang : 'en'}.svg" width="240" height="48" alt="${e(ALT[c.lang] ?? ALT.en)}" loading="lazy"></p>
    <label class="sub" for="code-${c.code}">Code to paste</label>
    <textarea id="code-${c.code}" readonly rows="3" style="width:100%;font:13px/1.4 ui-monospace,Menlo,monospace" onclick="this.select()">${e(code)}</textarea></div>`; }).join('')}
  </section>
  ${a.html}
  <section><h2>Shops we check</h2>
  ${ccs.map((c) => { const n = online(c.code); return n.length ? `<h3>${e(cname(c.code))} (${n.length})</h3><p class="sub">${e(n.join(', '))}</p>` : ''; }).join('')}
  <p class="sub">Not on the list? Write to <a href="mailto:${e(env.SUPPORT_EMAIL)}">${e(env.SUPPORT_EMAIL)}</a> with your shop's address: we add independent shops that sell sealed Pokémon products online. <a href="/how-it-works">How we check stock</a> · <a href="/about">About us</a></p></section>`;
  return page(env, T, { title: `For card shops: free "Stock tracked live" badge | ${env.BRAND_NAME}`,
    description: `We check ${total} online shops (mostly independent card shops) in ${ccs.length} countries. What we read from your shop, how to be removed, and a free badge for your site.`,
    path: '/for-shops', body, jsonLd: [a.ld] });
}
