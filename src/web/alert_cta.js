// "Alert me" block high on product pages and country homes (2026-11-18, analyse actions 3 and 4):
// ChatGPT visitors land there, about 43% click a shop but about 1% set an alert, because the alert offer sat far down the page.
// Static HTML (edge cache safe). On iPhone the "Add to Home Screen" line and on Android the install button
// are shown by public/app.js; visitors from the installed app set an alert far more often.
import { escapeHtml as e } from '../lib/util.js';
import { pushWords } from './pwa.js';

const W = {
  en: { short: (p) => `Instant alert from ${p}`, freeShort: 'or free as a daily email', home: 'Sold out? Get an alert when it is back', price: (p) => `Instant alerts from ${p} for 30 days. Cancel in 2 clicks.`, ios: 'On iPhone: tap Share, then “Add to Home Screen” to get your alerts as notifications.' },
  fr: { short: (p) => `Alerte instantanée dès ${p}`, freeShort: 'ou gratuite par e-mail quotidien', home: 'Épuisé ? Recevez une alerte dès qu’il revient', price: (p) => `Alertes instantanées dès ${p} pour 30 jours. Résiliable en 2 clics.`, ios: 'Sur iPhone : touchez Partager, puis « Sur l’écran d’accueil » pour recevoir vos alertes en notification.' },
  de: { short: (p) => `Sofort-Alarm ab ${p}`, freeShort: 'oder gratis als tägliche E-Mail', home: 'Ausverkauft? Hol dir einen Alarm, sobald es zurück ist', price: (p) => `Sofort-Alarme ab ${p} für 30 Tage. Mit 2 Klicks kündbar.`, ios: 'Auf dem iPhone: Teilen, dann „Zum Home-Bildschirm“ – so kommen deine Alarme als Mitteilung.' },
  it: { short: (p) => `Avviso istantaneo da ${p}`, freeShort: 'o gratis via email giornaliera', home: 'Esaurito? Ricevi un avviso appena torna', price: (p) => `Avvisi istantanei da ${p} per 30 giorni. Disdici in 2 clic.`, ios: 'Su iPhone: tocca Condividi, poi “Aggiungi alla schermata Home” per ricevere gli avvisi come notifiche.' },
  es: { short: (p) => `Alerta al instante desde ${p}`, freeShort: 'o gratis por email diario', home: '¿Agotado? Recibe una alerta en cuanto vuelva', price: (p) => `Alertas al instante desde ${p} por 30 días. Cancelable en 2 clics.`, ios: 'En iPhone: toca Compartir y luego «Añadir a pantalla de inicio» para recibir tus alertas como notificación.' },
  nl: { short: (p) => `Directe melding vanaf ${p}`, freeShort: 'of gratis als dagelijkse e-mail', home: 'Uitverkocht? Krijg een melding zodra het terug is', price: (p) => `Directe meldingen vanaf ${p} voor 30 dagen. Opzegbaar in 2 klikken.`, ios: 'Op iPhone: tik op Deel en dan op “Zet op beginscherm” om je meldingen als pushbericht te krijgen.' },
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

export const homeAlertTitle = (T) => words(T).home;
