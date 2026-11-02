// Country pages in the country's language, written to be quoted by AI assistants:
//   /{cc}/{data slug}        what is in stock now, what is sold out everywhere, latest restocks (hourly)
//   /{cc}/{30th slug}        Pokémon 30th Celebration: where each product is in stock, cheapest price
// ChatGPT sends most of its visitors to European country pages and 30th Celebration products,
// so each country gets these answers in its own words.
import { escapeHtml as e } from '../../lib/util.js';
import { COUNTRIES } from '../../data/countries.js';
import { t } from '../../i18n/index.js';
import { all, now } from '../../lib/db.js';
import * as d from '../data.js';
import { page, answers, home } from '../html.js';

export const sealed = (k) => k.type && k.type !== 'other' && !/\bPSA\b|\bBGS\b|\bCGC\b|graded|plush|\bpromo\b|shadowless|1st edition|base set/i.test(k.name);
const THIRTY = /30th|30\s*jahre|30\s*ans|30\s*anni|30\s*aniversario|30\s*jaar|30e\s*verjaardag|30\s*years/i;
const shopName = (n) => String(n ?? '').replace(/ online$/, '');

export const DATA_SLUG = { en: 'pokemon-restock-data', de: 'pokemon-karten-bestand', fr: 'stock-cartes-pokemon', it: 'disponibilita-carte-pokemon', es: 'stock-cartas-pokemon', nl: 'pokemon-kaarten-voorraad' };
export const THIRTY_SLUG = { en: '30th-celebration', de: '30-jahre-pokemon', fr: '30-ans-pokemon', it: '30-anni-pokemon', es: '30-aniversario-pokemon', nl: '30-jaar-pokemon' };
export const dataPath = (cc) => (cc === 'us' ? '/pokemon-restock-data' : `/${cc}/${DATA_SLUG[COUNTRIES[cc].lang] ?? DATA_SLUG.en}`);
export const thirtyPath = (cc) => `/${cc}/${THIRTY_SLUG[COUNTRIES[cc].lang] ?? THIRTY_SLUG.en}`;

const L = {
  en: {
    h1: (c) => `Pokémon cards in stock in ${c}: live data`,
    lede: (w, n, tot, out, shops, c, wk, med) => `As of ${w}, ${n} of the ${tot} sealed Pokémon TCG products we track in ${c} are in stock at at least one of ${shops} independent card shops, and ${out} are sold out at every shop we check. ${wk} restocks seen in the last 7 days${med ? `; a restock typically stays in stock ${med}` : ''}.`,
    upd: (w) => `Updated ${w} · from our own readings, refreshed every hour`,
    qEasy: (c) => `Which Pokémon cards are easiest to find in stock in ${c} right now?`,
    qOut: (c) => `Which Pokémon products are sold out everywhere in ${c}?`,
    qLast: 'How long do Pokémon restocks last at card shops?',
    qShops: (c) => `Which shops are checked in ${c}?`,
    aEasy: (w, list) => `As of ${w}: ${list}.`, item: (n, s, p) => `${n} (${s} shops, from ${p})`,
    aOut: (w, list) => `As of ${w}, sold out at every shop we check: ${list}.`, none: 'None right now.',
    aLast: (med, n) => `The median restock stayed in stock ${med} over the last 30 days (${n} measured, each re-checked every 10 minutes until it sold out).`,
    aLastNone: 'Still measuring: each restock is re-checked every 10 minutes until it sells out.',
    aShops: (n, list) => `${n} independent card shops, sold-out products checked every hour: ${list}.`,
    hEasy: 'Easiest to find right now', hOut: 'Sold out at every shop we check', hLatest: 'Latest restocks',
    th: ['Product', 'Shops with stock', 'Lowest price in stock'], thR: ['Product', 'Shop', 'Back in stock', 'Lasted'], still: 'still in stock', lastR: 'last restock',
    tH1: (c) => `Pokémon 30th Celebration: where it is in stock in ${c}`,
    tLede: (w, n, inN, c, best) => `As of ${w}, ${inN} of the ${n} Pokémon 30th Celebration products we track in ${c} are in stock at independent card shops.${best ? ` Easiest to find: ${best}.` : ''}`,
    tQ: (p, c) => `Where can I buy the ${p} in ${c}?`, tA: (w, p, shops) => (shops ? `As of ${w}, in stock at ${shops}.` : `As of ${w}, sold out at every shop we check; set a free alert on the product page to hear when it is back.`),
    tTh: ['Product', 'Shops with stock', 'Lowest price', 'Where'], seeAll: 'See all live stock', data: 'Live stock data', thirty: '30th Celebration stock',
  },
  de: {
    h1: (c) => `Pokémon-Karten auf Lager in ${c}: Live-Daten`,
    lede: (w, n, tot, out, shops, c, wk, med) => `Stand ${w}: ${n} von ${tot} versiegelten Pokémon-TCG-Produkten, die wir in ${c} verfolgen, sind bei mindestens einem von ${shops} unabhängigen Kartenläden auf Lager; ${out} sind überall ausverkauft. ${wk} Restocks in den letzten 7 Tagen${med ? `; ein Restock bleibt typischerweise ${med} verfügbar` : ''}.`,
    upd: (w) => `Aktualisiert ${w} · eigene Messungen, stündlich aktualisiert`,
    qEasy: (c) => `Welche Pokémon-Karten sind in ${c} gerade am leichtesten zu bekommen?`,
    qOut: (c) => `Welche Pokémon-Produkte sind in ${c} überall ausverkauft?`,
    qLast: 'Wie lange dauern Pokémon-Restocks bei Kartenläden?',
    qShops: (c) => `Welche Shops werden in ${c} geprüft?`,
    aEasy: (w, list) => `Stand ${w}: ${list}.`, item: (n, s, p) => `${n} (${s} Shops, ab ${p})`,
    aOut: (w, list) => `Stand ${w}, bei allen geprüften Shops ausverkauft: ${list}.`, none: 'Derzeit keine.',
    aLast: (med, n) => `Der mittlere Restock blieb in den letzten 30 Tagen ${med} verfügbar (${n} gemessen, alle 10 Minuten geprüft bis ausverkauft).`,
    aLastNone: 'Wird noch gemessen: jeder Restock wird alle 10 Minuten geprüft, bis er ausverkauft ist.',
    aShops: (n, list) => `${n} unabhängige Kartenläden, ausverkaufte Produkte stündlich geprüft: ${list}.`,
    hEasy: 'Gerade am leichtesten zu finden', hOut: 'Überall ausverkauft', hLatest: 'Neueste Restocks',
    th: ['Produkt', 'Shops mit Bestand', 'Günstigster Preis'], thR: ['Produkt', 'Shop', 'Wieder da', 'Dauer'], still: 'noch verfügbar', lastR: 'letzter Restock',
    tH1: (c) => `Pokémon 30 Jahre (30th Celebration): wo auf Lager in ${c}`,
    tLede: (w, n, inN, c, best) => `Stand ${w}: ${inN} von ${n} Produkten der Pokémon-30-Jahre-Reihe, die wir in ${c} verfolgen, sind bei unabhängigen Kartenläden auf Lager.${best ? ` Am leichtesten zu finden: ${best}.` : ''}`,
    tQ: (p, c) => `Wo kann ich ${p} in ${c} kaufen?`, tA: (w, p, shops) => (shops ? `Stand ${w} auf Lager bei: ${shops}.` : `Stand ${w} überall ausverkauft; auf der Produktseite kostenlos benachrichtigen lassen.`),
    tTh: ['Produkt', 'Shops mit Bestand', 'Günstigster Preis', 'Wo'], seeAll: 'Alle Live-Bestände', data: 'Live-Bestandsdaten', thirty: '30 Jahre Pokémon: Bestand',
  },
  fr: {
    h1: (c) => `Cartes Pokémon en stock en ${c} : données en direct`,
    lede: (w, n, tot, out, shops, c, wk, med) => `Au ${w}, ${n} des ${tot} produits Pokémon TCG scellés que nous suivons en ${c} sont en stock dans au moins une des ${shops} boutiques indépendantes, et ${out} sont en rupture partout. ${wk} réassorts vus ces 7 derniers jours${med ? ` ; un réassort reste généralement disponible ${med}` : ''}.`,
    upd: (w) => `Mis à jour le ${w} · nos propres relevés, actualisés toutes les heures`,
    qEasy: (c) => `Quelles cartes Pokémon sont les plus faciles à trouver en stock en ${c} en ce moment ?`,
    qOut: (c) => `Quels produits Pokémon sont en rupture partout en ${c} ?`,
    qLast: 'Combien de temps durent les réassorts Pokémon en boutique ?',
    qShops: (c) => `Quelles boutiques sont vérifiées en ${c} ?`,
    aEasy: (w, list) => `Au ${w} : ${list}.`, item: (n, s, p) => `${n} (${s} boutiques, dès ${p})`,
    aOut: (w, list) => `Au ${w}, en rupture dans toutes les boutiques vérifiées : ${list}.`, none: 'Aucun pour le moment.',
    aLast: (med, n) => `Le réassort médian est resté disponible ${med} sur les 30 derniers jours (${n} mesurés, revérifiés toutes les 10 minutes jusqu'à la rupture).`,
    aLastNone: 'Mesure en cours : chaque réassort est revérifié toutes les 10 minutes jusqu\'à la rupture.',
    aShops: (n, list) => `${n} boutiques indépendantes, produits en rupture vérifiés toutes les heures : ${list}.`,
    hEasy: 'Les plus faciles à trouver', hOut: 'En rupture partout', hLatest: 'Derniers réassorts',
    th: ['Produit', 'Boutiques en stock', 'Prix le plus bas'], thR: ['Produit', 'Boutique', 'De retour', 'Durée'], still: 'encore en stock', lastR: 'dernier réassort',
    tH1: (c) => `Pokémon 30 ans (30th Celebration) : où en trouver en ${c}`,
    tLede: (w, n, inN, c, best) => `Au ${w}, ${inN} des ${n} produits de la gamme Pokémon 30 ans que nous suivons en ${c} sont en stock dans des boutiques indépendantes.${best ? ` Le plus facile à trouver : ${best}.` : ''}`,
    tQ: (p, c) => `Où acheter ${p} en ${c} ?`, tA: (w, p, shops) => (shops ? `Au ${w}, en stock chez : ${shops}.` : `Au ${w}, en rupture partout ; activez une alerte gratuite sur la page du produit.`),
    tTh: ['Produit', 'Boutiques en stock', 'Prix le plus bas', 'Où'], seeAll: 'Tout le stock en direct', data: 'Données de stock en direct', thirty: 'Stock Pokémon 30 ans',
  },
  it: {
    h1: (c) => `Carte Pokémon disponibili in ${c}: dati live`,
    lede: (w, n, tot, out, shops, c, wk, med) => `Al ${w}, ${n} dei ${tot} prodotti Pokémon TCG sigillati che seguiamo in ${c} sono disponibili in almeno uno dei ${shops} negozi indipendenti, e ${out} sono esauriti ovunque. ${wk} restock negli ultimi 7 giorni${med ? `; un restock resta disponibile in media ${med}` : ''}.`,
    upd: (w) => `Aggiornato ${w} · nostre rilevazioni, aggiornate ogni ora`,
    qEasy: (c) => `Quali carte Pokémon sono più facili da trovare in ${c} adesso?`,
    qOut: (c) => `Quali prodotti Pokémon sono esauriti ovunque in ${c}?`,
    qLast: 'Quanto durano i restock Pokémon nei negozi?',
    qShops: (c) => `Quali negozi controllate in ${c}?`,
    aEasy: (w, list) => `Al ${w}: ${list}.`, item: (n, s, p) => `${n} (${s} negozi, da ${p})`,
    aOut: (w, list) => `Al ${w}, esauriti in tutti i negozi controllati: ${list}.`, none: 'Nessuno al momento.',
    aLast: (med, n) => `Il restock mediano è rimasto disponibile ${med} negli ultimi 30 giorni (${n} misurati, ricontrollati ogni 10 minuti fino all'esaurimento).`,
    aLastNone: 'Misurazione in corso: ogni restock viene ricontrollato ogni 10 minuti fino all\'esaurimento.',
    aShops: (n, list) => `${n} negozi indipendenti, prodotti esauriti controllati ogni ora: ${list}.`,
    hEasy: 'Più facili da trovare ora', hOut: 'Esauriti ovunque', hLatest: 'Ultimi restock',
    th: ['Prodotto', 'Negozi disponibili', 'Prezzo più basso'], thR: ['Prodotto', 'Negozio', 'Di nuovo disponibile', 'Durata'], still: 'ancora disponibile', lastR: 'ultimo restock',
    tH1: (c) => `Pokémon 30 anni (30th Celebration): dove trovarlo in ${c}`,
    tLede: (w, n, inN, c, best) => `Al ${w}, ${inN} dei ${n} prodotti della linea Pokémon 30 anni che seguiamo in ${c} sono disponibili nei negozi indipendenti.${best ? ` Più facile da trovare: ${best}.` : ''}`,
    tQ: (p, c) => `Dove comprare ${p} in ${c}?`, tA: (w, p, shops) => (shops ? `Al ${w}, disponibile da: ${shops}.` : `Al ${w}, esaurito ovunque; attiva un avviso gratuito nella pagina del prodotto.`),
    tTh: ['Prodotto', 'Negozi disponibili', 'Prezzo più basso', 'Dove'], seeAll: 'Tutta la disponibilità live', data: 'Dati di disponibilità live', thirty: 'Pokémon 30 anni: disponibilità',
  },
  es: {
    h1: (c) => `Cartas Pokémon en stock en ${c}: datos en directo`,
    lede: (w, n, tot, out, shops, c, wk, med) => `A ${w}, ${n} de los ${tot} productos Pokémon TCG sellados que seguimos en ${c} están en stock en al menos una de ${shops} tiendas independientes, y ${out} están agotados en todas. ${wk} reposiciones en los últimos 7 días${med ? `; una reposición suele durar ${med}` : ''}.`,
    upd: (w) => `Actualizado ${w} · nuestras propias lecturas, cada hora`,
    qEasy: (c) => `¿Qué cartas Pokémon son más fáciles de encontrar en ${c} ahora?`,
    qOut: (c) => `¿Qué productos Pokémon están agotados en todas partes en ${c}?`,
    qLast: '¿Cuánto duran las reposiciones Pokémon en las tiendas?',
    qShops: (c) => `¿Qué tiendas se revisan en ${c}?`,
    aEasy: (w, list) => `A ${w}: ${list}.`, item: (n, s, p) => `${n} (${s} tiendas, desde ${p})`,
    aOut: (w, list) => `A ${w}, agotados en todas las tiendas revisadas: ${list}.`, none: 'Ninguno ahora mismo.',
    aLast: (med, n) => `La reposición mediana duró ${med} en los últimos 30 días (${n} medidas, revisadas cada 10 minutos hasta agotarse).`,
    aLastNone: 'Midiendo todavía: cada reposición se revisa cada 10 minutos hasta agotarse.',
    aShops: (n, list) => `${n} tiendas independientes, productos agotados revisados cada hora: ${list}.`,
    hEasy: 'Más fáciles de encontrar ahora', hOut: 'Agotados en todas partes', hLatest: 'Últimas reposiciones',
    th: ['Producto', 'Tiendas con stock', 'Precio más bajo'], thR: ['Producto', 'Tienda', 'De vuelta', 'Duró'], still: 'aún en stock', lastR: 'última reposición',
    tH1: (c) => `Pokémon 30 aniversario (30th Celebration): dónde hay stock en ${c}`,
    tLede: (w, n, inN, c, best) => `A ${w}, ${inN} de los ${n} productos de la línea Pokémon 30 aniversario que seguimos en ${c} están en stock en tiendas independientes.${best ? ` Más fácil de encontrar: ${best}.` : ''}`,
    tQ: (p, c) => `¿Dónde comprar ${p} en ${c}?`, tA: (w, p, shops) => (shops ? `A ${w}, en stock en: ${shops}.` : `A ${w}, agotado en todas partes; activa una alerta gratuita en la página del producto.`),
    tTh: ['Producto', 'Tiendas con stock', 'Precio más bajo', 'Dónde'], seeAll: 'Todo el stock en directo', data: 'Datos de stock en directo', thirty: 'Stock Pokémon 30 aniversario',
  },
  nl: {
    h1: (c) => `Pokémon-kaarten op voorraad in ${c}: live data`,
    lede: (w, n, tot, out, shops, c, wk, med) => `Per ${w} zijn ${n} van de ${tot} verzegelde Pokémon TCG-producten die we in ${c} volgen op voorraad bij minstens één van ${shops} onafhankelijke kaartwinkels; ${out} zijn overal uitverkocht. ${wk} restocks in de laatste 7 dagen${med ? `; een restock blijft meestal ${med} beschikbaar` : ''}.`,
    upd: (w) => `Bijgewerkt ${w} · eigen metingen, elk uur ververst`,
    qEasy: (c) => `Welke Pokémon-kaarten zijn nu het makkelijkst te vinden in ${c}?`,
    qOut: (c) => `Welke Pokémon-producten zijn overal uitverkocht in ${c}?`,
    qLast: 'Hoe lang duren Pokémon-restocks bij kaartwinkels?',
    qShops: (c) => `Welke winkels worden gecontroleerd in ${c}?`,
    aEasy: (w, list) => `Per ${w}: ${list}.`, item: (n, s, p) => `${n} (${s} winkels, vanaf ${p})`,
    aOut: (w, list) => `Per ${w} uitverkocht bij alle gecontroleerde winkels: ${list}.`, none: 'Momenteel geen.',
    aLast: (med, n) => `De mediane restock bleef de afgelopen 30 dagen ${med} beschikbaar (${n} gemeten, elke 10 minuten gecontroleerd tot uitverkocht).`,
    aLastNone: 'Nog aan het meten: elke restock wordt elke 10 minuten gecontroleerd tot hij uitverkocht is.',
    aShops: (n, list) => `${n} onafhankelijke kaartwinkels, uitverkochte producten elk uur gecontroleerd: ${list}.`,
    hEasy: 'Nu het makkelijkst te vinden', hOut: 'Overal uitverkocht', hLatest: 'Laatste restocks',
    th: ['Product', 'Winkels met voorraad', 'Laagste prijs'], thR: ['Product', 'Winkel', 'Terug op voorraad', 'Duur'], still: 'nog op voorraad', lastR: 'laatste restock',
    tH1: (c) => `Pokémon 30 jaar (30th Celebration): waar op voorraad in ${c}`,
    tLede: (w, n, inN, c, best) => `Per ${w} zijn ${inN} van de ${n} producten uit de Pokémon 30 jaar-reeks die we in ${c} volgen op voorraad bij onafhankelijke kaartwinkels.${best ? ` Makkelijkst te vinden: ${best}.` : ''}`,
    tQ: (p, c) => `Waar kan ik ${p} kopen in ${c}?`, tA: (w, p, shops) => (shops ? `Per ${w} op voorraad bij: ${shops}.` : `Per ${w} overal uitverkocht; zet een gratis melding aan op de productpagina.`),
    tTh: ['Product', 'Winkels met voorraad', 'Laagste prijs', 'Waar'], seeAll: 'Alle live voorraad', data: 'Live voorraaddata', thirty: 'Pokémon 30 jaar: voorraad',
  },
};
export const words = (cc) => L[COUNTRIES[cc]?.lang] ?? L.en;
const countryName = (cc) => new Intl.DisplayNames([COUNTRIES[cc].lang], { type: 'region' }).of(cc === 'uk' ? 'GB' : cc.toUpperCase());

/** the alternates map of a page that exists in every live country */
async function alts(env, pathOf) {
  const live = await d.liveCountries(env);
  return Object.fromEntries([...live].filter((c) => COUNTRIES[c] && c !== 'jp').map((c) => [c, pathOf(c)]));
}

export async function countryData(env, cc) {
  const T = t(cc); const W = words(cc); const ts = now(); const w = T.f.when(ts); const C = countryName(cc);
  const skus = (await d.allSkus(env, cc)).filter(sealed);
  if (!skus.length) return null;
  const inNow = skus.filter((k) => k.places_in > 0);
  const outAll = skus.filter((k) => k.places > 0 && !k.places_in).sort((a, b) => (b.last_restock ?? 0) - (a.last_restock ?? 0));
  const easiest = [...inNow].sort((a, b) => b.places_in - a.places_in).slice(0, 15);
  const shops = await all(env, `SELECT DISTINCT s.name FROM stores s JOIN stock x ON x.store_id = s.id WHERE s.country = ? AND s.online = 1 ORDER BY s.name`, cc);
  const latest = await all(env, `SELECT r.started_at, r.ended_at, k.name, k.slug, s.name AS store FROM restocks r JOIN skus k ON k.id = r.sku_id JOIN stores s ON s.id = r.store_id
    WHERE s.country = ? ORDER BY r.started_at DESC LIMIT 15`, cc);
  const durs = (await all(env, `SELECT r.ended_at - r.started_at AS d FROM restocks r JOIN stores s ON s.id = r.store_id WHERE s.country = ? AND r.ended_at IS NOT NULL AND r.started_at > ? ORDER BY d`, cc, ts - 30 * 864e5)).map((r) => r.d);
  const med = durs.length ? T.f.dur(durs[Math.floor(durs.length / 2)]) : null;
  const wk = (await all(env, 'SELECT COUNT(*) AS n FROM restocks r JOIN stores s ON s.id = r.store_id WHERE s.country = ? AND r.started_at > ?', cc, ts - 7 * 864e5))[0]?.n ?? 0;
  const money = (v) => (v ? T.f.money(v) : '—');
  const lede = W.lede(w, inNow.length, skus.length, outAll.length, shops.length, C, wk, med);
  const a = answers([
    { q: W.qEasy(C), a: easiest.length ? W.aEasy(w, easiest.slice(0, 5).map((k) => W.item(k.name, k.places_in, money(k.price_in))).join('; ')) : W.none },
    { q: W.qOut(C), a: outAll.length ? W.aOut(w, outAll.slice(0, 8).map((k) => k.name).join(', ')) : W.none },
    { q: W.qLast, a: med ? W.aLast(med, durs.length) : W.aLastNone },
    { q: W.qShops(C), a: W.aShops(shops.length, shops.map((s) => shopName(s.name)).join(', ')) },
  ], 'FAQ');
  const path = dataPath(cc);
  const body = `<div class="answer"><h1>${e(W.h1(C))}</h1><p class="asof">${e(W.upd(w))}</p><p class="lede">${e(lede)}</p>
  <p><a class="btn" href="${home(cc)}">${e(W.seeAll)}</a> <a class="btn ghost" href="${thirtyPath(cc)}">${e(W.thirty)}</a></p></div>
  ${a.html}
  <section><h2>${e(W.hEasy)}</h2><div class="table-scroll"><table><thead><tr>${W.th.map((x) => `<th>${e(x)}</th>`).join('')}</tr></thead><tbody>
  ${easiest.map((k) => `<tr><td><a href="/${cc}/${e(k.slug)}">${e(k.name)}</a></td><td>${k.places_in}</td><td>${e(money(k.price_in))}</td></tr>`).join('') || `<tr><td colspan="3">${e(W.none)}</td></tr>`}</tbody></table></div></section>
  <section><h2>${e(W.hOut)}</h2>${outAll.length ? `<ul>${outAll.slice(0, 20).map((k) => `<li><a href="/${cc}/${e(k.slug)}">${e(k.name)}</a>${k.last_restock ? ` — ${e(W.lastR)} ${e(T.f.ago(k.last_restock))}` : ''}</li>`).join('')}</ul>` : `<p>${e(W.none)}</p>`}</section>
  <section><h2>${e(W.hLatest)}</h2><div class="table-scroll"><table><thead><tr>${W.thR.map((x) => `<th>${e(x)}</th>`).join('')}</tr></thead><tbody>
  ${latest.map((r) => `<tr><td><a href="/${cc}/${e(r.slug)}">${e(r.name)}</a></td><td>${e(shopName(r.store))}</td><td>${e(T.f.when(r.started_at))}</td><td>${r.ended_at ? e(T.f.dur(r.ended_at - r.started_at)) : e(W.still)}</td></tr>`).join('') || `<tr><td colspan="4">${e(W.none)}</td></tr>`}</tbody></table></div></section>
  <p class="fine"><a href="/pokemon-restock-data">All countries (English)</a> · <a href="/how-it-works">How it works</a></p>`;
  const ld = { '@context': 'https://schema.org', '@type': 'Dataset', name: W.h1(C), description: lede, url: `${env.BASE_URL}${path}`, inLanguage: COUNTRIES[cc].locale,
    dateModified: new Date(ts).toISOString(), isAccessibleForFree: true, license: 'https://creativecommons.org/licenses/by/4.0/', spatialCoverage: C,
    creator: { '@type': 'Organization', name: env.BRAND_NAME, url: env.BASE_URL } };
  return page(env, T, { title: `${W.h1(C)} (${T.f.date(ts)}) | ${env.BRAND_NAME}`, description: lede.slice(0, 300), path, body, jsonLd: [a.ld, ld], alternates: await alts(env, dataPath) });
}

export async function thirtyPage(env, cc) {
  const T = t(cc); const W = words(cc); const ts = now(); const w = T.f.when(ts); const C = countryName(cc);
  const skus = (await d.allSkus(env, cc)).filter((k) => sealed(k) && THIRTY.test(k.name));
  if (!skus.length) return null;
  const ids = skus.map((k) => k.id);
  const rows = await all(env, `SELECT l.sku_id, s.name, MIN(l.price) AS price FROM stock x JOIN listings l ON l.id = x.listing_id JOIN stores s ON s.id = x.store_id
    WHERE x.in_stock = 1 AND s.country = ? AND l.sku_id IN (${ids.map(() => '?').join(',')}) GROUP BY l.sku_id, s.name ORDER BY price`, cc, ...ids);
  const where = (id) => rows.filter((r) => r.sku_id === id);
  const money = (v) => (v ? T.f.money(v) : '—');
  skus.sort((a, b) => b.places_in - a.places_in || a.name.localeCompare(b.name));
  const inN = skus.filter((k) => k.places_in > 0);
  const best = inN.slice(0, 3).map((k) => W.item(k.name, k.places_in, money(k.price_in))).join('; ');
  const lede = W.tLede(w, skus.length, inN.length, C, best);
  const top = skus.slice(0, 6);
  const a = answers(top.map((k) => ({ q: W.tQ(k.name, C), a: W.tA(w, k.name, where(k.id).slice(0, 6).map((r) => `${shopName(r.name)} (${money(r.price)})`).join(', ')) })), 'FAQ');
  const path = thirtyPath(cc);
  const body = `<div class="answer"><h1>${e(W.tH1(C))}</h1><p class="asof">${e(W.upd(w))}</p><p class="lede">${e(lede)}</p></div>
  <section><div class="table-scroll"><table><thead><tr>${W.tTh.map((x) => `<th>${e(x)}</th>`).join('')}</tr></thead><tbody>
  ${skus.map((k) => `<tr><td><a href="/${cc}/${e(k.slug)}">${e(k.name)}</a></td><td>${k.places_in}</td><td>${e(money(k.price_in))}</td><td>${e(where(k.id).slice(0, 4).map((r) => shopName(r.name)).join(', ') || '—')}</td></tr>`).join('')}
  </tbody></table></div></section>
  ${a.html}
  <p><a class="btn" href="${home(cc)}">${e(W.seeAll)}</a> <a class="btn ghost" href="${dataPath(cc)}">${e(W.data)}</a></p>`;
  const ld = { '@context': 'https://schema.org', '@type': 'ItemList', name: W.tH1(C), dateModified: new Date(ts).toISOString(),
    itemListElement: skus.map((k, i) => ({ '@type': 'ListItem', position: i + 1, url: `${env.BASE_URL}/${cc}/${k.slug}`, name: k.name })) };
  return page(env, T, { title: `${W.tH1(C)} (${T.f.date(ts)}) | ${env.BRAND_NAME}`, description: lede.slice(0, 300), path, body, jsonLd: [a.ld, ld], alternates: await alts(env, thirtyPath) });
}
