-- The crawl canary looks up the longest in-stock row per source; without these it scanned the whole stock table.
CREATE INDEX IF NOT EXISTS stores_source ON stores (source);
CREATE INDEX IF NOT EXISTS stock_store_in ON stock (store_id, in_stock, in_since);
