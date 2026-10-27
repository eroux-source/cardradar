// Best Buy — OFFICIAL developer API (developer.bestbuy.com), free key in BESTBUY_API_KEY.
// Store availability lists only stores that can do pickup; we list all stores
// of the area once a day and mark the others sold out. No quantities.
import { sourceJson } from '../lib/net.js';

const API = 'https://api.bestbuy.com/v1';
const cache = new Map();

async function storesAround(env, zip) {
  const hit = cache.get(zip);
  if (hit && Date.now() - hit.at < 864e5) return hit.stores;
  const j = await sourceJson(env, 'bestbuy', `${API}/stores(area(${zip},30))?apiKey=${env.BESTBUY_API_KEY}&format=json&pageSize=30&show=storeId,name,address,city,region,postalCode,lat,lng`, { useProxy: false });
  const stores = (j?.stores ?? []).map((s) => ({ id: String(s.storeId), name: s.name, address: s.address, city: s.city, state: s.region, zip: s.postalCode, lat: s.lat, lng: s.lng }));
  cache.set(zip, { at: Date.now(), stores });
  return stores;
}

export default {
  id: 'bestbuy', name: 'Best Buy', kind: 'stores',
  enabled: (env) => Boolean(env.BESTBUY_API_KEY),
  queries: ['pokemon trading card', 'pokemon elite trainer box', 'pokemon booster'],

  async search(env, keyword) {
    const terms = keyword.split(/\s+/).map((w) => `search=${encodeURIComponent(w)}`).join('&');
    const j = await sourceJson(env, 'bestbuy', `${API}/products(${terms})?apiKey=${env.BESTBUY_API_KEY}&format=json&pageSize=50&show=sku,name,salePrice,url`, { useProxy: false });
    return (j?.products ?? []).map((p) => ({ sourceSku: String(p.sku), title: p.name, price: p.salePrice ?? null, url: p.url ?? null }));
  },

  async checkArea(env, listing, metro) {
    const all = await storesAround(env, metro.zip);
    const j = await sourceJson(env, 'bestbuy', `${API}/products/${listing.source_sku}/stores.json?postalCode=${metro.zip}&apiKey=${env.BESTBUY_API_KEY}`, { useProxy: false });
    const avail = new Set((j?.stores ?? []).map((s) => String(s.storeID ?? s.storeId)));
    return all.map((s) => ({ store: s, inStock: avail.has(s.id), qty: null }));
  },
};
