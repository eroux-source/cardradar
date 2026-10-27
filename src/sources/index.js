// One adapter per retailer behind a common interface (playbook §1, §3):
//   search(env, query)            → [{ sourceSku, title, price, url, image }]
//   store sources:  checkArea(env, listing, metro) → [{ store, inStock, qty }]
//   online sources: checkOnline(env, listing) → { inStock, price } | null (no verdict)
//   lottery sources (Japan): lotteries(env, query) → [{ uid, title, opensAt, closesAt, ... }]
// Every adapter declares its `country`. Sources not validated from a local network
// stay switched off (enabled() false) until their proxies are set and the bake-off passes.
import target from './target.js';
import bestbuy from './bestbuy.js';
import gamestop from './gamestop.js';
import pokemoncenter, { pokemonCenterUK, pokemonCenterCA, pokemonCenterAU } from './pokemoncenter.js';
import costco from './costco.js';
import bestbuyCA from './bestbuy_ca.js';
import kmartAU from './kmart_au.js';

/** Foreign sources run only once proxies for that country exist (retailers geo-block foreign IPs). */
const needsLocalProxy = (src) => ({ ...src, enabled: (env) => Boolean(env[`PROXY_LIST_${src.country.toUpperCase()}`]) && (src.enabled ? src.enabled(env) : true) });

export const SOURCES = Object.fromEntries([
  target, bestbuy, gamestop, pokemoncenter, costco,
  needsLocalProxy(pokemonCenterUK),
  needsLocalProxy(bestbuyCA), needsLocalProxy(pokemonCenterCA),
  needsLocalProxy(kmartAU), needsLocalProxy(pokemonCenterAU),
].map((s) => [s.id, s]));
export const sourceList = Object.values(SOURCES);
export const sourceName = (id) => SOURCES[id]?.name ?? id;
export const sourcesOf = (cc) => sourceList.filter((s) => s.country === cc);
export const enabledSources = (env) => sourceList.filter((s) => (typeof s.enabled === 'function' ? s.enabled(env) : true));
