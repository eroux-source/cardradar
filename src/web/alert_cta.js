// "Alert me" block high on product pages and country homes (2026-11-18, analyse actions 3 and 4):
// ChatGPT visitors land there, about 43% click a shop but about 1% set an alert, because the alert offer sat far down the page.
// Static HTML (edge cache safe). On iPhone the "Add to Home Screen" line and on Android the install button
// are shown by public/app.js; visitors from the installed app set an alert far more often.
import { escapeHtml as e } from '../lib/util.js';
import { pushWords } from './pwa.js';

const W = {
  en: { home: 'Sold out? Get an alert when it is back', price: (p) => `Free as a daily email, or instant from ${p} for 30 days.`, ios: 'On iPhone: tap Share, then “Add to Home Screen” to get your alerts as notifications.' },
  fr: { home: 'Épuisé ? Recevez une alerte dès qu’il revient', price: (p) => `Gratuit en e-mail quotidien, ou instantané dès ${p} pour 30 jours.`, ios: 'Sur iPhone : touchez Partager, puis « Sur l’écran d’accueil » pour recevoir vos alertes en notification.' },
  de: { home: 'Ausverkauft? Hol dir einen Alarm, sobald es zurück ist', price: (p) => `Gratis als tägliche E-Mail oder sofort ab ${p} für 30 Tage.`, ios: 'Auf dem iPhone: Teilen, dann „Zum Home-Bildschirm“ – so kommen deine Alarme als Mitteilung.' },
  it: { home: 'Esaurito? Ricevi un avviso appena torna', price: (p) => `Gratis come email giornaliera, o istantaneo da ${p} per 30 giorni.`, ios: 'Su iPhone: tocca Condividi, poi “Aggiungi alla schermata Home” per ricevere gli avvisi come notifiche.' },
  es: { home: '¿Agotado? Recibe una alerta en cuanto vuelva', price: (p) => `Gratis como email diario, o al instante desde ${p} por 30 días.`, ios: 'En iPhone: toca Compartir y luego «Añadir a pantalla de inicio» para recibir tus alertas como notificación.' },
  nl: { home: 'Uitverkocht? Krijg een melding zodra het terug is', price: (p) => `Gratis als dagelijkse e-mail, of direct vanaf ${p} voor 30 dagen.`, ios: 'Op iPhone: tik op Deel en dan op “Zet op beginscherm” om je meldingen als pushbericht te krijgen.' },
};
const words = (T) => W[T.cc.lang] ?? W.en;

/**
 * @param T i18n bundle, @param href alert funnel link, @param opts.title heading, @param opts.out sold out (stronger look), @param opts.from tracking label
 */
export function alertBlock(T, href, { title, out = false, from = 'hero' } = {}) {
  const w = words(T); const P = pushWords(T);
  return `<div class="cta-alert${out ? ' is-out' : ''}">
    <div class="cta-alert-text"><strong>🔔 ${e(title ?? w.home)}</strong><span>${e(w.price(T.f.planMoney(T.cc.prices.solo)))}</span></div>
    <div class="cta-alert-go"><a class="btn go" href="${e(href)}" data-ev="sheet_open" data-from="${e(from)}">${e(T.sv.alertBtn)}</a><button class="btn ghost pwa-install" type="button" data-pwa-install hidden>${e(P.install)}</button></div>
    <p class="cta-ios fine" data-ios-hint hidden>📱 ${e(w.ios)}</p></div>`;
}

export const homeAlertTitle = (T) => words(T).home;
