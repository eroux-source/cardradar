# Card Restock Tracker (cardradar)

Live site: https://cardrestocktracker.com. Pokémon TCG stock and restock tracker for 11 countries: us, uk, ca, au, de, fr, nl, it, es, mx, cl, plus a Japan lottery calendar. It reads about 240 independent online shops (list: `src/sources/shops.js`, Shopify by default, `platform: 'woo'` = WooCommerce; pages only name shops that answered in the last 3 days).

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
  - Shop readers: `src/sources/shopify.js` (`/search/suggest.json`, `/products/<handle>.js`) and `src/sources/woo.js` (WooCommerce Store API `/wp-json/wc/store/v1/products`, `_fields` filter, no images: about 3 KB per 50 products). Many French shops are PrestaShop or answer 403: not readable.
  - New shops run their first searches spread over about 12 hours (1 per minute per shop); then each query once a day. Rip & ship, breaks, event tickets are dropped (`notSealed` in `src/crawler/catalog.js`); listings of shops removed from the list are switched off by the hourly merge job.
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
- Free again since 2026-11-06 (Eugène): launch mode `FREE_ALERTS="1"`, alerts free and instant by email (Resend), up to 20 products. Paid mode was live 2026-11-05 → 06 with 0 sales; traffic first.
  - Paid mode stays ready: `FREE_ALERTS="0"` = Whop Solo / Multi. Whop plans per currency: `WHOP_PLAN_<SOLO|MULTI>_<EUR|GBP|CAD|AUD>` in `wrangler.toml`; MX, CL and JP pay the USD plan.
  - Alert funnel order: 1 product → 2 plan → 3 email. Solo / free alerts can be limited to chosen shops (plan step, `/api/funnel/shops`, `alerts.store_ids`, empty = every shop).
  - Telegram was removed. Phone notifications are back as free Web Push (2026-11-11), see below.
  - After subscribing, people are asked which other channels they want; the answers are counted in `wanted_channels`.
- Installable app + free push (2026-11-11):
  - `/manifest.webmanifest?c=<cc>` (worker, `src/web/pwa.js`): one app (`id: /`), start page = country home, PNG icons 192/512/maskable + `apple-touch-icon.png` in `public/`.
  - `public/sw.js`: notifications only, NO fetch handler and no cache (edge cache and SEO unchanged). Registered only on `/alerts`, `/account` and inside the installed app.
  - Web Push in `src/alerts/channels/push.js`: VAPID ES256 + aes128gcm, WebCrypto only. Public key `VAPID_PUBLIC_KEY` in `wrangler.toml`, private key = secret `VAPID_PRIVATE_KEY` (base64url of the 32-byte scalar, set by Eugène). Devices in D1 `push_subs` (migration 0009), deleted on 404/410.
  - Sent at the same moment as the restock email (`src/alerts/deliver.js`), never instead of it. Alerts with `push` in `alerts.channels` go to every device of the account.
  - UI: tick box « Recevoir aussi en notification » in the alert form and a « Notifications sur cet appareil » block on `/account` (on / test / off, Android install button, iPhone Share → « Sur l'écran d'accueil » card). 6 languages.
  - Visible to the owner only until the setting `push_public` is `on` (switch on `/owner/monitor`).
  - Alert texts (email, push, hourly digest) are in the language of the alert's country: `src/alerts/words.js` (en, fr, de, es for es/mx/cl, it, nl).
  - Numbers: `/api/health` → `push` (devices, `funnel_7d`: pwa_hint, pwa_prompt, pwa_install, push_optin, push_sent, push_click; `alerts_7d`: tried, delivered, dead_removed).
- Support page (2026-11-07): `/support` and `/<cc>/support` (`src/web/pages/support.js`, fan tone, 6 languages), linked in every footer and after an alert is set. One-time Whop tips 1/2/5 in EUR (Europe, UK) or USD (elsewhere), product Support Card Restock Tracker (`TIP_PLANS`). The webhook records tips (event `tip_paid`) and never grants a pass; clicks are the event `tip`.
- Visitor feedback (2026-11-11): block at the bottom of every public page plus a floating 💬 button (`src/web/feedback.js`, 6 languages): missing country, next card game to track, free comment, optional email. Saved in D1 `feedback` (max 5 per network per hour). Counts in `/api/health` → `feedback_30d` (never texts or emails); every answer on `/owner/feedback`.
- Affiliate-ready links live in `src/web/affiliate.js`.
  - Worker variables: `AFF_AMAZON_<CC>`, `AFF_EBAY_CAMPID`, `AFF_TCGPLAYER`, `AFF_CARDMARKET`.
  - The footer disclosure appears automatically once any `AFF_` value is set.
  - Status (Nov 2026): affiliation is on hold. Focus on traffic first.
- Every click to another site is tracked as the event `out`, with host, sku, kind, page and cc.
- Physical stores are not read, so the cities and store pages 301-redirect to the live pages.
- One page per product (2026-11-06): `src/lib/catalog.js` names single booster packs, 3-pack blisters and Build & Battle boxes per set too, and strips shop notes (limit 2, pre-order, rip and ship, language tags, dates). `src/crawler/merge.js` runs hourly: it moves listings, alerts, leads and restocks to the right page and writes `sku_redirects` (old slug → kept slug, served as 301). Status in `/api/health` → `merge`, `redirects`.
- Pages only name online shops that returned data in the last 3 days (`refreshLive` in `src/sources/index.js`); store-by-store sources are never named.
- The deploy workflow reads the commit message from env (fixed 2026-11-06), so any message is safe. The gh token here has no workflow scope: edit `.github/workflows/*` through the GitHub web editor (Eugène is signed in to GitHub in the app's browser).

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
