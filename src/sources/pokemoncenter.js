// Pokémon Center — online only. Validated 26/10/2026:
//  category pages embed their product list (code, name, price) in __NEXT_DATA__;
//  product pages /product/<code> carry JSON-LD availability.
// Queue-it during big drops: we watch the product page, we never enter the queue,
// and on 403/429 the source pauses (playbook §3.6).
import { sourceText, nextData, jsonLdProducts, offerAvailability } from '../lib/net.js';

const BASE = 'https://www.pokemoncenter.com';

export default {
  id: 'pokemoncenter', name: 'Pokémon Center', kind: 'online',
  queries: ['/category/trading-card-game', '/category/trading-card-game?page=2', '/category/trading-card-game?page=3', '/category/new-releases'],
  titleNeedsPokemon: false,

  async search(env, path) {
    const html = await sourceText(env, 'pokemoncenter', `${BASE}${path}`);
    return (nextData(html)?.props?.initialState?.search?.results?.products ?? []).filter((p) => p.code && p.name).map((p) => ({
      sourceSku: p.code, title: p.name, price: p.purchasePrice?.amount ?? null, url: `${BASE}/product/${p.code}`,
    }));
  },

  async checkOnline(env, listing) {
    const html = await sourceText(env, 'pokemoncenter', `${BASE}/product/${listing.source_sku}`, { headers: { referer: `${BASE}/category/trading-card-game` } });
    if (!html) return { inStock: false, gone: true };
    const p = jsonLdProducts(html)[0];
    const a = offerAvailability(p);
    if (!a) return null; // unreadable page: no verdict, never "sold out" by default
    const offers = Array.isArray(p.offers) ? p.offers[0] : p.offers;
    return { inStock: a === 'in', price: offers?.price ? Number(offers.price) : null };
  },
};
