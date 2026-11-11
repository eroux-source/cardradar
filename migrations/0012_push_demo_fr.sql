-- One more demo restock push to the owner's own devices, to check the translated text (French store first).
INSERT INTO settings (key, value, updated_at) VALUES ('push.demo', 'pending', 0)
  ON CONFLICT(key) DO UPDATE SET value = 'pending', updated_at = 0;
