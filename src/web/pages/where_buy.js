// "Where to buy X" pages, one per country in its language, plus an English overview of every country.
// Written for the exact question people ask assistants ("wo bekomme ich die 30 Jahre Top-Trainer-Box?"):
// answer first with today's shops and prices (cheapest first), by edition, then the table, then an alert.
import { escapeHtml as e } from '../../lib/util.js';
import { COUNTRIES } from '../../data/countries.js';
import { t } from '../../i18n/index.js';
import { all, now } from '../../lib/db.js';
import * as d from '../data.js';
import { page, answers, home } from '../html.js';
import { sealed } from './local_data.js';
import { freeMode } from '../free.js';
import { affiliateBlock } from '../affiliate.js';

const shopName = (n) => String(n ?? '').replace(/ online$/, '');

/** The products we answer for. match = our product names; slug per language. */
export const GUIDES = {
  '30th-etb': {
    match: (n) => /30th|30\s*jahre|30\s*ans|30\s*anni|30\s*aniversario|30\s*jaar|30\s*years/i.test(n) && /elite\s*trainer|top[-\s]*trainer|\betb\b|coffret\s*dresseur|allenatore\s*fuoriclasse|entrenador\s*[eé]lite/i.test(n),
    slug: { en: 'where-to-buy-30th-celebration-elite-trainer-box', de: 'wo-kaufen-30-jahre-top-trainer-box', fr: 'ou-acheter-coffret-dresseur-elite-30-ans', it: 'dove-comprare-set-allenatore-fuoriclasse-30-anni', es: 'donde-comprar-caja-entrenador-elite-30-aniversario', nl: 'waar-kopen-30-jaar-elite-trainer-box' },
    name: { en: 'Pokémon 30th Celebration Elite Trainer Box', de: 'Pokémon 30 Jahre Top-Trainer-Box (30th Celebration Elite Trainer Box)', fr: 'Coffret Dresseur d\'Élite Pokémon 30 ans (30th Celebration Elite Trainer Box)', it: 'Set Allenatore Fuoriclasse Pokémon 30 anni (30th Celebration Elite Trainer Box)', es: 'Caja de Entrenador Élite Pokémon 30 aniversario (30th Celebration Elite Trainer Box)', nl: 'Pokémon 30 jaar Elite Trainer Box (30th Celebration)' },
    short: { en: '30th Celebration ETB', de: '30 Jahre Top-Trainer-Box', fr: 'coffret Dresseur d\'Élite 30 ans', it: 'Set Allenatore Fuoriclasse 30 anni', es: 'Caja de Entrenador Élite 30 aniversario', nl: '30 jaar Elite Trainer Box' },
  },
  // next expansion (English street date 2026-11-06): pages exist before release so they are indexed when people start asking
  'delta-reign': {
    multi: true, release: '2026-11-06',
    match: (n) => /delta[\s-]*reign|delta[\s-]*herrschaft|r[eè]gne\s*delta|dominio\s*delta|\bME\s?0?6\b/i.test(n),
    slug: { en: 'where-to-buy-delta-reign', de: 'wo-kaufen-delta-reign-delta-herrschaft', fr: 'ou-acheter-regne-delta', it: 'dove-comprare-dominio-delta', es: 'donde-comprar-dominio-delta', nl: 'waar-kopen-delta-reign' },
    old: { fr: 'ou-acheter-delta-reign', it: 'dove-comprare-delta-reign', es: 'donde-comprar-delta-reign' },
    name: { en: 'Pokémon TCG Mega Evolution—Delta Reign', de: 'Pokémon Mega-Entwicklung: Delta-Herrschaft (ME06, Delta Reign)', fr: 'Pokémon Méga-Évolution Règne Delta (ME06, Delta Reign)', it: 'Pokémon Megaevoluzione Dominio Delta (ME06, Delta Reign)', es: 'Pokémon Megaevolución Dominio Delta (ME06, Delta Reign)', nl: 'Pokémon Mega Evolution Delta Reign (ME06)' },
    short: { en: 'Delta Reign', de: 'Delta-Herrschaft (Delta Reign)', fr: 'Règne Delta', it: 'Dominio Delta', es: 'Dominio Delta', nl: 'Delta Reign' },
  },
};
const REL = { en: (d) => `English release: ${d}. Booster boxes, Elite Trainer Boxes and bundles appear here as soon as shops list them (pre-orders included).`,
  de: (d) => `Englischer Release: ${d}. Displays, Top-Trainer-Boxen und Bundles erscheinen hier, sobald Shops sie listen (auch Vorbestellungen).`,
  fr: (d) => `Sortie en anglais : ${d}. Displays, coffrets Dresseur d'Élite et bundles apparaissent ici dès que les boutiques les listent (précommandes comprises).`,
  it: (d) => `Uscita in inglese: ${d}. Box, Set Allenatore Fuoriclasse e bundle compaiono qui appena i negozi li elencano (preordini inclusi).`,
  es: (d) => `Lanzamiento en inglés: ${d}. Cajas de sobres, Cajas de Entrenador Élite y bundles aparecen aquí en cuanto las tiendas los listan (preventas incluidas).`,
  nl: (d) => `Engelse release: ${d}. Booster boxes, Elite Trainer Boxes en bundels verschijnen hier zodra winkels ze tonen (pre-orders inbegrepen).` };
// Key facts shown on the guide (sources: TCGplayer "Delta Reign Quick Facts", Pokébip, WikiDex). English dates; local editions may differ.
const FACTS = {
  'delta-reign': {
    en: ['Key facts', ['Set: Mega Evolution—Delta Reign (ME06).', 'English release: November 6, 2026 (prereleases October 24 to November 5).', 'Headline card: Mega Rayquaza ex (Special Illustration Rare and Mega Hyper Rare).', 'Products: Booster Box, Elite Trainer Box (US MSRP $49.99), Pokémon Center Elite Trainer Box, Booster Bundle ($26.94), Build & Battle Box ($21.99), blisters.', 'Names: Delta-Herrschaft (German), Règne Delta (French), Dominio Delta (Italian, Spanish).']],
    de: ['Das Wichtigste', ['Set: Mega-Entwicklung Delta-Herrschaft (ME06), englisch „Delta Reign“.', 'Englischer Release: 6. November 2026 (Prereleases 24. Oktober bis 5. November).', 'Topkarte: Mega-Rayquaza-ex (Special Illustration Rare und Mega Hyper Rare).', 'Produkte: Display, Top-Trainer-Box, Pokémon Center Top-Trainer-Box, Booster-Bundle, Build & Battle Box, Blister.']],
    fr: ['L\'essentiel', ['Extension : Méga-Évolution Règne Delta (ME06), « Delta Reign » en anglais.', 'Sortie en anglais : 6 novembre 2026 (avant-premières du 24 octobre au 5 novembre).', 'Carte phare : Méga-Rayquaza-ex (Illustration Spéciale Rare et Méga Hyper Rare).', 'Produits : display, coffret Dresseur d\'Élite, coffret Dresseur d\'Élite Pokémon Center, booster bundle, coffret Build & Battle, blisters.']],
    it: ['In breve', ['Espansione: Megaevoluzione Dominio Delta (ME06), in inglese “Delta Reign”.', 'Uscita in inglese: 6 novembre 2026 (prerelease dal 24 ottobre al 5 novembre).', 'Carta di punta: Mega Rayquaza-ex (Illustrazione Speciale Rara e Mega Iper Rara).', 'Prodotti: box di buste, Set Allenatore Fuoriclasse, Set Allenatore Fuoriclasse Pokémon Center, booster bundle, Build & Battle Box, blister.']],
    es: ['Lo esencial', ['Expansión: Megaevolución Dominio Delta (ME06), en inglés “Delta Reign”.', 'Lanzamiento en inglés: 6 de noviembre de 2026 (presentaciones del 24 de octubre al 5 de noviembre).', 'Carta estrella: Mega-Rayquaza ex (Ilustración Especial Rara y Mega Hiper Rara).', 'Productos: caja de sobres, Caja de Entrenador Élite, Caja de Entrenador Élite Pokémon Center, booster bundle, Build & Battle Box, blísteres.']],
    nl: ['Kort', ['Set: Mega Evolution—Delta Reign (ME06).', 'Engelse release: 6 november 2026 (prereleases 24 oktober t/m 5 november).', 'Topkaart: Mega Rayquaza ex (Special Illustration Rare en Mega Hyper Rare).', 'Producten: booster box, Elite Trainer Box, Pokémon Center Elite Trainer Box, booster bundle, Build & Battle Box, blisters.']],
  },
};
const factsHtml = (id, lang) => { const f = FACTS[id]?.[lang] ?? FACTS[id]?.en; return f ? `<section><h2>${e(f[0])}</h2><ul>${f[1].map((x) => `<li>${e(x)}</li>`).join('')}</ul></section>` : ''; };
export const guidePath = (cc, id) => `/${cc}/${GUIDES[id].slug[COUNTRIES[cc]?.lang] ?? GUIDES[id].slug.en}`;
export const guideIdForSlug = (lang, slug) => Object.keys(GUIDES).find((id) => (GUIDES[id].slug[lang] ?? GUIDES[id].slug.en) === slug) ?? null;
/** A slug we used before (renamed to the local set name): redirect. */
export const guideOldSlug = (lang, slug) => Object.keys(GUIDES).find((id) => GUIDES[id].old?.[lang] === slug) ?? null;

/** edition from the product name: which language the cards are printed in */
const EDITION = [['de', /jahre|top[-\s]*trainer|\(de\)|deutsch/i], ['fr', /30\s*ans|coffret|\(fr\)|français|francais/i], ['it', /30\s*anni|allenatore|\(it\)|italian/i], ['es', /aniversario|entrenador|\(es\)|españ|espan/i], ['nl', /30\s*jaar|\(nl\)/i], ['ja', /japan|japon|\(jp\)|日本/i]];
const editionOf = (name) => EDITION.find(([, re]) => re.test(name))?.[0] ?? 'en';

const L = {
  en: { prod: 'Product', ed: { en: 'English edition', de: 'German edition', fr: 'French edition', it: 'Italian edition', es: 'Spanish edition', nl: 'Dutch edition', ja: 'Japanese edition' },
    h1: (p, c) => `Where to buy the ${p} in ${c}`, upd: (w) => `Updated ${w} · from the shops' own stock, re-checked every hour`,
    yes: (w, p, n, list, cheap) => `As of ${w}, the ${p} is in stock at ${n} independent card shop${n > 1 ? 's' : ''}: ${list}. Cheapest right now: ${cheap}.`,
    no: (w, p, n) => `As of ${w}, the ${p} is sold out at all ${n} card shops we check. Set a free alert below and we tell you the moment one restocks.`,
    none: (p) => `We have not found the ${p} at the shops we check yet.`,
    th: ['Shop', 'Edition', 'Price', 'Stock'], in: 'In stock', out: 'Sold out', alert: 'Get a free alert when it is back', alertPaid: 'Get an alert when it is back', buy: 'Buy',
    q1: (p, c) => `Where can I buy the ${p} in ${c} right now?`, q2: (p) => `How much does the ${p} cost?`, a2: (lo, hi) => `At independent shops today: from ${lo}${hi ? ` to ${hi}` : ''}. Prices above the shelf price are common while stock is short.`,
    q3: (p) => `How fast does the ${p} sell out?`, a3: (d) => `Restocks we measured stayed in stock for ${d} (median). Check the shops above or set an alert.`, a3n: 'We are still measuring how long its restocks last: every restock is re-checked every 10 minutes until it sells out.',
    other: 'Other countries', all: 'All countries' },
  de: { prod: 'Produkt', ed: { en: 'Englische Version', de: 'Deutsche Version', fr: 'Französische Version', it: 'Italienische Version', es: 'Spanische Version', nl: 'Niederländische Version', ja: 'Japanische Version' },
    h1: (p, c) => `Wo kaufen: ${p} in ${c}`, upd: (w) => `Aktualisiert ${w} · Bestand direkt aus den Shops, stündlich geprüft`,
    yes: (w, p, n, list, cheap) => `Stand ${w}: ${p} ist bei ${n} unabhängigen Kartenläden auf Lager: ${list}. Gerade am günstigsten: ${cheap}.`,
    no: (w, p, n) => `Stand ${w}: ${p} ist bei allen ${n} geprüften Kartenläden ausverkauft. Richte unten einen kostenlosen Alarm ein, wir melden uns beim nächsten Restock.`,
    none: (p) => `Wir haben ${p} bei den geprüften Shops noch nicht gefunden.`,
    th: ['Shop', 'Version', 'Preis', 'Bestand'], in: 'Auf Lager', out: 'Ausverkauft', alert: 'Kostenlosen Alarm einrichten', alertPaid: 'Alarm einrichten', buy: 'Kaufen',
    q1: (p, c) => `Wo bekomme ich die ${p} gerade in ${c}?`, q2: (p) => `Was kostet die ${p}?`, a2: (lo, hi) => `Heute bei unabhängigen Shops: ab ${lo}${hi ? ` bis ${hi}` : ''}. Aufpreise über UVP sind üblich, solange die Ware knapp ist.`,
    q3: (p) => `Wie schnell ist die ${p} ausverkauft?`, a3: (d) => `Gemessene Restocks blieben im Mittel ${d} verfügbar. Schau bei den Shops oben oder richte einen Alarm ein.`, a3n: 'Wir messen noch, wie lange Restocks dauern: jeder Restock wird alle 10 Minuten geprüft, bis er ausverkauft ist.',
    other: 'Andere Länder', all: 'Alle Länder' },
  fr: { prod: 'Produit', ed: { en: 'Version anglaise', de: 'Version allemande', fr: 'Version française', it: 'Version italienne', es: 'Version espagnole', nl: 'Version néerlandaise', ja: 'Version japonaise' },
    h1: (p, c) => `Où acheter le ${p} en ${c}`, upd: (w) => `Mis à jour le ${w} · stock relevé directement chez les boutiques, toutes les heures`,
    yes: (w, p, n, list, cheap) => `Au ${w}, le ${p} est en stock dans ${n} boutique${n > 1 ? 's' : ''} indépendante${n > 1 ? 's' : ''} : ${list}. Le moins cher en ce moment : ${cheap}.`,
    no: (w, p, n) => `Au ${w}, le ${p} est en rupture dans les ${n} boutiques que nous suivons. Activez une alerte gratuite ci-dessous : on vous prévient au prochain réassort.`,
    none: (p) => `Nous n'avons pas encore trouvé le ${p} dans les boutiques suivies.`,
    th: ['Boutique', 'Version', 'Prix', 'Stock'], in: 'En stock', out: 'Rupture', alert: 'Alerte gratuite au retour en stock', alertPaid: 'Alerte au retour en stock', buy: 'Acheter',
    q1: (p, c) => `Où trouver le ${p} en ${c} en ce moment ?`, q2: (p) => `Combien coûte le ${p} ?`, a2: (lo, hi) => `Aujourd'hui en boutique indépendante : à partir de ${lo}${hi ? ` et jusqu'à ${hi}` : ''}. Les prix au-dessus du prix conseillé sont fréquents tant que le stock est rare.`,
    q3: (p) => `En combien de temps le ${p} est-il épuisé ?`, a3: (d) => `Les réassorts mesurés sont restés en stock ${d} (médiane). Regardez les boutiques ci-dessus ou activez une alerte.`, a3n: 'Mesure en cours : chaque réassort est revérifié toutes les 10 minutes jusqu\'à la rupture.',
    other: 'Autres pays', all: 'Tous les pays' },
  it: { prod: 'Prodotto', ed: { en: 'Edizione inglese', de: 'Edizione tedesca', fr: 'Edizione francese', it: 'Edizione italiana', es: 'Edizione spagnola', nl: 'Edizione olandese', ja: 'Edizione giapponese' },
    h1: (p, c) => `Dove comprare il ${p} in ${c}`, upd: (w) => `Aggiornato ${w} · disponibilità letta dai negozi, ogni ora`,
    yes: (w, p, n, list, cheap) => `Al ${w}, il ${p} è disponibile in ${n} negozi indipendenti: ${list}. Il più economico ora: ${cheap}.`,
    no: (w, p, n) => `Al ${w}, il ${p} è esaurito in tutti i ${n} negozi che controlliamo. Attiva un avviso gratuito qui sotto.`,
    none: (p) => `Non abbiamo ancora trovato il ${p} nei negozi controllati.`,
    th: ['Negozio', 'Edizione', 'Prezzo', 'Disponibilità'], in: 'Disponibile', out: 'Esaurito', alert: 'Avviso gratuito quando torna', alertPaid: 'Avviso quando torna', buy: 'Compra',
    q1: (p, c) => `Dove trovo il ${p} in ${c} adesso?`, q2: (p) => `Quanto costa il ${p}?`, a2: (lo, hi) => `Oggi nei negozi indipendenti: da ${lo}${hi ? ` a ${hi}` : ''}.`,
    q3: (p) => `Quanto velocemente si esaurisce il ${p}?`, a3: (d) => `I restock misurati sono rimasti disponibili ${d} (mediana).`, a3n: 'Stiamo ancora misurando: ogni restock viene ricontrollato ogni 10 minuti.',
    other: 'Altri paesi', all: 'Tutti i paesi' },
  es: { prod: 'Producto', ed: { en: 'Edición en inglés', de: 'Edición alemana', fr: 'Edición francesa', it: 'Edición italiana', es: 'Edición en español', nl: 'Edición neerlandesa', ja: 'Edición japonesa' },
    h1: (p, c) => `Dónde comprar la ${p} en ${c}`, upd: (w) => `Actualizado ${w} · stock leído en las tiendas, cada hora`,
    yes: (w, p, n, list, cheap) => `A ${w}, la ${p} está en stock en ${n} tienda${n > 1 ? 's' : ''} independiente${n > 1 ? 's' : ''}: ${list}. La más barata ahora: ${cheap}.`,
    no: (w, p, n) => `A ${w}, la ${p} está agotada en las ${n} tiendas que seguimos. Activa una alerta gratuita abajo.`,
    none: (p) => `Todavía no hemos encontrado la ${p} en las tiendas que seguimos.`,
    th: ['Tienda', 'Edición', 'Precio', 'Stock'], in: 'En stock', out: 'Agotado', alert: 'Alerta gratuita cuando vuelva', alertPaid: 'Alerta cuando vuelva', buy: 'Comprar',
    q1: (p, c) => `¿Dónde consigo la ${p} en ${c} ahora?`, q2: (p) => `¿Cuánto cuesta la ${p}?`, a2: (lo, hi) => `Hoy en tiendas independientes: desde ${lo}${hi ? ` hasta ${hi}` : ''}.`,
    q3: (p) => `¿Qué tan rápido se agota la ${p}?`, a3: (d) => `Las reposiciones medidas duraron ${d} (mediana).`, a3n: 'Aún medimos: cada reposición se revisa cada 10 minutos hasta agotarse.',
    other: 'Otros países', all: 'Todos los países' },
  nl: { prod: 'Product', ed: { en: 'Engelse editie', de: 'Duitse editie', fr: 'Franse editie', it: 'Italiaanse editie', es: 'Spaanse editie', nl: 'Nederlandse editie', ja: 'Japanse editie' },
    h1: (p, c) => `Waar koop je de ${p} in ${c}`, upd: (w) => `Bijgewerkt ${w} · voorraad rechtstreeks uit de winkels, elk uur`,
    yes: (w, p, n, list, cheap) => `Per ${w} is de ${p} op voorraad bij ${n} onafhankelijke kaartwinkel${n > 1 ? 's' : ''}: ${list}. Nu het goedkoopst: ${cheap}.`,
    no: (w, p, n) => `Per ${w} is de ${p} uitverkocht bij alle ${n} winkels die we volgen. Zet hieronder een gratis melding aan.`,
    none: (p) => `We hebben de ${p} nog niet gevonden bij de winkels die we volgen.`,
    th: ['Winkel', 'Editie', 'Prijs', 'Voorraad'], in: 'Op voorraad', out: 'Uitverkocht', alert: 'Gratis melding als hij terug is', alertPaid: 'Melding als hij terug is', buy: 'Kopen',
    q1: (p, c) => `Waar vind ik de ${p} nu in ${c}?`, q2: (p) => `Wat kost de ${p}?`, a2: (lo, hi) => `Vandaag bij onafhankelijke winkels: vanaf ${lo}${hi ? ` tot ${hi}` : ''}.`,
    q3: (p) => `Hoe snel is de ${p} uitverkocht?`, a3: (d) => `Gemeten restocks bleven ${d} beschikbaar (mediaan).`, a3n: 'We meten nog: elke restock wordt elke 10 minuten gecontroleerd.',
    other: 'Andere landen', all: 'Alle landen' },
};
const Lof = (cc) => L[COUNTRIES[cc]?.lang] ?? L.en;
const countryIn = (cc) => new Intl.DisplayNames([COUNTRIES[cc].lang], { type: 'region' }).of(cc === 'uk' ? 'GB' : cc.toUpperCase());

/** Every shop listing of the guide's products in one country, with stock and price. */
async function offers(env, cc, id) {
  const G = GUIDES[id];
  const skus = (await d.allSkus(env, cc)).filter((k) => sealed(k) && G.match(k.name));
  if (!skus.length) return { skus, rows: [] };
  const rows = await all(env, `SELECT l.sku_id, k.name AS product, k.slug, s.name AS shop, x.in_stock, COALESCE(x.price, l.price) AS price, l.url, x.seen_at
    FROM stock x JOIN listings l ON l.id = x.listing_id AND l.active = 1 JOIN stores s ON s.id = x.store_id JOIN skus k ON k.id = l.sku_id
    WHERE s.country = ? AND l.sku_id IN (${skus.map((k) => Number(k.id)).join(',')}) ORDER BY x.in_stock DESC, price`, cc);
  return { skus, rows: rows.map((r) => ({ ...r, edition: editionOf(r.product) })) };
}

export async function guidePage(env, cc, id) {
  const G = GUIDES[id]; const T = t(cc); const W = Lof(cc); const lang = COUNTRIES[cc].lang;
  const ts = now(); const w = T.f.when(ts); const C = countryIn(cc);
  const P = G.name[lang] ?? G.name.en; const PS = G.short[lang] ?? G.short.en;
  const { skus, rows } = await offers(env, cc, id);
  const rel = G.release ? (REL[lang] ?? REL.en)(new Intl.DateTimeFormat(T.cc.locale, { dateStyle: 'long', timeZone: 'UTC' }).format(new Date(G.release))) : '';
  const money = (v) => (v ? T.f.money(v) : '—');
  const inRows = rows.filter((r) => r.in_stock);
  const shopsN = new Set(rows.map((r) => r.shop)).size;
  const list = inRows.slice(0, 6).map((r) => `${G.multi ? `${r.product} – ` : ''}${shopName(r.shop)} (${money(r.price)}, ${W.ed[r.edition]})`).join(', ');
  const cheap = inRows.filter((r) => r.price).sort((a, b) => a.price - b.price)[0];
  const lede = inRows.length ? W.yes(w, PS, new Set(inRows.map((r) => r.shop)).size, list, cheap ? `${shopName(cheap.shop)}, ${money(cheap.price)}` : '—') : shopsN ? W.no(w, PS, shopsN) : W.none(PS);
  const prices = inRows.map((r) => r.price).filter(Boolean).sort((a, b) => a - b);
  const durs = skus.length ? (await all(env, `SELECT r.ended_at - r.started_at AS d FROM restocks r JOIN stores s ON s.id = r.store_id WHERE s.country = ? AND r.ended_at IS NOT NULL AND r.sku_id IN (${skus.map((k) => Number(k.id)).join(',')}) ORDER BY d`, cc)).map((r) => r.d) : [];
  const med = durs.length ? T.f.dur(durs[Math.floor(durs.length / 2)]) : null;
  const a = answers([
    { q: W.q1(PS, C), a: lede },
    ...(prices.length ? [{ q: W.q2(PS), a: W.a2(money(prices[0]), prices.length > 1 ? money(prices[prices.length - 1]) : null) }] : []),
    { q: W.q3(PS), a: med ? W.a3(med) : W.a3n },
  ], 'FAQ');
  const alertHref = `/alerts?${new URLSearchParams({ c: cc, ...(skus.length ? { sku: (skus.find((k) => k.places_in > 0) ?? skus[0]).slug } : {}) })}`;
  const live = await d.liveCountries(env);
  const others = [...live].filter((c) => c !== cc && COUNTRIES[c] && c !== 'jp');
  const path = guidePath(cc, id);
  const facts = factsHtml(id, lang);
  const body = `<div class="answer"><h1>${e(W.h1(P, C))}</h1><p class="asof">${e(W.upd(w))}</p><p class="lede">${e(lede)}</p>${rel ? `<p class="answer-line">${e(rel)}</p>` : ''}
    <p><a class="btn go" href="${e(alertHref)}" data-ev="sheet_open">🔔 ${e(freeMode(env) ? W.alert : W.alertPaid)}</a></p></div>
  ${rows.length ? `<section><div class="table-scroll"><table><thead><tr>${G.multi ? `<th>${e(W.prod)}</th>` : ''}${W.th.map((x) => `<th>${e(x)}</th>`).join('')}<th></th></tr></thead><tbody>
  ${rows.slice(0, 60).map((r) => `<tr>${G.multi ? `<td><a href="/${cc}/${e(r.slug)}">${e(r.product)}</a></td>` : ''}<td><a href="/${cc}/${e(r.slug)}">${e(shopName(r.shop))}</a></td><td>${e(W.ed[r.edition])}</td><td>${e(money(r.price))}</td><td>${r.in_stock ? `<span class="tag in">✓ ${e(W.in)}</span>` : `<span class="tag out">${e(W.out)}</span>`}</td><td>${r.url ? `<a class="btn small ${r.in_stock ? 'go' : 'dark'}" href="${e(r.url)}" rel="nofollow noopener sponsored" target="_blank" data-ev="buy" data-sku="${e(r.slug)}">${e(W.buy)} ↗</a>` : ''}</td></tr>`).join('')}
  </tbody></table></div></section>` : ''}
  ${affiliateBlock(env, T, cc, { name: PS, slug: id })}
  ${facts}
  ${a.html}
  ${others.length ? `<section><h2>${e(W.other)}</h2><p class="quick-links">${others.map((c) => `<a href="${guidePath(c, id)}">${e(countryIn(c))}</a>`).join('')}<a href="/${G.slug.en}">${e(W.all)}</a></p></section>` : ''}`;
  const ld = { '@context': 'https://schema.org', '@type': 'Product', name: P, ...(skus.find((k) => k.image) ? { image: skus.find((k) => k.image).image } : {}),
    offers: { '@type': 'AggregateOffer', priceCurrency: T.cc.currency, offerCount: inRows.length, ...(prices.length ? { lowPrice: prices[0], highPrice: prices[prices.length - 1] } : {}),
      availability: inRows.length ? 'https://schema.org/InStock' : 'https://schema.org/OutOfStock' } };
  const alternates = Object.fromEntries([...live].filter((c) => COUNTRIES[c] && c !== 'jp').map((c) => [c, guidePath(c, id)]));
  return page(env, T, { title: `${W.h1(PS, C)} (${T.f.date(ts)}) | ${env.BRAND_NAME}`, description: lede.slice(0, 300), path, body, jsonLd: [a.ld, ld], alternates });
}

/** English overview: every country on one page (/{slug.en}). */
export async function guideOverview(env, id) {
  const G = GUIDES[id]; const T = t('us'); const W = L.en; const ts = now(); const w = T.f.when(ts);
  const live = [...(await d.liveCountries(env))].filter((c) => COUNTRIES[c] && c !== 'jp');
  // one query for every country (the per-country version took ~2 s)
  const ids = (await all(env, 'SELECT id, name, type FROM skus WHERE active = 1')).filter((k) => sealed(k) && G.match(k.name)).map((k) => k.id);
  const allRows = ids.length ? await all(env, `SELECT s.country, s.name AS shop, x.in_stock, COALESCE(x.price, l.price) AS price
    FROM stock x JOIN listings l ON l.id = x.listing_id AND l.active = 1 JOIN stores s ON s.id = x.store_id
    WHERE l.sku_id IN (${ids.map(Number).join(',')})`) : [];
  const per = [];
  for (const cc of live) {
    const rows = allRows.filter((r) => r.country === cc);
    if (!rows.length) continue;
    const Tc = t(cc); const inRows = rows.filter((r) => r.in_stock);
    const cheap = inRows.filter((r) => r.price).sort((a, b) => a.price - b.price)[0];
    per.push({ cc, shops: new Set(rows.map((r) => r.shop)).size, inShops: new Set(inRows.map((r) => r.shop)).size, cheap: cheap ? `${shopName(cheap.shop)} · ${Tc.f.money(cheap.price)}` : '—' });
  }
  const P = G.name.en;
  const lede = `As of ${w}, the ${P} is in stock in ${per.filter((p) => p.inShops).length} of the ${per.length} countries we track. Pick your country for today's shops and prices.`;
  const body = `<div class="answer"><h1>${e(`Where to buy the ${P}`)}</h1><p class="asof">${e(W.upd(w))}</p><p class="lede">${e(lede)}</p></div>
  <section><div class="table-scroll"><table><thead><tr><th>Country</th><th>Shops with stock</th><th>Cheapest in stock</th></tr></thead><tbody>
  ${per.map((p) => `<tr><td><a href="${guidePath(p.cc, id)}">${e(new Intl.DisplayNames(['en'], { type: 'region' }).of(p.cc === 'uk' ? 'GB' : p.cc.toUpperCase()))}</a></td><td>${p.inShops} / ${p.shops}</td><td>${e(p.cheap)}</td></tr>`).join('')}
  </tbody></table></div></section>${G.release ? `<p class="answer-line">${e(REL.en(new Intl.DateTimeFormat('en-US', { dateStyle: 'long', timeZone: 'UTC' }).format(new Date(G.release))))}</p>` : ''}${factsHtml(id, 'en')}
  <section><h2>By country</h2><p class="quick-links">${live.map((c) => `<a href="${guidePath(c, id)}">${e(new Intl.DisplayNames(['en'], { type: 'region' }).of(c === 'uk' ? 'GB' : c.toUpperCase()))}</a>`).join('')}</p></section>`;
  return page(env, T, { title: `Where to buy the ${P} (${T.f.date(ts)}) | ${env.BRAND_NAME}`, description: lede, path: `/${G.slug.en}`, body,
    alternates: Object.fromEntries(per.map((p) => [p.cc, guidePath(p.cc, id)])) });
}
