// One adapter per retailer behind a common interface (playbook §1, §3):
//   search(env, query)            → [{ sourceSku, title, price, url }]
//   store sources:  checkArea(env, listing, metro) → [{ store, inStock, qty }]
//   online sources: checkOnline(env, listing) → { inStock, price } | null (no verdict)
//                   or snapshot(env, query) → [{ item, inStock }] (many listings per call)
import target from './target.js';
import bestbuy from './bestbuy.js';
import gamestop from './gamestop.js';
import pokemoncenter from './pokemoncenter.js';
import costco from './costco.js';

export const SOURCES = { target, bestbuy, gamestop, pokemoncenter, costco };
export const sourceList = Object.values(SOURCES);
export const sourceName = (id) => SOURCES[id]?.name ?? id;
export const enabledSources = (env) => sourceList.filter((s) => (typeof s.enabled === 'function' ? s.enabled(env) : true));
