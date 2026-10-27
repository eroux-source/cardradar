-- 0002: several countries + the Japanese lottery calendar.
ALTER TABLE stores ADD COLUMN country TEXT NOT NULL DEFAULT 'us';
ALTER TABLE listings ADD COLUMN country TEXT NOT NULL DEFAULT 'us';
ALTER TABLE alerts ADD COLUMN country TEXT NOT NULL DEFAULT 'us';
ALTER TABLE users ADD COLUMN country TEXT;
ALTER TABLE users ADD COLUMN line_user_id TEXT;
ALTER TABLE users ADD COLUMN line_link_token TEXT;
ALTER TABLE leads ADD COLUMN country TEXT;
CREATE INDEX stores_country ON stores (country, online);
CREATE INDEX listings_country ON listings (country, sku_id);

-- Japan: shops announce lotteries (抽選), pre-orders (予約) and re-sales (再販) with an entry window.
CREATE TABLE lotteries (
  id INTEGER PRIMARY KEY, country TEXT NOT NULL DEFAULT 'jp', source TEXT NOT NULL,
  uid TEXT NOT NULL,                  -- stable id from the source (url or hash of title+window)
  kind TEXT NOT NULL DEFAULT 'lottery', -- lottery | preorder | resale
  title TEXT NOT NULL, product TEXT, set_name TEXT, set_slug TEXT, sku_id INTEGER,
  method TEXT,                        -- web | app | store | line | sns
  conditions TEXT,                    -- JSON list of short condition labels
  url TEXT, price INTEGER,
  opens_at INTEGER, closes_at INTEGER, results_at INTEGER,
  first_seen INTEGER NOT NULL, last_seen INTEGER NOT NULL, notified_open INTEGER, notified_close INTEGER,
  UNIQUE (source, uid));
CREATE INDEX lotteries_window ON lotteries (country, closes_at);
CREATE INDEX lotteries_set ON lotteries (set_slug);

INSERT INTO settings (key, value, updated_at) VALUES
  ('budget.pcojp', '2', 0), ('budget.joshin', '2', 0), ('budget.rakutenbooks', '2', 0),
  ('budget.kmart_au', '20', 0), ('budget.smyths_uk', '20', 0), ('budget.argos', '10', 0),
  ('budget.ebgames_au', '10', 0), ('budget.bestbuy_ca', '20', 0), ('budget.smyths_de', '15', 0),
  ('budget.pokemoncenter_uk', '4', 0), ('budget.pokemoncenter_ca', '4', 0)
ON CONFLICT(key) DO NOTHING;

-- one row per alert × lottery × moment (open / closing soon): the dedupe for lottery notices
CREATE TABLE lottery_sent (alert_id INTEGER NOT NULL, lottery_id INTEGER NOT NULL, moment TEXT NOT NULL, at INTEGER NOT NULL, channels_ok TEXT, PRIMARY KEY (alert_id, lottery_id, moment));
ALTER TABLE alerts ADD COLUMN set_slug TEXT;   -- Japan: lottery alerts per set (or NULL = every set)
ALTER TABLE listings ADD COLUMN image TEXT;   -- retailer's own product photo URL
