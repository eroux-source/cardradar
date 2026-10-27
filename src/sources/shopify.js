// Independent card shops running on Shopify — online stock, any country.
// Shopify storefronts publish a public search endpoint used by their own search box:
//   /search/suggest.json?q=…&resources[type]=product  → title, handle, price, image, and `available`
// One call returns up to 10 products WITH their stock state, so these sources run as
// "snapshot" sources: each query is both discovery and a stock reading (no per-product calls).
// Shopify answers 429 to Cloudflare's shared addresses, so these go through any proxy we have (a US one is fine: Shopify is global).
import { sourceJson } from '../lib/net.js';

const Q = {
  en: ['pokemon elite trainer box', 'pokemon booster box', 'pokemon booster bundle', 'pokemon tin', 'pokemon collection box', 'pokemon booster pack'],
  de: ['pokemon top trainer box', 'pokemon display', 'pokemon booster bundle', 'pokemon tin box', 'pokemon kollektion', 'pokemon elite trainer box'],
  fr: ['pokemon coffret dresseur elite', 'pokemon display', 'pokemon booster', 'pokemon pokebox', 'pokemon coffret', 'pokemon elite trainer box'],
  nl: ['pokemon elite trainer box', 'pokemon booster box', 'pokemon booster bundle', 'pokemon tin', 'pokemon collection', 'pokemon display'],
  it: ['pokemon set allenatore fuoriclasse', 'pokemon box buste', 'pokemon booster bundle', 'pokemon tin', 'pokemon collezione', 'pokemon elite trainer box'],
  es: ['pokemon caja entrenador elite', 'pokemon caja de sobres', 'pokemon booster bundle', 'pokemon lata', 'pokemon coleccion', 'pokemon elite trainer box'],
  ja: ['ポケモンカード BOX', 'ポケモンカード 拡張パック', 'ポケモンカード ハイクラスパック', 'pokemon card box japanese'],
};

/** One Shopify shop. `lang` picks the search words. */
export function shopify({ id, name, domain, country, lang = 'en' }) {
  return {
    id, name, kind: 'online', country, platform: 'shopify', domain,
    queries: Q[lang] ?? Q.en,
    everyMinutes: 3, // one search every 3 min → each query re-read about every 18 min (proxy data is paid per GB)
    titleNeedsPokemon: lang === 'ja' ? false : undefined,

    async snapshot(env, q) {
      const u = `https://${domain}/search/suggest.json?${new URLSearchParams({ q, 'resources[type]': 'product', 'resources[limit]': '10', 'resources[options][unavailable_products]': 'last' })}`;
      const json = await sourceJson(env, id, u, { headers: { accept: 'application/json' } });
      return (json?.resources?.results?.products ?? []).filter((p) => p.handle && p.title && typeof p.available === 'boolean').map((p) => ({
        item: {
          sourceSku: p.handle, title: p.title, price: Number(p.price) || null,
          url: `https://${domain}/products/${p.handle}`,
          image: (p.featured_image?.url ?? p.image ?? null)?.replace(/^\/\//, 'https://') ?? null,
        },
        inStock: p.available,
      }));
    },
  };
}
