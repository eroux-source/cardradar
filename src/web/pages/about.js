// /about: who runs the site, why, and live numbers anyone can check (E-E-A-T, trust for people and AI assistants).
// Every number on this page is computed live; nothing is typed by hand except FOUNDER and LAUNCHED.
import { escapeHtml as e } from '../../lib/util.js';
import { t } from '../../i18n/index.js';
import { one, now } from '../../lib/db.js';
import { countryList } from '../../data/countries.js';
import { sourcesOf } from '../../sources/index.js';
import * as d from '../data.js';
import { page, answers } from '../html.js';

// Filled in by Eugène (approved text only). name = how he wants to be named publicly; sameAs = public profiles.
export const FOUNDER = { name: 'Eugène', role: 'Founder', bio: '', sameAs: [] };
const LAUNCHED = '2026-10-27'; // first visit recorded (/api/health audience.all_time.since); to confirm with Eugène

export async function aboutPage(env) {
  const T = t('us');
  const live = await d.liveCountries(env);
  const ccs = countryList.filter((c) => c.code !== 'jp' && live.has(c.code));
  const shops = new Set(ccs.flatMap((c) => sourcesOf(c.code).map((s) => s.id))).size;
  const since = now() - 30 * 864e5;
  const [n, r] = await Promise.all([
    one(env, 'SELECT COUNT(DISTINCT sku_id) AS products FROM listings WHERE active = 1').catch(() => null),
    one(env, 'SELECT COUNT(*) AS restocks FROM restocks WHERE started_at > ?', since).catch(() => null),
  ]);
  const launched = new Intl.DateTimeFormat('en-US', { dateStyle: 'long', timeZone: 'UTC' }).format(new Date(LAUNCHED));
  const countries = T.f.list(ccs.map((c) => c.name));
  const facts = [
    `${shops} online card shops checked right now, in ${ccs.length} countries: ${countries}.`,
    n?.products ? `${n.products.toLocaleString('en-US')} sealed Pokémon products followed.` : '',
    r?.restocks != null ? `${r.restocks.toLocaleString('en-US')} restocks logged in the last 30 days, each with its time and how long it lasted.` : '',
    'A Japanese lottery and pre-order calendar (抽選・予約), with reminders before entries close.',
  ].filter(Boolean);
  const a = answers([
    { q: 'Who runs Card Restock Tracker?', a: `${FOUNDER.name}, an independent developer, built and runs it since ${launched}. It is not affiliated with The Pokémon Company, Nintendo or any retailer.` },
    { q: 'How does the site make money?', a: 'Stock pages and alerts are free during launch. Some links to shops may be affiliate links, which the footer says when they are; they never change which shops we list or in what order.' },
    { q: 'What do you not do?', a: 'We do not read in-store stock at physical stores, we do not buy products for anyone and we do not use checkout bots. We only report what each online shop shows on its own website.' },
    { q: 'I found a mistake. How do I report it?', a: `Write to ${env.SUPPORT_EMAIL} or use the feedback button on any page. We fix wrong data the same day and say so on the page when it matters.` },
  ], 'About');
  const body = `<div class="answer"><h1>About Card Restock Tracker</h1>
  <p class="lede">Card Restock Tracker shows, product by product, which online card shops have sealed Pokémon cards in stock right now, and when each one restocks. ${e(FOUNDER.name)} launched it on ${e(launched)}. Big retailers sell out in minutes, while independent card shops often still have stock that is hard to find: the site checks them for you, around the clock.</p>
  ${FOUNDER.bio ? `<p>${e(FOUNDER.bio)}</p>` : ''}</div>
  <section><h2>In numbers, right now</h2><ul>${facts.map((x) => `<li>${e(x)}</li>`).join('')}</ul>
  <p class="sub">Computed live from our own data on every visit. <a href="/how-it-works">How the data is collected</a> · <a href="/pokemon-restock-data">Open data</a> · <a href="/press">Press kit</a></p></section>
  ${a.html}`;
  const ld = { '@context': 'https://schema.org', '@type': 'AboutPage', url: `${env.BASE_URL}/about`, name: 'About Card Restock Tracker', dateModified: new Date(now()).toISOString().slice(0, 10),
    mainEntity: { '@type': 'Organization', name: env.BRAND_NAME, url: env.BASE_URL, email: env.SUPPORT_EMAIL, foundingDate: LAUNCHED, logo: `${env.BASE_URL}/icon.svg`,
      founder: { '@type': 'Person', name: FOUNDER.name, jobTitle: FOUNDER.role, ...(FOUNDER.sameAs.length ? { sameAs: FOUNDER.sameAs } : {}) } } };
  return page(env, T, { title: `About Card Restock Tracker: who runs it and how | ${env.BRAND_NAME}`, description: `Who runs Card Restock Tracker, why it exists and live numbers: ${shops} online card shops checked in ${ccs.length} countries.`, path: '/about', body, jsonLd: [ld, a.ld] });
}
