// GameStop — store-level in/out. Validated 26/10/2026:
//  search: the Constructor.io search API gamestop.com calls (public key in its pages);
//  stock: the store finder; with productId it returns only stores holding the product.
import { sourceJson } from '../lib/net.js';
import { decodeEntities, stateCode } from '../lib/util.js';

const BASE = 'https://www.gamestop.com';
const FIND = `${BASE}/on/demandware.store/Sites-gamestop-us-Site/default/Stores-FindStores`;
const cache = new Map();
const mapStore = (s) => ({
  id: String(s.ID), name: decodeEntities(String(s.name ?? '').replace(/\s*-\s*GAMESTOP$/i, '')), address: s.address1 ?? null,
  city: s.city ?? null, state: stateCode(s.stateCode), zip: s.postalCode ?? null, lat: s.latitude ?? null, lng: s.longitude ?? null,
});

async function storesAround(env, zip) {
  const hit = cache.get(zip);
  if (hit && Date.now() - hit.at < 864e5) return hit.stores;
  const j = await sourceJson(env, 'gamestop', `${FIND}?radius=25&postalCode=${zip}&showMap=false`);
  const stores = (j?.stores ?? []).map(mapStore);
  cache.set(zip, { at: Date.now(), stores });
  return stores;
}

export default {
  id: 'gamestop', name: 'GameStop', kind: 'stores', country: 'us',
  queries: ['pokemon trading card game', 'pokemon elite trainer box', 'pokemon booster'],

  async search(env, keyword) {
    const key = env.GAMESTOP_SEARCH_KEY || 'key_FIW9YAimY77z5QEf';
    const j = await sourceJson(env, 'gamestop', `https://ac.cnstrc.com/search/${encodeURIComponent(keyword)}?key=${key}&c=ciojs-client-2&i=cr&s=1&num_results_per_page=60`, { headers: { origin: BASE, referer: `${BASE}/` } });
    return (j?.response?.results ?? []).map((x) => {
      const path = x.data?.url ?? ''; const pid = path.match(/\/(\d{5,8})\.html/)?.[1];
      return pid && { sourceSku: pid, title: decodeEntities(x.value ?? ''), price: x.data?.price ?? null, url: `${BASE}${path}`, image: x.data?.image_url?.replace('$thumb$', '$pdp$') ?? null };
    }).filter(Boolean);
  },

  async checkArea(env, listing, metro) {
    const all = await storesAround(env, metro.zip);
    const j = await sourceJson(env, 'gamestop', `${FIND}?radius=25&postalCode=${metro.zip}&source=pdp&productId=${listing.source_sku}&showMap=false`);
    const have = new Set((j?.stores ?? []).map((s) => String(s.ID)));
    return all.map((s) => ({ store: s, inStock: have.has(s.id), qty: null }));
  },
};
