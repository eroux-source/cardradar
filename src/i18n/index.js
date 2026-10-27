// t(cc) → strings for the country's language + formatters in its locale.
import en from './en.js';
import fr from './fr.js';
import de from './de.js';
import nl from './nl.js';
import it from './it.js';
import es from './es.js';
import ja from './ja.js';
import { COUNTRIES, money } from '../data/countries.js';

const DICTS = { en, fr, de, nl, it, es, ja };
const cache = {};

export function t(cc) {
  const c = COUNTRIES[cc] ?? COUNTRIES.us;
  if (cache[c.code]) return cache[c.code];
  const s = { ...en, ...(DICTS[c.lang] ?? {}) };
  if (!s.lot) s.lot = ja.lot; // lottery strings exist only in Japanese for now
  const loc = c.locale;
  const days = [...Array(7)].map((_, i) => new Intl.DateTimeFormat(loc, { weekday: 'long', timeZone: 'UTC' }).format(new Date(Date.UTC(2024, 0, 7 + i))));
  const hourFmt = new Intl.DateTimeFormat(loc, { hour: 'numeric', timeZone: 'UTC' });
  const whenFmt = new Intl.DateTimeFormat(loc, { month: 'short', day: 'numeric', hour: 'numeric', minute: '2-digit', timeZone: c.tz, timeZoneName: 'short' });
  const dateFmt = new Intl.DateTimeFormat(loc, { month: 'short', day: 'numeric', weekday: 'short', hour: 'numeric', minute: '2-digit', timeZone: c.tz });
  const listFmt = new Intl.ListFormat(loc, { style: 'long', type: 'conjunction' });
  const f = {
    ago(ts, ref = Date.now()) {
      if (!ts) return s.ago.never;
      const sec = Math.round((ref - ts) / 1000);
      if (sec < 60) return s.ago.now;
      const m = Math.round(sec / 60); if (m < 60) return s.ago.min(m);
      const h = Math.round(m / 60); if (h < 48) return s.ago.hr(h);
      return s.ago.day(Math.round(h / 24));
    },
    dur(ms) {
      if (ms == null) return '—';
      const m = Math.round(ms / 60000);
      if (m < 1) return s.dur.lt1;
      if (m < 60) return s.dur.min(m);
      const h = Math.round(m / 6) / 10; if (h < 24) return s.dur.hr(h);
      return s.dur.day(Math.round(h / 24));
    },
    hour: (h) => (h == null ? '—' : hourFmt.format(new Date(Date.UTC(2024, 0, 1, h)))),
    day: (i) => (i == null ? '' : days[i]),
    when: (ts) => whenFmt.format(ts),
    date: (ts) => dateFmt.format(ts),
    list: (a) => listFmt.format(a),
    money: (amount) => money(c.code, amount),
  };
  cache[c.code] = { ...s, f, cc: c };
  return cache[c.code];
}
