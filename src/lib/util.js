export function slugify(text) {
  return String(text)
    .normalize('NFKD')
    .replace(/[̀-ͯ]/g, '')
    .toLowerCase()
    .replace(/&/g, ' and ')
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 80);
}

// Retailers name the same box differently:
//   Target:  "Pokémon Trading Card Game: Mega Evolution Elite Trainer Box"
//   Walmart: "Collectible Pokemon Trading Card Games Mega Evolution Elite Trainer Box | …"
//   GameStop:"Pokemon Trading Card Game: Mega Evolution Elite Trainer Box"
// canonicalTitle() reduces all of them to "Mega Evolution Elite Trainer Box" so
// listings from different retailers land on the same product page.
export function canonicalTitle(raw) {
  let t = decodeEntities(raw).replace(/[™®©]/g, '').trim();
  t = t.split(/\s[|–]\s/)[0];                                   // drop marketing tails after " | "
  t = t.replace(/^collectible\s+/i, '');
  t = t.replace(/^(the\s+)?pok[eé]mon\s*(company\s*)?(international\s*)?/i, '');
  t = t.replace(/^[:\-–]\s*/, '');
  t = t.replace(/^(tcg|trading card games?|trading cards?)\s*[:\-–]?\s*/i, '');
  t = t.replace(/^[:\-–]\s*/, '');
  if (t === t.toUpperCase()) t = t.toLowerCase().replace(/\b\w/g, (c) => c.toUpperCase()); // ALL CAPS → Title Case
  t = t.replace(/\bETB\b/gi, 'Elite Trainer Box').replace(/\bSv(\d)/g, 'SV$1').replace(/\bEx\b/g, 'ex');
  return t.replace(/\s+/g, ' ').trim();
}

export const shortTitle = (t) => canonicalTitle(t);

// URL slug for a product page
export const productSlug = (title) => slugify(`pokemon ${canonicalTitle(title)}`);

export function decodeEntities(s) {
  return String(s ?? '')
    .replace(/&#(\d+);/g, (_, n) => String.fromCharCode(Number(n)))
    .replace(/&#x([0-9a-f]+);/gi, (_, n) => String.fromCharCode(parseInt(n, 16)))
    .replace(/&amp;/g, '&')
    .replace(/&quot;/g, '"')
    .replace(/&#39;|&apos;/g, "'")
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>');
}

const STATES = {
  alabama: 'AL', alaska: 'AK', arizona: 'AZ', arkansas: 'AR', california: 'CA', colorado: 'CO', connecticut: 'CT',
  delaware: 'DE', 'district of columbia': 'DC', florida: 'FL', georgia: 'GA', hawaii: 'HI', idaho: 'ID', illinois: 'IL',
  indiana: 'IN', iowa: 'IA', kansas: 'KS', kentucky: 'KY', louisiana: 'LA', maine: 'ME', maryland: 'MD',
  massachusetts: 'MA', michigan: 'MI', minnesota: 'MN', mississippi: 'MS', missouri: 'MO', montana: 'MT',
  nebraska: 'NE', nevada: 'NV', 'new hampshire': 'NH', 'new jersey': 'NJ', 'new mexico': 'NM', 'new york': 'NY',
  'north carolina': 'NC', 'north dakota': 'ND', ohio: 'OH', oklahoma: 'OK', oregon: 'OR', pennsylvania: 'PA',
  'rhode island': 'RI', 'south carolina': 'SC', 'south dakota': 'SD', tennessee: 'TN', texas: 'TX', utah: 'UT',
  vermont: 'VT', virginia: 'VA', washington: 'WA', 'west virginia': 'WV', wisconsin: 'WI', wyoming: 'WY',
};
/** "New York" → "NY"; "NY" stays "NY". */
export function stateCode(s) {
  if (!s) return null;
  const t = String(s).trim();
  return t.length === 2 ? t.toUpperCase() : STATES[t.toLowerCase()] ?? t;
}

export function escapeHtml(s) {
  return String(s ?? '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

export const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

// "4 min. ago", "3 hr. ago", "yesterday", "Oct 21"
export function timeAgo(ts, ref = Date.now()) {
  if (!ts) return 'never';
  const s = Math.round((ref - ts) / 1000);
  if (s < 60) return 'just now';
  const m = Math.round(s / 60);
  if (m < 60) return `${m} min. ago`;
  const h = Math.round(m / 60);
  if (h < 24) return `${h} hr. ago`;
  const d = Math.round(h / 24);
  if (d === 1) return 'yesterday';
  if (d < 7) return `${d} days ago`;
  return new Date(ts).toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
}

export function formatDuration(ms) {
  if (ms == null) return '—';
  const m = Math.round(ms / 60000);
  if (m < 1) return 'under a minute';
  if (m < 60) return `${m} min`;
  const h = Math.round(m / 6) / 10;
  if (h < 24) return `${h} hr`;
  return `${Math.round(h / 24)} days`;
}

export function median(values) {
  const v = values.filter((x) => x != null).sort((a, b) => a - b);
  if (!v.length) return null;
  const mid = Math.floor(v.length / 2);
  return v.length % 2 ? v[mid] : (v[mid - 1] + v[mid]) / 2;
}

export function formatUtc(ts) {
  return new Date(ts).toLocaleString('en-US', {
    month: 'short', day: 'numeric', hour: 'numeric', minute: '2-digit', timeZone: 'UTC',
  }) + ' UTC';
}

export function hourLabel(h) {
  const suffix = h < 12 ? 'AM' : 'PM';
  const hh = h % 12 === 0 ? 12 : h % 12;
  return `${hh} ${suffix}`;
}
