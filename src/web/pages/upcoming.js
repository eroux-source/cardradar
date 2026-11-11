// "Upcoming Pokémon TCG releases" page, one per country in its language (/{cc}/{slug}).
// AI answers compare trackers on what is coming next: a dated, sourced list with live stock for what just came out.
// Dates: English release dates. status 'official' = announced by The Pokémon Company; 'reported' = specialist sites only.
// Update RELEASES (and CHECKED) when a date is announced or moves. Never show a date we have not seen in a source.
import { escapeHtml as e } from '../../lib/util.js';
import { COUNTRIES } from '../../data/countries.js';
import { t } from '../../i18n/index.js';
import { now } from '../../lib/db.js';
import * as d from '../data.js';
import { page, answers } from '../html.js';
import { GUIDES, guidePath } from './where_buy.js';
import { thirtyPath, sealed } from './local_data.js';

export const CHECKED = '2026-11-11'; // last time every date below was checked against sources
const THIRTY = /30th|30\s*(jahre|ans|anni|aniversario|jaar)/i;
// Sources: pokemon.com / pokemon-card.com (official), Pokénnoisseur, Lv1 Gaming, Cardrake, Bill's Archive (reported).
const RELEASES = [
  { id: 'delta-reign', date: '2026-11-06', status: 'official', name: 'Mega Evolution—Delta Reign (ME06)', guide: 'delta-reign', match: GUIDES['delta-reign'].match },
  { id: '30th-wave4', date: '2026-11-06', status: 'official', name: '30th Celebration wave 4: Ultra-Premium Collections, Ditto Premium Collection, Mew & Mewtwo Figure Collections', thirty: true, match: (n) => THIRTY.test(n) },
  { id: 'jp-special-deck', date: '2026-11-13', status: 'officialJp', name: 'Special Deck Set MEGA (Japan)', jp: true },
  { id: 'jp-hadou-seeker', date: '2026-11-27', status: 'officialJp', name: 'Hadou Seeker / Aura Seeker (Japan; Japanese version of Flowing Fists)', guide: 'flowing-fists' },
  { id: 'binder-tins', date: '2026-12-04', status: 'reported', name: '30th Celebration Binder Collection; Greninja ex and Sylveon ex tins', thirty: true },
  { id: 'valentine', date: '2027-01-27', status: 'reported', approx: true, name: 'Valentine\'s Box (mid to late January; sources give January 15 or 27)' },
  { id: 'flowing-fists', date: '2027-02-05', status: 'reported', name: 'Mega Evolution—Flowing Fists (ME07), prereleases January 23 to 31', guide: 'flowing-fists' },
];

export const UPCOMING_SLUG = { en: 'upcoming-pokemon-tcg-releases', de: 'pokemon-neuerscheinungen', fr: 'prochaines-sorties-pokemon', it: 'prossime-uscite-pokemon', es: 'proximos-lanzamientos-pokemon', nl: 'nieuwe-pokemon-releases' };
export const UPCOMING_LINK = { en: 'Upcoming releases', de: 'Neuerscheinungen', fr: 'Prochaines sorties', it: 'Prossime uscite', es: 'Próximos lanzamientos', nl: 'Nieuwe releases' };
export const upcomingPath = (cc) => `/${cc}/${UPCOMING_SLUG[COUNTRIES[cc]?.lang] ?? UPCOMING_SLUG.en}`;

const L = {
  en: { h1: (c) => `Upcoming Pokémon TCG releases in ${c}`, title: (c, m) => `Upcoming Pokémon TCG releases (${c}, ${m})`,
    checked: (w, x) => `Dates checked ${w} · stock below updated ${x}`,
    next: (n, w, s) => `Next English release: ${n}, ${w} (${s}).`, out: (n, k) => `Just out: ${n}, ${k} product${k === 1 ? '' : 's'} in stock right now at the shops we check.`,
    th: ['Date', 'Release', 'Status', ''], st: { official: 'official', officialJp: 'official (Japan)', reported: 'reported, not yet confirmed', released: 'out now' },
    approx: 'around', buy: 'Where to buy', stock: 'Stock now', jp: 'Japan lottery calendar', alert: 'Get a free alert',
    note: 'English release dates. Shops in each country list products as soon as they get them, pre-orders included; every product page here shows which shops have it.',
    q1: 'What is the next Pokémon TCG set?', q2: (n) => `When does ${n} come out?`, q3: (c) => `Are release dates the same in ${c}?`,
    a3: 'English products usually arrive the same day worldwide; some shops ship a few days later. Local-language editions (German, French, Italian, Spanish) often follow the same calendar but can differ.' },
  de: { h1: (c) => `Kommende Pokémon-Karten-Neuerscheinungen in ${c}`, title: (c, m) => `Pokémon TCG Neuerscheinungen (${c}, ${m})`,
    checked: (w, x) => `Termine geprüft am ${w} · Bestand unten aktualisiert ${x}`,
    next: (n, w, s) => `Nächster englischer Release: ${n}, ${w} (${s}).`, out: (n, k) => `Gerade erschienen: ${n}, ${k} Produkt${k === 1 ? '' : 'e'} jetzt auf Lager bei den Shops, die wir prüfen.`,
    th: ['Datum', 'Release', 'Status', ''], st: { official: 'offiziell', officialJp: 'offiziell (Japan)', reported: 'berichtet, noch nicht bestätigt', released: 'erschienen' },
    approx: 'ca.', buy: 'Wo kaufen', stock: 'Bestand', jp: 'Japan-Lotteriekalender', alert: 'Kostenloser Alarm',
    note: 'Englische Release-Termine. Shops listen Produkte, sobald sie sie haben (auch Vorbestellungen); jede Produktseite zeigt, welche Shops sie haben.',
    q1: 'Was ist das nächste Pokémon-TCG-Set?', q2: (n) => `Wann erscheint ${n}?`, q3: (c) => `Gelten die Termine auch in ${c}?`,
    a3: 'Englische Produkte erscheinen meist weltweit am selben Tag; manche Shops liefern ein paar Tage später. Deutsche Ausgaben folgen oft demselben Kalender, können aber abweichen.' },
  fr: { h1: (c) => `Prochaines sorties Pokémon JCC en ${c}`, title: (c, m) => `Prochaines sorties Pokémon (${c}, ${m})`,
    checked: (w, x) => `Dates vérifiées le ${w} · stock ci-dessous mis à jour ${x}`,
    next: (n, w, s) => `Prochaine sortie en anglais : ${n}, le ${w} (${s}).`, out: (n, k) => `Vient de sortir : ${n}, ${k} produit${k > 1 ? 's' : ''} en stock en ce moment dans les boutiques suivies.`,
    th: ['Date', 'Sortie', 'Statut', ''], st: { official: 'officiel', officialJp: 'officiel (Japon)', reported: 'annoncé, pas encore confirmé', released: 'sorti' },
    approx: 'vers le', buy: 'Où acheter', stock: 'Stock', jp: 'Calendrier des loteries au Japon', alert: 'Alerte gratuite',
    note: 'Dates de sortie en anglais. Les boutiques listent les produits dès qu\'elles les reçoivent, précommandes comprises ; chaque page produit indique qui l\'a en stock.',
    q1: 'Quelle est la prochaine extension Pokémon ?', q2: (n) => `Quand sort ${n} ?`, q3: (c) => `Les dates sont-elles les mêmes en ${c} ?`,
    a3: 'Les produits en anglais sortent en général le même jour partout ; certaines boutiques expédient quelques jours après. Les éditions françaises suivent souvent le même calendrier, mais peuvent différer.' },
  it: { h1: (c) => `Prossime uscite Pokémon GCC in ${c}`, title: (c, m) => `Prossime uscite Pokémon (${c}, ${m})`,
    checked: (w, x) => `Date verificate il ${w} · disponibilità aggiornata ${x}`,
    next: (n, w, s) => `Prossima uscita in inglese: ${n}, ${w} (${s}).`, out: (n, k) => `Appena uscito: ${n}, ${k} prodott${k === 1 ? 'o' : 'i'} disponibil${k === 1 ? 'e' : 'i'} ora nei negozi che controlliamo.`,
    th: ['Data', 'Uscita', 'Stato', ''], st: { official: 'ufficiale', officialJp: 'ufficiale (Giappone)', reported: 'riportato, non ancora confermato', released: 'uscito' },
    approx: 'circa', buy: 'Dove comprare', stock: 'Disponibilità', jp: 'Calendario lotterie Giappone', alert: 'Avviso gratuito',
    note: 'Date di uscita in inglese. I negozi elencano i prodotti appena li ricevono, preordini inclusi; ogni pagina prodotto mostra chi lo ha.',
    q1: 'Qual è la prossima espansione Pokémon?', q2: (n) => `Quando esce ${n}?`, q3: (c) => `Le date valgono anche in ${c}?`,
    a3: 'I prodotti in inglese escono di solito lo stesso giorno ovunque; alcuni negozi spediscono qualche giorno dopo. Le edizioni italiane seguono spesso lo stesso calendario, ma possono variare.' },
  es: { h1: (c) => `Próximos lanzamientos de cartas Pokémon en ${c}`, title: (c, m) => `Próximos lanzamientos Pokémon (${c}, ${m})`,
    checked: (w, x) => `Fechas verificadas el ${w} · stock actualizado ${x}`,
    next: (n, w, s) => `Próximo lanzamiento en inglés: ${n}, ${w} (${s}).`, out: (n, k) => `Recién salido: ${n}, ${k} producto${k === 1 ? '' : 's'} en stock ahora en las tiendas que revisamos.`,
    th: ['Fecha', 'Lanzamiento', 'Estado', ''], st: { official: 'oficial', officialJp: 'oficial (Japón)', reported: 'publicado, aún sin confirmar', released: 'ya disponible' },
    approx: 'hacia el', buy: 'Dónde comprar', stock: 'Stock', jp: 'Calendario de loterías en Japón', alert: 'Alerta gratuita',
    note: 'Fechas de lanzamiento en inglés. Las tiendas listan los productos en cuanto los reciben, preventas incluidas; cada página de producto muestra quién lo tiene.',
    q1: '¿Cuál es la próxima expansión de Pokémon?', q2: (n) => `¿Cuándo sale ${n}?`, q3: (c) => `¿Las fechas son las mismas en ${c}?`,
    a3: 'Los productos en inglés suelen salir el mismo día en todo el mundo; algunas tiendas envían unos días después. Las ediciones en español suelen seguir el mismo calendario, pero pueden variar.' },
  nl: { h1: (c) => `Nieuwe Pokémon TCG-releases in ${c}`, title: (c, m) => `Nieuwe Pokémon-releases (${c}, ${m})`,
    checked: (w, x) => `Data gecontroleerd op ${w} · voorraad bijgewerkt ${x}`,
    next: (n, w, s) => `Volgende Engelse release: ${n}, ${w} (${s}).`, out: (n, k) => `Net uit: ${n}, ${k} product${k === 1 ? '' : 'en'} nu op voorraad bij de winkels die we volgen.`,
    th: ['Datum', 'Release', 'Status', ''], st: { official: 'officieel', officialJp: 'officieel (Japan)', reported: 'gemeld, nog niet bevestigd', released: 'uit' },
    approx: 'rond', buy: 'Waar kopen', stock: 'Voorraad', jp: 'Japanse loterijkalender', alert: 'Gratis melding',
    note: 'Engelse releasedata. Winkels tonen producten zodra ze binnen zijn, pre-orders inbegrepen; elke productpagina laat zien wie het heeft.',
    q1: 'Wat is de volgende Pokémon TCG-set?', q2: (n) => `Wanneer komt ${n} uit?`, q3: (c) => `Zijn de data in ${c} hetzelfde?`,
    a3: 'Engelse producten verschijnen meestal wereldwijd op dezelfde dag; sommige winkels leveren een paar dagen later.' },
};
const countryIn = (cc) => new Intl.DisplayNames([COUNTRIES[cc].lang], { type: 'region' }).of(cc === 'uk' ? 'GB' : cc.toUpperCase());
const short = (n) => n.split(/ \(|,|:|;/)[0];

export async function upcomingPage(env, cc) {
  if (cc === 'jp' || !COUNTRIES[cc]) return null;
  const T = t(cc); const lang = COUNTRIES[cc].lang; const W = L[lang] ?? L.en; const C = countryIn(cc);
  const ts = now(); const today = new Date(ts).toISOString().slice(0, 10);
  const fmt = (iso) => new Intl.DateTimeFormat(T.cc.locale, { dateStyle: 'long', timeZone: 'UTC' }).format(new Date(iso));
  const skus = (await d.allSkus(env, cc).catch(() => [])).filter(sealed);
  const inStock = (r) => (r.match ? skus.filter((k) => k.places_in > 0 && r.match(k.name)).length : null);
  const rows = RELEASES.map((r) => ({ ...r, past: r.date <= today, n: inStock(r) }));
  const upcoming = rows.filter((r) => !r.past && !r.jp && !r.id.startsWith('jp-'));
  const nextR = upcoming[0];
  const justOut = rows.filter((r) => r.past && r.n).sort((a, b) => b.n - a.n)[0];
  const stat = (r) => (r.past ? W.st.released : W.st[r.status]);
  const when = (r) => `${r.approx ? `${W.approx} ` : ''}${fmt(r.date)}`;
  const lede = [nextR ? W.next(short(nextR.name), when(nextR), stat(nextR)) : '', justOut ? W.out(short(justOut.name), justOut.n) : ''].filter(Boolean).join(' ');
  const link = (r) => r.guide ? `<a class="btn small go" href="${guidePath(cc, r.guide)}">${e(W.buy)} →</a>`
    : r.thirty ? `<a class="btn small" href="${thirtyPath(cc)}">${e(W.stock)} →</a>`
    : r.jp ? `<a class="btn small" href="/jp">${e(W.jp)} →</a>`
    : `<a class="btn small" href="/alerts?${new URLSearchParams({ c: cc })}" data-ev="sheet_open">🔔 ${e(W.alert)}</a>`;
  const body = `<div class="answer"><h1>${e(W.h1(C))}</h1><p class="asof">${e(W.checked(fmt(CHECKED), T.f.when(ts)))}</p><p class="lede">${e(lede)}</p></div>
  <section><div class="table-scroll"><table><thead><tr>${W.th.map((x) => `<th>${e(x)}</th>`).join('')}</tr></thead><tbody>
  ${rows.map((r) => `<tr><td><time datetime="${r.date}">${e(when(r))}</time></td><td>${e(r.name)}${r.past && r.n ? ` <span class="tag in">✓ ${r.n}</span>` : ''}</td><td>${r.past ? `<span class="tag in">${e(stat(r))}</span>` : e(stat(r))}</td><td>${link(r)}</td></tr>`).join('')}
  </tbody></table></div><p class="sub">${e(W.note)}</p></section>`;
  const nextFF = rows.find((r) => r.id === 'flowing-fists');
  const a = answers([
    ...(nextR ? [{ q: W.q1, a: W.next(nextR.name, when(nextR), stat(nextR)) }] : []),
    ...(nextFF && !nextFF.past ? [{ q: W.q2('Flowing Fists'), a: W.next(nextFF.name, when(nextFF), stat(nextFF)) }] : []),
    { q: W.q3(C), a: W.a3 },
  ], 'FAQ');
  const live = await d.liveCountries(env);
  const alternates = Object.fromEntries([...live].filter((c) => COUNTRIES[c] && c !== 'jp').map((c) => [c, upcomingPath(c)]));
  const month = new Intl.DateTimeFormat(T.cc.locale, { month: 'long', year: 'numeric', timeZone: 'UTC' }).format(new Date(ts));
  return page(env, T, { title: `${W.title(C, month)} | ${env.BRAND_NAME}`, description: lede.slice(0, 155), path: upcomingPath(cc), body, jsonLd: [a.ld], alternates, xDefault: alternates.us ?? '/' });
}
