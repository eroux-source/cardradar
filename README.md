# Restock tracker — Pokémon TCG, US

Cloudflare Workers + D1 + Queues. Docs en français dans `docs/` (commence par `01-a-cliquer-par-eugene.md`).

Local:
```
npm install
npx wrangler d1 migrations apply cardradar --local
node scripts/seed-demo.mjs > /tmp/seed.sql && npx wrangler d1 execute cardradar --local --file /tmp/seed.sql   # demo data
npx wrangler dev        # .dev.vars: BILLING_PROVIDER=fake, DEV_TOOLS=1, ADMIN_KEY=…
```
Owner pages locally: `/owner/monitor?key=<ADMIN_KEY>`. Simulate a restock: `/dev/restock?sku=<slug>&metro=<metro>`.
Production: push to `main` (see `.github/workflows/release.yml`). Never deploy by hand.
