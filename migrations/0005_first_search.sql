-- Shops already crawled do not need the one-off first search that new shops get.
INSERT INTO settings (key, value, updated_at) SELECT 'firstsearch.' || source, '0', 0 FROM listings GROUP BY source ON CONFLICT(key) DO NOTHING;
