// Pokémon Center — online only. Validated 26/10/2026:
//  category pages embed their product list (code, name, price) in __NEXT_DATA__;
//  product pages /product/<code> carry JSON-LD availability.
// Queue-it during big drops: we watch the product page, we never enter the queue,
// and on 403/429 the source pauses (playbook §3.6).
import { sourceText, nextData, jsonLdProducts, offerAvailability } from '../lib/net.js';

const BASE = 'https://www.pokemoncenter.com';

/** Same platform in every country, under a locale prefix ('' for the US, '/en-gb', '/en-ca', '/en-au'). */
export function pokemonCenter({ id, country, prefix }) {
  const P = (path) => `${prefix}${path}`;
  return {
  id, name: 'Pokémon Center', kind: 'online', country,
  queries: [P('/category/trading-card-game'), P('/category/trading-card-game?page=2'), P('/category/new-releases')],
  titleNeedsPokemon: false,

  async search(env, path) {
    const html = await sourceText(env, id, `${BASE}${path}`);
    return (nextData(html)?.props?.initialState?.search?.results?.products ?? []).filter((p) => p.code && p.name).map((p) => ({
      sourceSku: p.code, title: p.name, price: p.purchasePrice?.amount ?? null, url: `${BASE}${P(`/product/${p.code}`)}`, image: p.images?.[0]?.url ?? p.image?.url ?? null,
    }));
  },

  async checkOnline(env, listing) {
    const html = await sourceText(env, id, `${BASE}${P(`/product/${listing.source_sku}`)}`, { headers: { referer: `${BASE}${P('/category/trading-card-game')}` } });
    if (!html) return { inStock: false, gone: true };
    const p = jsonLdProducts(html)[0];
    const a = offerAvailability(p);
    if (!a) return null; // unreadable page: no verdict, never "sold out" by default
    const offers = Array.isArray(p.offers) ? p.offers[0] : p.offers;
    return { inStock: a === 'in', price: offers?.price ? Number(offers.price) : null };
  },
};
}

export default pokemonCenter({ id: 'pokemoncenter', country: 'us', prefix: '' });
export const pokemonCenterUK = pokemonCenter({ id: 'pokemoncenter_uk', country: 'uk', prefix: '/en-gb' });
export const pokemonCenterCA = pokemonCenter({ id: 'pokemoncenter_ca', country: 'ca', prefix: '/en-ca' });
export const pokemonCenterAU = pokemonCenter({ id: 'pokemoncenter_au', country: 'au', prefix: '/en-au' });
