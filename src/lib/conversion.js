// Conversion by landing source and landing page: one row per visit (its first
// view = where it came from and where it landed), joined with what that visit
// did next. Aggregated in JS so one scan of the window answers both tables.
import { all } from './db.js';

const STEPS = ['out', 'signup', 'alert', 'checkout', 'paid'];

export async function conversion(env, since) {
  const rows = await all(env, `WITH f AS (
      SELECT visit, source, path, ROW_NUMBER() OVER (PARTITION BY visit ORDER BY at) AS rn
      FROM events WHERE name = 'view' AND bot = 0 AND at > ? AND visit IS NOT NULL AND visit != ''),
    a AS (
      SELECT visit, MAX(name = 'out') AS out, MAX(name = 'signup') AS signup, MAX(name IN ('free_alert', 'checkout_start')) AS alert,
        MAX(name = 'checkout_start') AS checkout, MAX(name = 'paid') AS paid
      FROM events WHERE at > ? AND name IN ('out', 'signup', 'free_alert', 'checkout_start', 'paid') AND visit IS NOT NULL GROUP BY visit)
    SELECT COALESCE(NULLIF(f.source, ''), 'direct') AS s, f.path AS path, a.out, a.signup, a.alert, a.checkout, a.paid
    FROM f LEFT JOIN a ON a.visit = f.visit WHERE f.rn = 1`, since, since).catch(() => []);
  const group = (key, limit) => {
    const m = new Map();
    for (const r of rows) {
      const k = r[key] ?? '?';
      const g = m.get(k) ?? { [key === 's' ? 'source' : 'page']: k, visits: 0, ...Object.fromEntries(STEPS.map((s) => [s, 0])) };
      g.visits++;
      for (const s of STEPS) g[s] += r[s] ? 1 : 0;
      m.set(k, g);
    }
    return [...m.values()].sort((x, y) => y.visits - x.visits).slice(0, limit);
  };
  return { visits: rows.length, by_source: group('s', 12), by_landing: group('path', 20) };
}

/** "12 visits → 3 clicks (25 %) → 1 alert" for /api/health */
export const convLine = (g) => {
  const pct = (n) => (g.visits ? `${Math.round((100 * n) / g.visits)} %` : '0 %');
  return `${g.source ?? g.page}: ${g.visits} visits → ${g.out} shop click (${pct(g.out)}) → ${g.signup} signup → ${g.alert} alert (${pct(g.alert)}) → ${g.paid} paid`;
};
