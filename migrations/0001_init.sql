-- 0001: everything the launch needs. Applied by the release workflow only.

-- Live settings and kill switches (change without a deploy).
CREATE TABLE settings (key TEXT PRIMARY KEY, value TEXT NOT NULL, updated_at INTEGER NOT NULL);
INSERT INTO settings (key, value, updated_at) VALUES
  ('crawl', 'on', 0),               -- kill switch: whole crawler
  ('alert_pipeline', 'on', 0),      -- kill switch: matching + delivery
  ('deliver_fanout', 'on', 0),      -- parallel senders for big waves
  ('email_pause', 'off', 0),        -- hold all non-essential email (Gmail 421 storms)
  ('bot_block', 'on', 0),           -- rate-limit store pages / api for scrapers
  ('budget.proxy', 'on', 0),        -- use PROXY_LIST when present
  ('budget.target', '30', 0),       -- calls per minute per source (raise after bake-off)
  ('budget.gamestop', '20', 0),
  ('budget.bestbuy', '60', 0),
  ('budget.pokemoncenter', '6', 0),
  ('budget.costco', '2', 0),
  ('codes.global_per_hour', '600', 0),
  ('codes.ip_per_hour', '6', 0);

-- Catalogue: a set (expansion) × SKU type. Restocks are per SKU.
CREATE TABLE sets (id INTEGER PRIMARY KEY, slug TEXT UNIQUE NOT NULL, name TEXT NOT NULL, created_at INTEGER NOT NULL);
CREATE TABLE skus (
  id INTEGER PRIMARY KEY, slug TEXT UNIQUE NOT NULL, name TEXT NOT NULL,
  set_id INTEGER REFERENCES sets(id), type TEXT NOT NULL,      -- etb, booster_box, booster_bundle, tin, collection, blister, deck, other
  msrp REAL, active INTEGER NOT NULL DEFAULT 1, created_at INTEGER NOT NULL);
CREATE TABLE listings (
  id INTEGER PRIMARY KEY, sku_id INTEGER NOT NULL REFERENCES skus(id), source TEXT NOT NULL,
  source_sku TEXT NOT NULL, title TEXT NOT NULL, url TEXT, price REAL,
  active INTEGER NOT NULL DEFAULT 1, last_seen INTEGER NOT NULL, UNIQUE (source, source_sku));
CREATE INDEX listings_sku ON listings (sku_id);

CREATE TABLE stores (
  id TEXT PRIMARY KEY,               -- "<source>:<store id>" or "<source>:online"
  source TEXT NOT NULL, slug TEXT UNIQUE NOT NULL, name TEXT NOT NULL,
  address TEXT, city TEXT, state TEXT, zip TEXT, lat REAL, lng REAL, metro TEXT,
  online INTEGER NOT NULL DEFAULT 0);
CREATE INDEX stores_metro ON stores (metro);

-- A lane = one thing the crawler reads: (listing, metro) for store sources, (listing, '') online.
CREATE TABLE lanes (
  source TEXT NOT NULL, listing_id INTEGER NOT NULL, metro TEXT NOT NULL DEFAULT '',
  last_checked_at INTEGER NOT NULL DEFAULT 0, last_status TEXT, PRIMARY KEY (listing_id, metro));
CREATE INDEX lanes_due ON lanes (source, last_checked_at);

-- Current state. A flip to sold-out waits for a second read (pending_out_at).
CREATE TABLE stock (
  listing_id INTEGER NOT NULL, store_id TEXT NOT NULL,
  in_stock INTEGER NOT NULL, qty INTEGER, price REAL, seen_at INTEGER NOT NULL, in_since INTEGER,
  pending_out_at INTEGER, flips TEXT NOT NULL DEFAULT '', quarantined_until INTEGER,
  PRIMARY KEY (listing_id, store_id));
CREATE INDEX stock_store ON stock (store_id);

-- History from minute one: every confirmed restock, with when it ended and the price.
CREATE TABLE restocks (
  id INTEGER PRIMARY KEY, listing_id INTEGER NOT NULL, sku_id INTEGER NOT NULL, store_id TEXT NOT NULL,
  source TEXT NOT NULL, started_at INTEGER NOT NULL, ended_at INTEGER, qty INTEGER, price REAL,
  market_price REAL, matched_at INTEGER);
CREATE INDEX restocks_sku ON restocks (sku_id, started_at);
CREATE INDEX restocks_store ON restocks (store_id, started_at);
CREATE INDEX restocks_time ON restocks (started_at);

-- Per-source health: canary result, blocks, stale flag.
CREATE TABLE source_health (
  source TEXT PRIMARY KEY, status TEXT NOT NULL DEFAULT 'unknown', -- ok | blocked | stale | unknown
  last_ok_at INTEGER, last_block_at INTEGER, last_error TEXT, calls_last_min INTEGER DEFAULT 0,
  canary_listing_id INTEGER, canary_store_id TEXT, updated_at INTEGER);

-- People and access
CREATE TABLE users (
  id INTEGER PRIMARY KEY, email TEXT UNIQUE NOT NULL, created_at INTEGER NOT NULL, email_verified INTEGER NOT NULL DEFAULT 0,
  google_sub TEXT, telegram_chat_id TEXT, telegram_link_token TEXT, push_endpoint TEXT, push_keys TEXT,
  first_source TEXT, last_email_alert_at INTEGER);
CREATE TABLE sessions (token_hash TEXT PRIMARY KEY, user_id INTEGER NOT NULL, created_at INTEGER NOT NULL, expires_at INTEGER NOT NULL);
CREATE TABLE login_codes (id INTEGER PRIMARY KEY, email TEXT NOT NULL, code_hash TEXT NOT NULL, ip TEXT, created_at INTEGER NOT NULL, used_at INTEGER, attempts INTEGER NOT NULL DEFAULT 0);
CREATE INDEX login_codes_email ON login_codes (email, created_at);
CREATE INDEX login_codes_ip ON login_codes (ip, created_at);

-- Paid access. Write the grant BEFORE any refund call, or alerts stop.
CREATE TABLE passes (
  id INTEGER PRIMARY KEY, user_id INTEGER NOT NULL, plan TEXT NOT NULL, -- solo | multi
  provider TEXT NOT NULL, provider_ref TEXT, status TEXT NOT NULL,         -- active | canceled | refunded_kept | expired
  starts_at INTEGER NOT NULL, ends_at INTEGER NOT NULL, renews INTEGER NOT NULL DEFAULT 1, created_at INTEGER NOT NULL,
  UNIQUE (provider, provider_ref));
CREATE TABLE payments (id INTEGER PRIMARY KEY, provider TEXT, provider_ref TEXT UNIQUE, user_id INTEGER, amount REAL, currency TEXT, kind TEXT, at INTEGER NOT NULL, raw TEXT);

-- Alerts: what a customer watches. kind = 'stores' (store list / metro) or 'online' (country-wide).
CREATE TABLE alerts (
  id INTEGER PRIMARY KEY, user_id INTEGER NOT NULL, kind TEXT NOT NULL,
  sku_id INTEGER, set_id INTEGER,                 -- one exact SKU, or any sealed product of a set (Multi)
  metro TEXT, store_ids TEXT,                     -- JSON list for stores alerts
  channels TEXT NOT NULL DEFAULT '["email"]',     -- push, telegram, email (email always captured)
  status TEXT NOT NULL DEFAULT 'active',          -- active | paused | deleted
  delete_reason TEXT, created_at INTEGER NOT NULL, updated_at INTEGER NOT NULL);
CREATE INDEX alerts_user ON alerts (user_id);

-- Claims: one row per alert × restock = the dedupe. Status shows delivery.
CREATE TABLE alert_sent (
  alert_id INTEGER NOT NULL, restock_id INTEGER NOT NULL, claimed_at INTEGER NOT NULL,
  status TEXT NOT NULL DEFAULT 'claimed',         -- claimed | sent | held | failed
  channels_ok TEXT, detected_to_sent_ms INTEGER, PRIMARY KEY (alert_id, restock_id));
CREATE TABLE dead_letters (id INTEGER PRIMARY KEY, queue TEXT, body TEXT, error TEXT, at INTEGER NOT NULL);

-- Email held for the 1-per-hour digest or a Gmail pause. Never dropped.
CREATE TABLE email_outbox (
  id INTEGER PRIMARY KEY, user_id INTEGER, to_email TEXT NOT NULL, kind TEXT NOT NULL,
  subject TEXT NOT NULL, text TEXT NOT NULL, not_before INTEGER NOT NULL, sent_at INTEGER, attempts INTEGER NOT NULL DEFAULT 0, last_error TEXT);
CREATE INDEX email_outbox_due ON email_outbox (sent_at, not_before);

-- Funnel leads (email captured at step 1, even if they never pay)
CREATE TABLE leads (email TEXT PRIMARY KEY, step TEXT NOT NULL, sku_id INTEGER, metro TEXT, source TEXT, created_at INTEGER NOT NULL, updated_at INTEGER NOT NULL, followed_up_at INTEGER);

-- Measurement without cookies: one row per event, rolled up hourly into mk_stats.
CREATE TABLE events (id INTEGER PRIMARY KEY, at INTEGER NOT NULL, visit TEXT, name TEXT NOT NULL, path TEXT, source TEXT, device TEXT, bot INTEGER NOT NULL DEFAULT 0, props TEXT);
CREATE INDEX events_at ON events (at);
CREATE TABLE mk_stats (hour INTEGER NOT NULL, metric TEXT NOT NULL, dim TEXT NOT NULL DEFAULT '', value REAL NOT NULL, PRIMARY KEY (hour, metric, dim));

-- Reports written by the nightly heal job and the monitor
CREATE TABLE reports (id INTEGER PRIMARY KEY, kind TEXT NOT NULL, at INTEGER NOT NULL, text TEXT NOT NULL);
