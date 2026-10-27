// Target — store-level stock with quantities.
// Validated 26/10/2026 from a browser: plp_search_v2 (search) and fiats_v1
// (~20 stores around a ZIP per call). State comes as a full name, no coordinates.
import { sourceJson } from '../lib/net.js';
import { decodeEntities, stateCode } from '../lib/util.js';

const BASE = 'https://redsky.target.com/redsky_aggregations/v1/web';
const HEADERS = { origin: 'https://www.target.com', referer: 'https://www.target.com/' };
const visitor = () => crypto.randomUUID().replace(/-/g, '').toUpperCase();
const call = (env, endpoint, params) => sourceJson(env, 'target',
  `${BASE}/${endpoint}?${new URLSearchParams({ key: env.TARGET_KEY || '9f36aeafbe60771e321a7cc95a78140772ab3e96', channel: 'WEB', visitor_id: visitor(), ...params })}`,
  { headers: HEADERS });

export default {
  id: 'target', name: 'Target', kind: 'stores', country: 'us',
  queries: ['pokemon trading card game', 'pokemon elite trainer box', 'pokemon booster bundle', 'pokemon booster box', 'pokemon tin', 'pokemon collection'],

  async search(env, keyword) {
    const json = await call(env, 'plp_search_v2', { keyword, count: '24', offset: '0', page: `/s/${keyword}`, pricing_store_id: '1771' });
    return (json?.data?.search?.products ?? []).map((p) => ({
      sourceSku: String(p.tcin), title: decodeEntities(p.item?.product_description?.title ?? ''),
      price: p.price?.current_retail ?? null, url: p.item?.enrichment?.buy_url ?? `https://www.target.com/p/-/A-${p.tcin}`,
      image: JSON.stringify(p.item?.enrichment ?? {}).match(/https:\/\/target\.scene7\.com\/is\/image\/Target\/[A-Za-z0-9_-]+/)?.[0] ?? null,
    }));
  },

  async checkArea(env, listing, metro) {
    const json = await call(env, 'fiats_v1', {
      tcin: listing.source_sku, nearby: metro.zip, radius: '30', limit: '20',
      include_only_available_stores: 'false', requested_quantity: '1',
    });
    return (json?.data?.fulfillment_fiats?.locations ?? []).map((l) => {
      const s = l.store ?? {}; const a = s.mailing_address ?? {};
      const status = l.in_store_only?.availability_status ?? l.order_pickup?.availability_status ?? '';
      if (status === 'NOT_SOLD_IN_STORE') return null;
      const qty = Math.max(0, Math.floor(Number(l.location_available_to_promise_quantity ?? 0)));
      return {
        store: { id: String(l.location_id ?? s.store_id), name: decodeEntities(s.location_name ?? ''), address: a.address_line1 ?? null,
          city: a.city ?? null, state: stateCode(a.region ?? a.state), zip: a.postal_code?.slice(0, 5) ?? null },
        inStock: qty > 0, qty,
      };
    }).filter((x) => x?.store.id);
  },
};

/**
 * Target online (ship to home), read from the same search call, which Target serves to
 * datacenter addresses (the store-by-store call does not). Each search returns ~24 products
 * with their shipping status, so this runs as a snapshot source. No verdict = item skipped.
 */
export const targetOnline = {
  id: 'target_online', name: 'Target', kind: 'online', country: 'us', listed: false, // shown under Target
  queries: ['pokemon trading card game', 'pokemon elite trainer box', 'pokemon booster bundle', 'pokemon booster box', 'pokemon tin', 'pokemon collection'],
  async snapshot(env, keyword) {
    const json = await call(env, 'plp_search_v2', { keyword, count: '24', offset: '0', page: `/s/${keyword}`, pricing_store_id: '1771', store_ids: '1771,2768,1375', zip: '55403' });
    return (json?.data?.search?.products ?? []).map((p) => {
      const ship = p.fulfillment?.shipping_options?.availability_status;
      if (!ship) return null;
      return {
        item: {
          sourceSku: String(p.tcin), title: decodeEntities(p.item?.product_description?.title ?? ''),
          price: p.price?.current_retail ?? null, url: p.item?.enrichment?.buy_url ?? `https://www.target.com/p/-/A-${p.tcin}`,
          image: JSON.stringify(p.item?.enrichment ?? {}).match(/https:\/\/target\.scene7\.com\/is\/image\/Target\/[A-Za-z0-9_-]+/)?.[0] ?? null,
        },
        inStock: ship === 'IN_STOCK' || ship === 'LIMITED_STOCK',
      };
    }).filter(Boolean);
  },
};
