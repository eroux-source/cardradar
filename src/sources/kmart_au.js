// Kmart Australia — store-level stock levels (High / Medium / Low / Out).
// Endpoint documented in public code (gist t04glovern, 2023): POST api.kmart.com.au/gateway/graphql,
// operation getFindInStore { postcode, country, keycodes }. NOT yet validated by us (Kmart geo-blocks
// non-AU visitors): run /owner/bakeoff with Australian proxies before raising its budget.
import { sourceFetch } from '../lib/net.js';

const GQL = 'https://api.kmart.com.au/gateway/graphql';
const QUERY = 'query getFindInStore($input: FindInStoreQueryInput!) { findInStoreQuery(input: $input) { keycode inventory { locationName stockLevel locationId } } }';
const SEARCH = 'https://www.kmart.com.au/api/search?q=';

export default {
  id: 'kmart_au', name: 'Kmart', kind: 'stores', country: 'au',
  queries: ['pokemon elite trainer box', 'pokemon booster', 'pokemon trading card'],

  async search(env, q) {
    const res = await sourceFetch(env, 'kmart_au', `${SEARCH}${encodeURIComponent(q)}`, { headers: { accept: 'application/json', referer: 'https://www.kmart.com.au/' } });
    const j = res ? await res.json().catch(() => null) : null;
    return (j?.products ?? j?.results ?? []).map((p) => ({ sourceSku: String(p.keycode ?? p.id), title: p.name ?? p.title, price: p.price ?? null, url: p.url ? `https://www.kmart.com.au${p.url}` : null, image: p.image ?? null }))
      .filter((x) => x.sourceSku && x.title);
  },

  async checkArea(env, listing, metro) {
    const res = await sourceFetch(env, 'kmart_au', GQL, {
      method: 'POST', headers: { 'content-type': 'application/json', origin: 'https://www.kmart.com.au', referer: 'https://www.kmart.com.au/' },
      body: JSON.stringify({ operationName: 'getFindInStore', query: QUERY, variables: { input: { country: 'AU', postcode: metro.zip, keycodes: [listing.source_sku] } } }),
    });
    const j = res ? await res.json() : null;
    const inv = j?.data?.findInStoreQuery?.[0]?.inventory ?? [];
    return inv.map((s) => ({
      store: { id: String(s.locationId), name: s.locationName, city: metro.name, state: metro.state, zip: null },
      inStock: /high|medium|low/i.test(s.stockLevel ?? '') && !/out|no/i.test(s.stockLevel ?? ''), qty: null,
    }));
  },
};
