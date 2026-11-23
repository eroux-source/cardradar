// "Alert me" block high on product pages and country homes (2026-11-18, analyse actions 3 and 4):
// ChatGPT visitors land there, about 43% click a shop but about 1% set an alert, because the alert offer sat far down the page.
// Static HTML (edge cache safe). On iPhone the "Add to Home Screen" line and on Android the install button
// are shown by public/app.js; visitors from the installed app set an alert far more often.
import { escapeHtml as e } from '../lib/util.js';
import { pushWords } from './pwa.js';

const W = {
  en: { line: (p) => `Missed it? Instant restock alert from ${p}`, short: (p) => `Instant alert from ${p}`, freeShort: 'or free as a daily email', home: 'Sold out? Get an alert when it is back', price: (p) => `An email the moment we spot it, with a direct link to the shop. From ${p} for 30 days, cancel in 2 clicks.`, ios: 'On iPhone: tap Share, then “Add to Home Screen” to get your alerts as notifications.' },
  fr: { line: (p) => `Raté ? Alerte réassort instantanée dès ${p}`, short: (p) => `Alerte instantanée dès ${p}`, freeShort: 'ou gratuite par e-mail quotidien', home: 'Épuisé ? Recevez une alerte dès qu’il revient', price: (p) => `Un e-mail dès que nous le repérons, avec le lien direct vers la boutique. Dès ${p} pour 30 jours, résiliable en 2 clics.`, ios: 'Sur iPhone : touchez Partager, puis « Sur l’écran d’accueil » pour recevoir vos alertes en notification.' },
  de: { line: (p) => `Verpasst? Sofort-Restock-Alarm ab ${p}`, short: (p) => `Sofort-Alarm ab ${p}`, freeShort: 'oder gratis als tägliche E-Mail', home: 'Ausverkauft? Hol dir einen Alarm, sobald es zurück ist', price: (p) => `Eine E-Mail, sobald wir es sehen, mit direktem Link zum Shop. Ab ${p} für 30 Tage, mit 2 Klicks kündbar.`, ios: 'Auf dem iPhone: Teilen, dann „Zum Home-Bildschirm“ – so kommen deine Alarme als Mitteilung.' },
  it: { line: (p) => `Perso? Avviso restock istantaneo da ${p}`, short: (p) => `Avviso istantaneo da ${p}`, freeShort: 'o gratis via email giornaliera', home: 'Esaurito? Ricevi un avviso appena torna', price: (p) => `Un’email appena lo vediamo, con il link diretto al negozio. Da ${p} per 30 giorni, disdici in 2 clic.`, ios: 'Su iPhone: tocca Condividi, poi “Aggiungi alla schermata Home” per ricevere gli avvisi come notifiche.' },
  es: { line: (p) => `¿Te lo perdiste? Alerta de reposición al instante desde ${p}`, short: (p) => `Alerta al instante desde ${p}`, freeShort: 'o gratis por email diario', home: '¿Agotado? Recibe una alerta en cuanto vuelva', price: (p) => `Un email en cuanto lo detectamos, con el enlace directo a la tienda. Desde ${p} por 30 días, cancelable en 2 clics.`, ios: 'En iPhone: toca Compartir y luego «Añadir a pantalla de inicio» para recibir tus alertas como notificación.' },
  nl: { line: (p) => `Gemist? Directe restockmelding vanaf ${p}`, short: (p) => `Directe melding vanaf ${p}`, freeShort: 'of gratis als dagelijkse e-mail', home: 'Uitverkocht? Krijg een melding zodra het terug is', price: (p) => `Een e-mail zodra we het zien, met een directe link naar de winkel. Vanaf ${p} voor 30 dagen, opzegbaar in 2 klikken.`, ios: 'Op iPhone: tik op Deel en dan op “Zet op beginscherm” om je meldingen als pushbericht te krijgen.' },
};
const words = (T) => W[T.cc.lang] ?? W.en;

/**
 * @param T i18n bundle, @param href alert funnel link, @param opts.title heading, @param opts.out sold out (stronger look), @param opts.from tracking label
 */
export function alertBlock(T, href, { title, out = false, from = 'hero' } = {}) {
  const w = words(T); const P = pushWords(T);
  return `<div class="cta-alert${out ? ' is-out' : ''}">
    <div class="cta-alert-text"><strong><span class="bell-ico" aria-hidden="true">🔔</span> ${e(title ?? w.home)}</strong><span>${e(w.price(T.f.planMoney(T.cc.prices.solo)))}</span></div>
    <div class="cta-alert-go"><a class="btn go" href="${e(href)}" data-ev="sheet_open" data-from="${e(from)}">${e(T.sv.alertBtn)}</a><button class="btn ghost pwa-install" type="button" data-pwa-install hidden>${e(P.install)}</button></div>
    <p class="cta-ios fine" data-ios-hint hidden>📱 ${e(w.ios)}</p></div>`;
}

/** Bar pinned to the bottom of the screen on phones once the alert block above has scrolled away (product pages). */
export function stickyAlert(T, href) {
  const w = words(T);
  return `<div class="sticky-alert" data-sticky-alert hidden><span class="sticky-alert-text"><strong><span class="bell-ico" aria-hidden="true">🔔</span> ${e(w.short(T.f.planMoney(T.cc.prices.solo)))}</strong></span><a class="btn go" href="${e(href)}" data-ev="sheet_open" data-from="sticky">${e(T.sv.alertBtn)}</a></div>`;
}

/** One compact line above the shop list when the product is in stock (2026-11-23): the big block pushed the first
 *  "Buy" link below the first phone screen and shop clicks fell from about 45% to 23-38%. The big block goes after the list. */
export function alertLine(T, href, from = 'product_top') {
  return `<p class="cta-line"><a href="${e(href)}" data-ev="sheet_open" data-from="${e(from)}"><span class="bell-ico" aria-hidden="true">🔔</span> ${e(words(T).line(T.f.planMoney(T.cc.prices.solo)))} →</a></p>`;
}

export const homeAlertTitle = (T) => words(T).home;
