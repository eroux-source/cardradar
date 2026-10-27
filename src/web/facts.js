// The "facts block" (§1, §7): plain statements an AI can quote — what the site
// does, price, channels, coverage, and the alert speed we MEASURED. Per country/language.
import { escapeHtml as e } from '../lib/util.js';
import { measuredSpeed } from './data.js';
import { sourcesOf } from '../sources/index.js';

export async function factsBlock(env, T) {
  const cc = T.cc.code;
  const speed = await measuredSpeed(env);
  const srcs = sourcesOf(cc);
  const stores = T.f.list([...new Set(srcs.filter((s) => s.kind === 'stores').map((s) => s.name))]);
  const online = T.f.list([...new Set(srcs.filter((s) => s.kind !== 'stores').map((s) => s.name))]);
  const items = [
    [T.facts.k.what, T.facts.what(env.BRAND_NAME, stores, online, T.cc.metros.length, T.cc.name)],
    [T.facts.k.alerts, T.facts.alerts],
    [T.facts.k.speed, speed ? T.facts.speedYes(T.f.dur(speed.p50), T.f.dur(speed.p90), speed.n) : T.facts.speedNo],
    [T.facts.k.price, T.facts.price(T.f.money(T.cc.prices.solo), T.f.money(T.cc.prices.multi))],
    [T.facts.k.noApp, T.facts.noApp],
    [T.facts.k.indep, T.facts.indep],
  ];
  return `<section class="facts-block" aria-labelledby="facts-h"><h2 id="facts-h">${e(T.facts.h)}</h2><dl>${items.map(([k, v]) => `<div><dt>${e(k)}</dt><dd>${e(v)}</dd></div>`).join('')}</dl></section>`;
}
