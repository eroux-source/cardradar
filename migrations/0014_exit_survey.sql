-- Exit survey on the plan step (2026-11-18): why people did not pay, and what they would pay.
ALTER TABLE feedback ADD COLUMN kind TEXT;
ALTER TABLE feedback ADD COLUMN reason TEXT;
ALTER TABLE feedback ADD COLUMN price REAL;
ALTER TABLE feedback ADD COLUMN currency TEXT;
ALTER TABLE feedback ADD COLUMN pay TEXT;
ALTER TABLE feedback ADD COLUMN plan TEXT;
