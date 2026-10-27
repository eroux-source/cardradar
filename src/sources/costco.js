// Costco.com — online only (warehouse stock is published nowhere).
// Validated 26/10/2026: product pages carry JSON-LD availability. Search is
// rendered client-side from a private API and returned NO Pokémon cards that
// day, so discovery is manual: put product URLs in the `costco.urls` setting
// (comma-separated) from /owner when a bundle appears.
import { sourceText, jsonLdProducts, offerAvailability } from '../lib/net.js';
import { settings } from '../lib/db.js';

export default {
  id: 'costco', name: 'Costco', kind: 'online',
  queries: [],
  async dynamicQueries(env) {
    return String((await settings(env))['costco.urls'] ?? '').split(',').map((s) => s.trim()).filter(Boolean);
  },

  async search(env, url) {
    const html = await sourceText(env, 'costco', url);
    const p = jsonLdProducts(html)[0];
    const id = url.match(/product\.(\d+)\.html/)?.[1];
    return p && id ? [{ sourceSku: id, title: p.name, price: Number((Array.isArray(p.offers) ? p.offers[0] : p.offers)?.price) || null, url }] : [];
  },

  async checkOnline(env, listing) {
    const html = await sourceText(env, 'costco', listing.url);
    if (!html) return { inStock: false, gone: true };
    const a = offerAvailability(jsonLdProducts(html)[0]);
    return a ? { inStock: a === 'in' } : null;
  },
};
