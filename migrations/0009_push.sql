-- Web push (2026-11-11): one row per device that accepted notifications.
-- A device belongs to one account; every alert of that account with 'push' in
-- alerts.channels is sent to all its devices, at the same moment as the email.
-- Rows are deleted when the push service answers 404/410 (device gone).
CREATE TABLE IF NOT EXISTS push_subs (
  id INTEGER PRIMARY KEY,
  user_id INTEGER NOT NULL,
  endpoint TEXT UNIQUE NOT NULL,
  p256dh TEXT NOT NULL,            -- device public key (base64url)
  auth TEXT NOT NULL,              -- device auth secret (base64url)
  device TEXT,                     -- ios | android | desktop
  standalone INTEGER NOT NULL DEFAULT 0, -- subscribed from the installed app
  created_at INTEGER NOT NULL,
  last_ok_at INTEGER,
  fails INTEGER NOT NULL DEFAULT 0);
CREATE INDEX IF NOT EXISTS push_subs_user ON push_subs (user_id);

-- Off until the end-to-end test is done: only the owner sees the push option.
INSERT OR IGNORE INTO settings (key, value, updated_at) VALUES ('push_public', 'off', 0);
