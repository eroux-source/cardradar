# Card Restock Tracker (cardradar)

Live site: https://cardrestocktracker.com. Pokémon TCG stock and restock tracker for 11 countries: us, uk, ca, au, de, fr, nl, it, es, mx, cl, plus a Japan lottery calendar. It reads about 190 independent online shops.

Owner: Eugène, eroux@kosmocgi.com. He writes in French. Reply in short, non-technical French and give results, not process.

## Deploy
- Pushing to `main` deploys through `.github/workflows/release.yml` (wrangler).
  - The container relay is redeployed only when the commit message contains `[relay]`.
  - Watch the run with `gh run watch <id> --exit-status`.
- Before pushing, check that the build passes: `npx esbuild@0.24.0 src/index.js --bundle --format=esm --platform=neutral --external:cloudflare:* --external:node:* --outfile=/tmp/b.js`.
- D1 migrations go in `migrations/`. The release workflow applies them.

## Read the live state (public, no key)
- `curl -s https://cardrestocktracker.com/api/health` returns:
  - traffic: `daily_7d`, `sources_7d`, `countries_7d`, `devices_7d`, `ai_landings_7d`, `top_pages_7d`;
  - clicks to shops: `out_shops_7d`, `out_products_7d`, `out_countries_7d`, `compare_all` (Amazon, eBay…);
  - accounts and funnel: `users`, `funnel_7d`, `wanted_channels`;
  - crawling and errors: `restocks_24h`, `proxy_mb` (daily Decodo use, cap 250 MB), `last_500`.
- Owner pages, once signed in on the site with the owner email:
  - `/owner/users`: accounts and leads;
  - `/owner/clicks?days=7`: outbound clicks by shop, product, country and page.
- GA4 property "Card Restock Tracker", measurement ID G-V4X0V6LLD5.
- A scheduled task sends a GA recap every 3 days.

## Architecture
- Cloudflare Worker (`src/index.js`) with D1, Queues and a container relay (`relay/`).
  - Shop requests go through a Node relay with undici and the Decodo ISP proxy.
  - Only `shop_*` sources use the proxy.
  - Traffic is gzip-compressed and capped by the `proxy.daily_mb` setting.
- Crawl plan (`src/crawler/plan.js`):
  - each shop does one search per hour, at most 1 call per minute per shop and 20 per minute in total;
  - products in stock are rechecked every 24 h, sold-out ones every hour;
  - HOT products (Delta Reign / ME06 and the 30th Celebration ETB) are rechecked every 10 min when sold out.
- Pages:
  - product and country pages: `src/web/pages/stock.js`;
  - where-to-buy guides (30th ETB, Delta Reign) in each country's language: `src/web/pages/where_buy.js`;
  - data pages and 30th Celebration pages: `src/web/pages/local_data.js` and `data_page.js`;
  - `llms.txt` and the sitemap: `src/seo/sitemap.js`.
- Speed and resilience:
  - public GET pages are edge-cached for 10 min, with a day-old stale copy as fallback;
  - DB reads are retried once when D1 is busy;
  - heavy queries (`allSkus`, `liveCountries`, `popularity`, `latestRestocks`) are memoized for a short time per isolate.
- Paid mode since 2026-11-05 (`FREE_ALERTS="0"`): instant email alerts are paid through Whop (Solo / Multi, 30 days); the free plan is one daily email for 1 product. Launch-era free alerts now fall back to the daily email.
  - Telegram and push come back once there is a first real purchase (Eugène's call).
  - `FREE_ALERTS="1"` switches back to launch mode (all alerts free and instant, up to 20 products).
  - Telegram and phone notifications were removed.
  - After subscribing, people are asked which other channels they want; the answers are counted in `wanted_channels`.
- Affiliate-ready links live in `src/web/affiliate.js`.
  - Worker variables: `AFF_AMAZON_<CC>`, `AFF_EBAY_CAMPID`, `AFF_TCGPLAYER`, `AFF_CARDMARKET`.
  - The footer disclosure appears automatically once any `AFF_` value is set.
  - Status (Nov 2026): affiliation is on hold. Focus on traffic first.
- Every click to another site is tracked as the event `out`, with host, sku, kind, page and cc.
- Physical stores are not read, so the cities and store pages 301-redirect to the live pages.

## Rules
- Never enter passwords, API keys or payment details, and never create accounts. The owner does that.
  - Secrets go into GitHub or Cloudflare secrets, set by him.
- Always show an email draft before sending anything to users. Send only after explicit approval.
- The repo is public: never print emails or personal data in workflow logs or annotations.
- Saving DNS changes in Cloudflare is done by the owner.
- Keep page claims accurate:
  - shop and country counts must match what we really check;
  - say "checked around the clock (sold-out items hourly)";
  - never claim that we read Target or GameStop store stock.

## Current goal
Grow traffic, mostly from ChatGPT and Google, and keep everything working.
- Delta Reign (ME06) English release: 2026-11-06.
- Local set names: Delta-Herrschaft (DE), Règne Delta (FR), Dominio Delta (IT, ES).
