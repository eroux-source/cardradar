-- Heavy page queries (product list per country, popularity) computed once and shared by every isolate.
CREATE TABLE IF NOT EXISTS shared_cache (key TEXT PRIMARY KEY, value TEXT NOT NULL, at INTEGER NOT NULL);
-- "last restock of this listing at this store" (product pages): direct lookup instead of scanning the store's restocks.
CREATE INDEX IF NOT EXISTS restocks_listing ON restocks (listing_id, store_id, started_at);
