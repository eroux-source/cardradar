// Catalogue model from the playbook: a product is a SET × SKU TYPE.
// "Collectible Pokemon Trading Card Games Scarlet & Violet 8 Surging Sparks Booster Bundle"
//   → set "Surging Sparks", type "booster_bundle", sku slug "surging-sparks-booster-bundle".
// Customers on Multi can watch "any sealed product of set X".

import { canonicalTitle, slugify } from './util.js';
import { KNOWN_SETS } from '../data/sets.js';

export const SKU_TYPES = [
  // order matters: most specific first
  ['booster_box', /\b(booster display box|booster box|display box|booster display)\b/i, 'Booster Box'],
  ['etb', /\b(elite trainer box|etb)\b/i, 'Elite Trainer Box'],
  ['booster_bundle', /\bbooster bundle\b/i, 'Booster Bundle'],
  ['blister', /\b(blister|3-pack|3 pack|checklane)\b/i, 'Blister'],
  ['tin', /\b(mini tins?|tins?)\b/i, 'Tin'],
  ['upc', /\b(ultra[- ]premium collection|upc)\b/i, 'Ultra-Premium Collection'],
  ['collection', /\b(collection|box set|premium box|special box)\b/i, 'Collection'],
  ['deck', /\b(battle deck|theme deck|deck|build & battle|build and battle)\b/i, 'Deck'],
  ['booster', /\b(booster pack|sleeved booster|booster)\b/i, 'Booster Pack'],
];

export const typeLabel = (type) => SKU_TYPES.find((t) => t[0] === type)?.[2] ?? 'Product';

export function skuType(title) {
  for (const [type, re] of SKU_TYPES) if (re.test(title)) return type;
  return 'other';
}

/** Best guess of the set (expansion) name from a canonical title. */
export function setName(title) {
  let t = canonicalTitle(title);
  // drop the type words and everything after them
  for (const [, re] of SKU_TYPES) {
    const m = t.match(re);
    if (m) { t = t.slice(0, m.index); break; }
  }
  t = t.replace(/\bscarlet\s*&\s*violet\s*(\d+(\.\d+)?)?\s*[:\-–]?\s*/i, '')   // "Scarlet & Violet 8 Surging Sparks" → "Surging Sparks"
    .replace(/\bsword\s*&\s*shield\s*(\d+(\.\d+)?)?\s*[:\-–]?\s*/i, '')
    .replace(/[:\-–|,(]+\s*$/, '')
    .trim();
  return t.length >= 3 ? t : null;
}

function knownSet(raw) {
  const t = String(raw).toLowerCase().replace(/[‐-―]/g, '-');
  // longest alias first so "sv8.5" wins over "sv8"
  const hits = KNOWN_SETS.flatMap((s) => s.aliases.map((a) => ({ s, a }))).sort((x, y) => y.a.length - x.a.length);
  return hits.find(({ a }) => new RegExp(`(^|[^a-z0-9.])${a.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}([^a-z0-9.]|$)`).test(t))?.s.name ?? null;
}

/** Everything the catalogue needs from one retailer title. */
export function classify(title) {
  const canonical = canonicalTitle(title);
  const type = skuType(canonical);
  const set = knownSet(title) ?? setName(canonical);
  // Clean product name when we know both set and type, so every retailer's
  // wording of "the Mega Evolution ETB" lands on the same page.
  // Only for types that exist once per set; collections, decks and blisters
  // come in many variants per set and keep their full name.
  let name = canonical;
  if (set && ['etb', 'booster_box', 'booster_bundle', 'tin'].includes(type)) {
    let label = typeLabel(type);
    if (type === 'tin' && /\bmini\b/i.test(title)) label = 'Mini Tin';
    name = `${set} ${label}`;
    if (/pok[eé]mon center|\bexclusive\b/i.test(title)) name += ' (Pokémon Center Exclusive)';
  }
  return { name, type, set, setSlug: set ? slugify(set) : null, skuSlug: slugify(name) };
}
