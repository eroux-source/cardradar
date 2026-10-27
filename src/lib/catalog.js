// Catalogue model from the playbook: a product is a SET × SKU TYPE.
// "Collectible Pokemon Trading Card Games Scarlet & Violet 8 Surging Sparks Booster Bundle"
//   → set "Surging Sparks", type "booster_bundle", sku slug "surging-sparks-booster-bundle".
// Customers on Multi can watch "any sealed product of set X".

import { canonicalTitle, slugify } from './util.js';
import { KNOWN_SETS } from '../data/sets.js';

export const SKU_TYPES = [
  // order matters: most specific first. English + the words shops use in DE / FR / NL / IT / ES.
  ['booster_box', /\b(booster display box|booster box|display box|booster display|display|caja de sobres|caja de 36|box di buste|box da 36|36 (sobres|buste|boosters?|packs?))\b/i, 'Booster Box'],
  ['etb', /\b(elite trainer box|etb|top[- ]trainer[- ]box|coffret dresseur d['’]?\s?[ée]lite|set allenatore fuoriclasse|caja (de )?entrenador [ée]lite)\b/i, 'Elite Trainer Box'],
  ['booster_bundle', /\b(booster bundle|bundle de boosters?|booster-bundle|lote de sobres)\b/i, 'Booster Bundle'],
  ['blister', /\b(blister|3-pack|3 pack|checklane|tripack|tri-pack)\b/i, 'Blister'],
  ['tin', /\b(mini[- ]tins?|tins?|tin[- ]box|pok[ée]box|lata|scatola in latta)\b/i, 'Tin'],
  ['upc', /\b(ultra[- ]premium collection|upc|super[- ]premium collection|spc)\b/i, 'Ultra-Premium Collection'],
  ['collection', /\b(collection|box set|premium box|special box|kollektion|coffret|collezione|colecci[óo]n)\b/i, 'Collection'],
  ['deck', /\b(battle deck|theme deck|deck|build & battle|build and battle|mazzo|mazo)\b/i, 'Deck'],
  ['booster', /\b(booster pack|sleeved booster|booster|sobre|busta|bustina)\b/i, 'Booster Pack'],
];

/** Language edition when it is not the shop's usual one (Asian editions are sold everywhere). */
export function edition(title) {
  const t = String(title);
  if (/japanese|japan(?:ese)? version|\bjp\b|\bjpn\b|japanisch|japonais|giapponese|japon[ée]s|[\u3040-\u30ff]/i.test(t)) return 'Japanese';
  if (/simplified chinese|\bs-?chinese\b|chinese|chinois|chinesisch|cinese|chino|[\u4e00-\u9fff]/i.test(t)) return 'Chinese';
  if (/korean|cor[ée]en|koreanisch|coreano|[\uac00-\ud7af]/i.test(t)) return 'Korean';
  if (/thai\b/i.test(t)) return 'Thai';
  return null;
}

export const typeLabel = (type) => SKU_TYPES.find((t) => t[0] === type)?.[2] ?? 'Product';

export function skuType(title) {
  for (const [type, re] of SKU_TYPES) if (re.test(title)) return type;
  return 'other';
}

const LANG_TAGS = /[\s(\[]*\b(de|deu|ger|german|deutsch|fr|fra|french|fran[cç]ais|ita?|italian[oa]?|es|esp|spanish|espa[ñn]ol|en|eng|english|englisch|nl|dutch|jp|jpn|japanese|cn|chinese|kr|korean)\b[)\]]*/gi;
const NOISE = /\b(pok[ée]mon|tcg|trading card game|sammelkartenspiel|jcc|gcc|cartes?|karten|carte|cartas|ita|eng|deu|esp|fra|version|edition|[ée]dition|sealed|new|neu|neuf|nuovo|nuevo|pre-?order|vorbestellung|pr[ée]commande|preventa|prevendita)\b/gi;

/** Best guess of the set (expansion) name from a canonical title, in any of the shop languages. */
export function setName(title) {
  const t = canonicalTitle(title).replace(LANG_TAGS, ' ').replace(/\s{2,}/g, ' ').trim();
  let m = null; for (const [, re] of SKU_TYPES) { m = t.match(re); if (m) break; }
  const clean = (x) => x.replace(/\bscarlet\s*&\s*violet\s*(\d+(\.\d+)?)?\s*[:\-–]?\s*/i, '').replace(/\bsword\s*&\s*shield\s*(\d+(\.\d+)?)?\s*[:\-–]?\s*/i, '')
    .replace(/\bkarmesin\s*&\s*purpur\s*[:\-–]?\s*/i, '').replace(/\b[ée]carlate\s*(et|&)\s*violet\s*[:\-–]?\s*/i, '').replace(/\bscarlatto\s*e\s*violetto\s*[:\-–]?\s*/i, '').replace(/\bescarlata\s*y\s*p[úu]rpura\s*[:\-–]?\s*/i, '')
    .replace(NOISE, ' ').replace(/[“”"«»]/g, '').replace(/\s*\([^)]*\)\s*/g, ' ').replace(/\s{2,}/g, ' ').replace(/^[\s:\-–|,.]+|[\s:\-–|,.(]+$/g, '').trim();
  let set = clean(m ? t.slice(0, m.index) : t);
  if (m && set.length < 3) set = clean(t.slice(m.index + m[0].length).replace(/^\s*(de|di|del|des|du|d['’])\s+/i, ''));
  return set.length >= 3 && set.length <= 40 ? set : null;
}

function knownSet(raw) {
  const t = String(raw).toLowerCase().replace(/[‐-―]/g, '-');
  // longest alias first so "sv8.5" wins over "sv8"
  const hits = KNOWN_SETS.flatMap((s) => s.aliases.map((a) => ({ s, a }))).sort((x, y) => y.a.length - x.a.length);
  return hits.find(({ a }) => new RegExp(`(^|[^a-z0-9.])${a.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}([^a-z0-9.]|$)`).test(t))?.s.name ?? null;
}

/** Everything the catalogue needs from one retailer title. */
// "Mega Evolution—Delta Reign", "Scarlet & Violet: Surging Sparks": the series name before a
// dash or colon is not the set; drop it so "Delta Reign" is found (and not the base set).
const SERIES_PREFIX = /\b(mega[- ]?evolution|mega[- ]?entwicklung|m[ée]ga[- ]?[ée]volution|megaevoluzione|megaevoluci[óo]n|scarlet\s*&\s*violet|sword\s*&\s*shield|karmesin\s*&\s*purpur|[ée]carlate\s*(et|&)\s*violet|scarlatto\s*e\s*violetto|escarlata\s*y\s*p[úu]rpura)\s*(\d+(\.\d+)?)?\s*[—–:|\-]\s*(?=\S)/i;

export function classify(rawTitle) {
  const title = String(rawTitle).replace(SERIES_PREFIX, '');
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
  // Asian editions are different products: say it in the name (and the URL)
  const ed = edition(rawTitle);
  if (ed && !name.toLowerCase().includes(ed.toLowerCase())) name = `${name} (${ed})`;
  // URLs: non-Latin names (Japanese…) keep a short hash so two products never share a slug
  const slug = (x) => { const sl = slugify(x); return /[^\u0000-\u024f]/.test(x) ? `${sl ? `${sl}-` : ''}${hash(x)}` : sl; };
  return { name, type, set, setSlug: set ? slug(set) : null, skuSlug: slug(name), edition: ed };
}

function hash(x) { let h = 2166136261; for (const c of String(x)) { h ^= c.codePointAt(0); h = Math.imul(h, 16777619); } return (h >>> 0).toString(36); }
