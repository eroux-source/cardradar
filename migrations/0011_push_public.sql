-- 2026-11-11: end-to-end test passed on Eugène's iPhone (install, opt-in, demo restock push received). He said: "Reçue, ouvre à tous".
-- The push option is now offered to everyone. Switch back off on /owner/monitor if needed.
INSERT INTO settings (key, value, updated_at) VALUES ('push_public', 'on', 0)
  ON CONFLICT(key) DO UPDATE SET value = 'on', updated_at = 0;
