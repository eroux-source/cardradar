// Best Buy Canada — online stock of items SOLD BY BEST BUY (marketplace filtered out).
// Validated 27/10/2026 from a browser: /api/v2/json/search (JSON, products with isMarketplace)
// and /ecomm-api/availability/products (shipping.status InStockOnlineOnly / SoldOutOnline,
// quantityRemaining). The HTML pages are geo-blocked outside Canada: proxies needed.
import { sourceJson } from '../lib/net.js';

const BASE = 'https://www.bestbuy.ca';

export default {
  id: 'bestbuy_ca', name: 'Best Buy', kind: 'online', country: 'ca',
  queries: ['pokemon trading card game', 'pokemon elite trainer box', 'pokemon booster', 'pokemon tin'],

  async search(env, q) {
    const j = await sourceJson(env, 'bestbuy_ca', `${BASE}/api/v2/json/search?lang=en-CA&page=1&pageSize=48&query=${encodeURIComponent(q)}&sortBy=relevance&sortDir=desc`, { headers: { referer: `${BASE}/en-ca` } });
    return (j?.products ?? []).filter((p) => !p.isMarketplace).map((p) => ({
      sourceSku: String(p.sku), title: p.name, price: p.salePrice ?? p.regularPrice ?? null, url: `${BASE}${p.productUrl}`, image: p.highResImage ?? p.thumbnailImage ?? null,
    }));
  },

  async checkOnline(env, listing) {
    const j = await sourceJson(env, 'bestbuy_ca', `${BASE}/ecomm-api/availability/products?accept=application%2Fvnd.bestbuy.standardproduct.v1%2Bjson&accept-language=en-CA&postalCode=M5H2N2&skus=${listing.source_sku}`, { headers: { referer: `${BASE}/en-ca` } });
    const a = j?.availabilities?.[0];
    if (!a?.shipping?.status) return null;
    return { inStock: /InStock/i.test(a.shipping.status) && a.shipping.purchasable !== false, price: null };
  },
};
