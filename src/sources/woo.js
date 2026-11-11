// Independent card shops running on WooCommerce (WordPress), online stock, any country.
// WooCommerce publishes a public Store API used by its own block themes:
//   /wp-json/wc/store/v1/products?search=…  → id, name, permalink, price, image and `is_in_stock`
// `_fields` keeps only what we read (the full answer carries every description: heavy on the paid proxy).
// Its search matches whole phrases poorly ("pokemon tin" finds nothing where "pokemon" finds tins),
// so each query is one short phrase, sorted newest first, 50 products a call.
// Same rules as Shopify shops: ids end with _<cc>, read through the relay + proxy, shared crawl budget.
import { sourceJson } from '../lib/net.js';

const Q = {
  en: ['pokemon', 'pokemon|2', 'delta reign', '30th celebration', 'elite trainer box'],
  de: ['pokemon', 'pokemon|2', 'delta-herrschaft', '30 jahre', 'top trainer box'],
  fr: ['pokemon', 'pokemon|2', 'regne delta', '30 ans', 'coffret dresseur'],
  nl: ['pokemon', 'pokemon|2', 'delta reign', '30th celebration', 'elite trainer box'],
  it: ['pokemon', 'pokemon|2', 'dominio delta', '30 anni', 'allenatore fuoriclasse'],
  es: ['pokemon', 'pokemon|2', 'dominio delta', '30 aniversario', 'entrenador elite'],
};
// no images: they triple the answer (10 KB instead of 3 KB for 50 products); product pages take theirs from other shops
const FIELDS = 'id,name,permalink,prices.price,prices.currency_minor_unit,is_in_stock';

const ENTITIES = { amp: '&', lt: '<', gt: '>', quot: '"', apos: "'", nbsp: ' ' };
export const decodeHtml = (s) => String(s ?? '')
  .replace(/&#(\d+);/g, (_, n) => String.fromCodePoint(Number(n)))
  .replace(/&#x([0-9a-f]+);/gi, (_, n) => String.fromCodePoint(parseInt(n, 16)))
  .replace(/&([a-z]+);/gi, (m, n) => ENTITIES[n.toLowerCase()] ?? m)
  .replace(/<[^>]+>/g, '').replace(/\s+/g, ' ').trim();

const money = (p) => {
  const v = Number(p?.price);
  return Number.isFinite(v) && v > 0 ? v / 10 ** Number(p?.currency_minor_unit ?? 2) : null;
};

/** One WooCommerce shop. `lang` picks the search words. */
export function woo({ id, name, domain, country, lang = 'en' }) {
  const api = `https://${domain}/wp-json/wc/store/v1/products`;
  return {
    id, name, kind: 'online', country, platform: 'woo', domain,
    queries: Q[lang] ?? Q.en,

    /** One product, for product checks and the restock watch. */
    async checkOnline(env, listing) {
      const j = await sourceJson(env, id, `${api}/${encodeURIComponent(listing.source_sku)}?_fields=${FIELDS}`);
      if (!j) return { inStock: false, gone: true };
      if (typeof j.is_in_stock !== 'boolean') return null;
      return { inStock: j.is_in_stock, price: money(j.prices) };
    },

    /** One search: "words" or "words|page". */
    async snapshot(env, q) {
      const [words, page = '1'] = String(q).split('|');
      const u = `${api}?${new URLSearchParams({ search: words, per_page: '50', page, orderby: 'date', order: 'desc', _fields: FIELDS })}`;
      const list = await sourceJson(env, id, u);
      return (Array.isArray(list) ? list : []).filter((p) => p?.id && p?.name && typeof p.is_in_stock === 'boolean').map((p) => ({
        item: {
          sourceSku: String(p.id), title: decodeHtml(p.name), price: money(p.prices),
          url: p.permalink ?? null, image: null,
        },
        inStock: p.is_in_stock,
      }));
    },
  };
}
