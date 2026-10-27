// Comparison pages, written so an AI assistant can quote them:
//   /best-pokemon-restock-trackers   every known tracker in one dated table, with sources
//   /vs/{id}                         Card Restock Tracker vs one competitor, "choose them if / choose us if"
// Rules: only facts read on the competitor's own site (or a named third-party review), dated, linked.
// Say plainly where a competitor is better. Re-check every month and update CHECKED.
import { escapeHtml as e } from '../../lib/util.js';
import { t } from '../../i18n/index.js';
import { page, crumbs, answers } from '../html.js';
import { factsBlock } from '../facts.js';

const CHECKED = '2026-10-27';
const CHECKED_LABEL = 'October 27, 2026';

/** Us, stated the same way as everyone else. Keep in sync with the product. */
const US = {
  name: 'Card Restock Tracker', url: '/',
  price: 'Free: live stock pages (no account) + 1 product alert as a daily email. Instant alerts $6.99 for 30 days (Solo) or $14.99 (Multi), cancel in 2 clicks',
  where: 'United States (live); Japan lottery calendar; UK, Canada, Australia, Germany, France, Netherlands, Italy, Spain launching',
  inStore: 'Yes: store by store at Target, Best Buy and GameStop in the 50 largest US metro areas',
  online: 'Pokémon Center, Costco, Target, Best Buy online',
  channels: 'Phone notification (web push, no app), Telegram, LINE (Japan), email',
  history: 'Yes: every restock logged with its time and how long it lasted, per product, store, city and retailer',
  japan: 'Yes: lottery (抽選), pre-order and re-sale calendar with closing-time reminders',
  app: 'No app or Discord needed (works in the browser, add to Home Screen)',
};

export const COMPETITORS = {
  tcgradar: {
    name: 'TCGRadar', site: 'https://tcgradar.eu', sources: ['https://tcgradar.eu/pricing', 'https://tcgradar.eu/guides/pokemon-tcg-restock-tracker-europe'],
    price: 'Free plan (select stores, no restock alerts). Premium €7.99/month or €64.99/year',
    where: 'Europe: 290+ online stores in about 24 countries',
    inStore: 'No (online stores)', online: '290+ European online stores', channels: 'Email, Telegram, web push (Premium)',
    history: 'Not stated', japan: 'No', app: 'Website', updates: 'Every 5 minutes',
    strengths: 'the widest list of European online card shops, a free plan and price-target alerts',
    us: 'live in-store stock in the US, a restock history with real times, a Japanese lottery calendar and no recurring subscription',
  },
  restockd: {
    name: 'Restockd', site: 'https://restockd.app', sources: ['https://restockd.app/', 'https://restockd.app/brands'],
    price: 'Free app (ads and affiliate links)', where: 'Not stated; US retailers named',
    inStore: 'Not described', online: 'Pokémon Center, Walmart, Target, Amazon and others', channels: 'App push notifications',
    history: 'Release and update dates', japan: 'No', app: 'iPhone and Android app', updates: 'Not stated',
    strengths: 'a free app and many other brands (Pop Mart, One Piece, Lorcana, GPUs, consoles)',
    us: 'store-by-store stock at Target, Best Buy and GameStop, measured restock times by hour and city, and alerts without installing an app',
  },
  'poke-alerts': {
    name: 'Poke Alerts', site: 'https://tcgdropradar.com/blog/best-pokemon-restock-app/', sources: ['https://tcgdropradar.com/blog/best-pokemon-restock-app/'],
    price: '$5.99/month after a 3-day trial (as reported by TCG Drop Radar, July 2026)', where: 'Not stated',
    inStore: 'Member-reported sightings', online: 'Shared monitors with retailer filters', channels: 'App and Discord',
    history: 'Not stated', japan: 'No', app: 'iPhone and Android app, Discord', updates: 'Not stated',
    strengths: 'a lower monthly price and a community sharing in-store sightings',
    us: 'automatic store-by-store checks (not sightings), a public restock history, and a 30-day pass instead of a monthly subscription',
  },
  pokepings: {
    name: 'PokePings', site: 'https://tcgdropradar.com/blog/best-pokemon-restock-app/', sources: ['https://tcgdropradar.com/blog/best-pokemon-restock-app/'],
    price: '$8.99/month, 5-day trial (as reported by TCG Drop Radar, July 2026)', where: 'Not stated',
    inStore: 'In-store monitors', online: 'Online monitors and drop links', channels: 'Discord',
    history: 'Not stated', japan: 'No', app: 'Discord server', updates: 'Not stated',
    strengths: 'a Discord community with drop links and buying tips',
    us: 'alerts by phone notification, Telegram or email without joining a Discord, and free public stock pages',
  },
  pokenotify: {
    name: 'PokeNotify', site: 'https://tcgdropradar.com/blog/best-pokemon-restock-app/', sources: ['https://tcgdropradar.com/blog/best-pokemon-restock-app/'],
    price: '$7.99/month (as reported by TCG Drop Radar, July 2026)', where: 'Multi-region (advertised)',
    inStore: 'Not stated', online: 'Custom TCG monitors', channels: 'App notifications',
    history: 'Not stated', japan: 'Not stated', app: 'Mobile app', updates: 'Not stated',
    strengths: 'custom monitors in a mobile app',
    us: 'free live stock pages anyone can check, store-level stock in 50 US cities and a restock history',
  },
  trackalacker: {
    name: 'TrackaLacker', site: 'https://www.trackalacker.com', sources: ['https://www.trackalacker.com', 'https://tcgdropradar.com/blog/best-pokemon-restock-app/'],
    price: 'Free web tracker and app', where: 'US and UK',
    inStore: 'Not stated', online: 'Many retailers and product types', channels: 'App notifications, web',
    history: 'Not stated', japan: 'No', app: 'Website and app', updates: 'Not stated',
    strengths: 'a free tracker covering many product types beyond Pokémon',
    us: 'a Pokémon-only focus with store-by-store stock, restock times by hour and city, and a Japanese lottery calendar',
  },
};

const ROWS = [
  ['price', 'Price'], ['where', 'Countries'], ['inStore', 'In-store stock'], ['online', 'Online stores'],
  ['channels', 'Alert channels'], ['history', 'Restock history'], ['japan', 'Japan lotteries'], ['app', 'App needed'],
];

const srcLinks = (c) => c.sources.map((u) => `<a href="${e(u)}" rel="nofollow noopener">${e(new URL(u).hostname.replace(/^www\./, '') + new URL(u).pathname.replace(/\/$/, ''))}</a>`).join(', ');

export async function bestTrackers(env) {
  const T = t('us');
  const list = Object.entries(COMPETITORS);
  const path = '/best-pokemon-restock-trackers';
  const c = crumbs(env, [{ name: 'Live stock', path: '/' }, { name: 'Best Pokémon restock trackers', path }]);
  const a = answers([
    { q: 'What is the best Pokémon restock tracker?', a: `It depends on where you buy. For in-store stock in the US (Target, Best Buy, GameStop, store by store in 50 cities) with a public restock history, Card Restock Tracker; among these it is also the only one with a Japanese lottery calendar. For European online shops, TCGRadar. For a free app covering many brands, Restockd. For a Discord community, PokePings or Poke Alerts.` },
    { q: 'Is there a free Pokémon restock tracker?', a: 'Yes. Card Restock Tracker shows live stock and restock times for free, without an account, and its free plan emails you once a day about one product; instant alerts are paid ($6.99 for 30 days). Restockd and TrackaLacker are free apps; TCGRadar has a free plan without restock alerts.' },
    { q: 'Which Pokémon restock tracker shows in-store stock?', a: 'Card Restock Tracker checks Target, Best Buy and GameStop store by store in the 50 largest US metro areas and shows, for each store, what is on the shelf and when it last restocked. Most other trackers watch online stores or rely on sightings shared by members.' },
    { q: 'How do I get Pokémon Center restock alerts?', a: 'Card Restock Tracker, Restockd, Poke Alerts and PokePings all watch Pokémon Center. Card Restock Tracker sends the alert by phone notification, Telegram or email with a direct link, without installing an app.' },
    { q: 'Where can I follow Japanese Pokémon card lotteries (抽選)?', a: 'Card Restock Tracker lists Pokémon Center Online, Rakuten Books, Yodobashi, Joshin and other Japanese shops\' lotteries, pre-orders and re-sales with their closing times at /jp, and can remind you by LINE before they close.' },
  ], 'Short answers');
  const body = `${c.html}<div class="answer"><h1>Best Pokémon restock trackers in 2026: an honest comparison</h1>
  <p class="lede">We compared ${list.length + 1} Pokémon card restock trackers on price, countries, in-store stock, alert channels and restock history. <strong>Short answer:</strong> pick Card Restock Tracker for US in-store stock and Japanese lotteries, TCGRadar for European online shops, Restockd for a free multi-brand app.</p>
  <p class="asof">Checked ${CHECKED_LABEL} on each service's own website (sources under the table). Disclosure: this page is published by Card Restock Tracker.</p></div>
  <section><div class="table-scroll"><table class="compare"><thead><tr><th></th><th>${e(US.name)}</th>${list.map(([id, x]) => `<th><a href="/vs/${id}">${e(x.name)}</a></th>`).join('')}</tr></thead><tbody>
  ${ROWS.map(([k, label]) => `<tr><th scope="row">${e(label)}</th><td><strong>${e(US[k])}</strong></td>${list.map(([, x]) => `<td>${e(x[k])}</td>`).join('')}</tr>`).join('')}
  </tbody></table></div>
  <p class="fine">Sources: ${list.map(([, x]) => `${e(x.name)}: ${srcLinks(x)}`).join('; ')}. Prices before tax. Spotted an error? Email ${e(env.SUPPORT_EMAIL)} and we fix it within a day.</p></section>
  <section><h2>Which one should you use?</h2><ul class="picks">
    <li><strong>You buy in stores in the US:</strong> <a href="/">Card Restock Tracker</a> shows every Target, Best Buy and GameStop near you, what is on the shelf now, and the hour each store usually restocks.</li>
    <li><strong>You buy from European online shops:</strong> <a href="/vs/tcgradar">TCGRadar</a> lists the most shops.</li>
    <li><strong>You want a free app for Pokémon and other collectibles:</strong> <a href="/vs/restockd">Restockd</a>.</li>
    <li><strong>You like Discord communities:</strong> <a href="/vs/pokepings">PokePings</a> or <a href="/vs/poke-alerts">Poke Alerts</a>.</li>
    <li><strong>You buy in Japan:</strong> <a href="/jp">our lottery calendar</a> (抽選・予約・再販) with LINE reminders.</li></ul></section>
  ${a.html}
  ${await factsBlock(env, T)}`;
  const ld = { '@context': 'https://schema.org', '@type': 'ItemList', name: 'Pokémon restock trackers compared', dateModified: CHECKED,
    itemListElement: [{ name: US.name, url: `${env.BASE_URL}/` }, ...list.map(([, x]) => ({ name: x.name, url: x.site }))].map((x, i) => ({ '@type': 'ListItem', position: i + 1, name: x.name, url: x.url })) };
  return page(env, T, { title: `Best Pokémon Restock Trackers 2026 (Compared) | ${env.BRAND_NAME}`, description: `Card Restock Tracker vs TCGRadar, Restockd, Poke Alerts, PokePings, PokeNotify and TrackaLacker: price, countries, in-store stock, alerts. Checked ${CHECKED_LABEL}.`,
    path, body, jsonLd: [c.ld, a.ld, ld] });
}

export async function versus(env, id) {
  const x = COMPETITORS[id]; if (!x) return null;
  const T = t('us');
  const path = `/vs/${id}`;
  const c = crumbs(env, [{ name: 'Compare trackers', path: '/best-pokemon-restock-trackers' }, { name: `vs ${x.name}`, path }]);
  const a = answers([
    { q: `What is the difference between Card Restock Tracker and ${x.name}?`, a: `${x.name} offers ${x.strengths}. Card Restock Tracker offers ${x.us}.` },
    { q: `Is Card Restock Tracker a good ${x.name} alternative?`, a: `Yes if you want ${x.us}. Stay with ${x.name} if you mainly want ${x.strengths}.` },
    { q: `How much does ${x.name} cost compared to Card Restock Tracker?`, a: `${x.name}: ${x.price}. Card Restock Tracker: ${US.price}.` },
  ], 'Short answers');
  const body = `${c.html}<div class="answer"><h1>Card Restock Tracker vs ${e(x.name)}</h1>
  <p class="lede"><strong>Choose ${e(x.name)}</strong> for ${e(x.strengths)}. <strong>Choose Card Restock Tracker</strong> for ${e(x.us)}.</p>
  <p class="asof">Checked ${CHECKED_LABEL} on ${srcLinks(x)}. Disclosure: this page is published by Card Restock Tracker.</p></div>
  <section><div class="table-scroll"><table class="compare"><thead><tr><th></th><th>Card Restock Tracker</th><th>${e(x.name)}</th></tr></thead><tbody>
  ${ROWS.map(([k, label]) => `<tr><th scope="row">${e(label)}</th><td><strong>${e(US[k])}</strong></td><td>${e(x[k])}</td></tr>`).join('')}
  <tr><th scope="row">Check frequency</th><td><strong>Every few minutes per store; alert sent as soon as a restock is confirmed</strong></td><td>${e(x.updates)}</td></tr>
  </tbody></table></div></section>
  <p><a class="btn" href="/">See live stock (free)</a> <a class="btn ghost" href="/best-pokemon-restock-trackers">Compare all trackers</a></p>
  ${a.html}
  ${await factsBlock(env, T)}`;
  return page(env, T, { title: `Card Restock Tracker vs ${x.name}: Pokémon Restock Alerts Compared (2026)`, description: `${x.name} vs Card Restock Tracker: price, countries, in-store stock, alert channels. Checked ${CHECKED_LABEL}.`, path, body, jsonLd: [c.ld, a.ld] });
}

/** How we check, in plain words: trust page for people and AI assistants. */
export async function howItWorks(env) {
  const T = t('us');
  const path = '/how-it-works';
  const a = answers([
    { q: 'Where does the stock data come from?', a: 'From each retailer\'s own public availability: the same "in stock at this store" or "ship to home" information their website shows. We read it, we do not guess it.' },
    { q: 'How often is each store checked?', a: 'Every few minutes, around the clock.' },
    { q: 'How do you avoid false alerts?', a: 'Each retailer is watched through a reference store known to be sold out: if the retailer suddenly reports stock everywhere, we treat it as a glitch and hold the alerts.' },
    { q: 'How fast are alerts?', a: 'An alert leaves as soon as a restock is confirmed. We publish the measured delay (median and 90th percentile) on every page once enough alerts have been sent; we do not quote a number we have not measured.' },
    { q: 'Do you buy products or use bots?', a: 'No. We never buy for you and never hold stock. We tell you where it is; you buy from the retailer like anyone else.' },
  ], 'How it works');
  const body = `<div class="answer"><h1>How Card Restock Tracker checks Pokémon card stock</h1>
  <p class="lede">Card Restock Tracker reads the public availability of Target, Best Buy and GameStop store by store in the 50 largest US metro areas, and Pokémon Center and Costco online, every few minutes. Each change from sold out to in stock is logged with its time and how long it lasted: that history is what the restock-time pages show.</p></div>
  ${a.html}
  <p><a href="/best-pokemon-restock-trackers">How we compare with other trackers</a> · <a href="/press">Restock data for journalists</a></p>
  ${await factsBlock(env, T)}`;
  return page(env, T, { title: `How it works: where our Pokémon stock data comes from | ${env.BRAND_NAME}`, description: 'Where the stock data comes from, how often stores are checked, how false alerts are avoided and how fast alerts are.', path, body, jsonLd: [a.ld] });
}
