// Walmart.com — online stock of products SOLD BY WALMART (resellers filtered out).
// Validated 26/10/2026: one search page returns availability for every listed
// product. Rate-limits hard (waiting room / HTTP 429 after ~10 calls per IP):
// keep budget.walmart low and use proxies.
// In-store multi-store stock: one store per session cookie. Not built yet;
// see docs/sources.md "Walmart en magasin".
import { sourceText, nextData, SourceError } from '../lib/net.js';

const BASE = 'https://www.walmart.com';

export default {
  id: 'walmart', name: 'Walmart', kind: 'online',
  queries: ['pokemon trading card game', 'pokemon elite trainer box', 'pokemon booster bundle', 'pokemon collection'],

  /** listings + availability in one request */
  async snapshot(env, keyword) {
    const html = await sourceText(env, 'walmart', `${BASE}/search?q=${encodeURIComponent(keyword)}&facet=retailer_type%3AWalmart`, { headers: { referer: `${BASE}/` } });
    if (!html) return [];
    if (/robot or human|press & hold|vpwaitingroom/i.test(html)) throw new SourceError('walmart', 429, BASE, 'bot challenge');
    const stacks = nextData(html)?.props?.pageProps?.initialData?.searchResult?.itemStacks ?? [];
    return stacks.flatMap((s) => s.items ?? []).filter((i) => i.usItemId && /walmart\.com/i.test(i.sellerName ?? '')).map((i) => ({
      item: { sourceSku: String(i.usItemId), title: i.name, price: i.price ?? null, url: i.canonicalUrl ? `${BASE}${i.canonicalUrl.split('?')[0]}` : `${BASE}/ip/${i.usItemId}` },
      inStock: (i.availabilityStatusV2?.value ?? i.availabilityStatusDisplayValue) === 'IN_STOCK',
    }));
  },

  async search(env, keyword) { return (await this.snapshot(env, keyword)).map((x) => x.item); },
};
