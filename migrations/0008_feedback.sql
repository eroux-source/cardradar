-- Visitor feedback (2026-11-11): missing country, next card game to track, free comment, optional email.
CREATE TABLE IF NOT EXISTS feedback (
  id INTEGER PRIMARY KEY, at INTEGER NOT NULL, cc TEXT, page TEXT, visit TEXT, ip_hash TEXT,
  country TEXT, game TEXT, text TEXT, email TEXT);
CREATE INDEX IF NOT EXISTS feedback_at ON feedback (at);
