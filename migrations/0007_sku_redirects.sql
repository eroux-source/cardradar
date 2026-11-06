-- Product pages merged into one (2026-11-06): the old address redirects (301) to the kept one.
CREATE TABLE IF NOT EXISTS sku_redirects (old_slug TEXT PRIMARY KEY, new_slug TEXT NOT NULL, created_at INTEGER NOT NULL);
