-- One demo restock push to the owner's own devices (pushDemoOnce in src/jobs/index.js), sent by the next minute cron.
INSERT INTO settings (key, value, updated_at) VALUES ('push.demo', 'pending', 0)
  ON CONFLICT(key) DO UPDATE SET value = 'pending', updated_at = 0;
