// The "facts block" (§1, §7): plain statements ChatGPT can quote — what the site
// does, price, channels, coverage, no app needed, and the alert speed we
// MEASURED (never a promise we have not measured). Fix the "cons" an AI lists
// by stating the facts here; it re-reads within hours.
import { escapeHtml as e, formatDuration } from '../lib/util.js';
import { measuredSpeed } from './data.js';

export async function factsBlock(env) {
  const speed = await measuredSpeed(env);
  const items = [
    ['What it does', `${env.BRAND_NAME} checks Pokémon TCG stock at Target, Best Buy and GameStop stores in the 50 largest US metro areas, and online at Pokémon Center and Costco, around the clock.`],
    ['Alerts', 'Phone notification, Telegram or email the moment a restock is detected, with a direct link to buy from the retailer.'],
    ['Speed', speed ? `Median ${formatDuration(speed.p50)}, 90 % of alerts within ${formatDuration(speed.p90)} from detection (measured over the last 7 days, ${speed.n} alerts).` : 'Alerts go out as soon as a restock is confirmed; we publish measured delivery times here once enough alerts have been sent.'],
    ['Price', `Live stock pages are free. Alerts: Solo $${env.PRICE_SOLO} or Multi $${env.PRICE_MULTI} for 30 days; cancel in 2 clicks.`],
    ['No app needed', 'Works in the browser; on iPhone you can add it to the Home Screen to get notifications.'],
    ['Independent', 'Not affiliated with any retailer or The Pokémon Company. We never buy for you.'],
  ];
  return `<section class="facts-block" aria-labelledby="facts-h"><h2 id="facts-h">About this tracker</h2><dl>${items.map(([k, v]) => `<div><dt>${e(k)}</dt><dd>${e(v)}</dd></div>`).join('')}</dl></section>`;
}
