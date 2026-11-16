-- Eugène 2026-11-16: 50 "still free until 23 November" emails today, the rest tomorrow.
-- The first deploy queued all of them for today; move the ones not sent yet to 2026-11-17 14:00 UTC.
UPDATE email_outbox SET not_before = 1794924000000 WHERE kind = 'grace_notice' AND sent_at IS NULL;
