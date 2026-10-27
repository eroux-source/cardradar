-- 0003: free plan — one alert per person, matched restocks sent as one email a day.
ALTER TABLE alerts ADD COLUMN free INTEGER NOT NULL DEFAULT 0;
