// Installable web app + free push notifications (2026-11-11).
// - /manifest.webmanifest?c=<cc>: one app ("id": "/"), start page = the country home.
// - The push option shows only when the setting push_public is 'on', or to the owner
//   (so the owner can test end to end before anyone else sees it).
// - Server-rendered blocks for the alert form and /account; the logic is in public/app.js.
// Public pages are untouched (edge cache, SEO): nothing here runs on them.
import { COUNTRIES } from '../data/countries.js';
import { isFlagOn } from '../lib/db.js';
import { home } from './html.js';

const e = (s) => String(s ?? '').replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));

export function webManifest(env, url) {
  const cc = COUNTRIES[url.searchParams.get('c')] && url.searchParams.get('c') !== 'jp' ? url.searchParams.get('c') : 'us';
  const L = UI[COUNTRIES[cc].lang] ?? UI.en;
  const m = {
    id: '/', name: env.BRAND_NAME ?? 'Card Restock Tracker', short_name: 'Restocks', description: L.appDesc,
    lang: COUNTRIES[cc].locale, dir: 'ltr',
    start_url: `${home(cc)}?utm_source=homescreen`, scope: '/', display: 'standalone', orientation: 'portrait',
    background_color: '#f4f6fa', theme_color: '#1a1f3a',
    icons: [
      { src: '/icon-192.png', sizes: '192x192', type: 'image/png', purpose: 'any' },
      { src: '/icon-512.png', sizes: '512x512', type: 'image/png', purpose: 'any' },
      { src: '/icon-maskable-512.png', sizes: '512x512', type: 'image/png', purpose: 'maskable' },
      { src: '/icon.svg', sizes: 'any', type: 'image/svg+xml', purpose: 'any' },
    ],
  };
  return new Response(JSON.stringify(m), { headers: { 'content-type': 'application/manifest+json; charset=utf-8', 'cache-control': 'public, max-age=86400' } });
}

/** Push option visible to this person? Owner always (for testing), everyone once push_public is on. */
export async function pushVisible(env, user) {
  if (!env.VAPID_PUBLIC_KEY) return false;
  if (await isFlagOn(env, 'push_public')) return true;
  const owners = String(env.OWNER_EMAILS ?? '').toLowerCase().split(',').map((x) => x.trim()).filter(Boolean);
  return !!user && owners.includes(String(user.email).toLowerCase());
}

const UI = {
  en: {
    appDesc: 'Pokémon TCG stock and restock alerts, free.',
    opt: 'Also get a phone notification', optFine: 'Free, at the same time as the email.',
    h: 'Notifications on this device', on: 'On: restock alerts show up here, at the same time as the email.', off: 'Off on this device.',
    enable: 'Turn on notifications', test: 'Send a test', disable: 'Turn off', sent: 'Sent ✓',
    unsupported: 'This browser cannot show notifications. Your alerts still arrive by email.',
    denied: 'Notifications are blocked for this site. Allow them in your browser or phone settings, then try again.',
    iosH: 'On iPhone, add the app to your Home Screen first', iosLead: 'Apple only allows notifications from apps on the Home Screen. It takes 10 seconds, it is free and there is nothing to download from the App Store.',
    ios1: 'In Safari, tap Share', ios2: 'Choose', ios3: 'Open Restocks from your Home Screen, sign in, then turn on notifications.',
    iosMenu: 'Add to Home Screen', iosNotSafari: 'Open this page in Safari to do it.',
    install: 'Install the app', installFine: 'Free, opens like an app, no store.',
    bar: 'Turn on restock notifications',
  },
  fr: {
    appDesc: 'Stock et réassorts Pokémon TCG, alertes gratuites.',
    opt: 'Recevoir aussi en notification', optFine: 'Gratuit, en même temps que l’e-mail.',
    h: 'Notifications sur cet appareil', on: 'Activées : les alertes de réassort arrivent ici, en même temps que l’e-mail.', off: 'Désactivées sur cet appareil.',
    enable: 'Activer les notifications', test: 'Envoyer un test', disable: 'Désactiver', sent: 'Envoyé ✓',
    unsupported: 'Ce navigateur ne peut pas afficher de notifications. Vos alertes arrivent toujours par e-mail.',
    denied: 'Les notifications sont bloquées pour ce site. Autorisez-les dans les réglages du navigateur ou du téléphone, puis réessayez.',
    iosH: 'Sur iPhone, ajoutez d’abord l’app à l’écran d’accueil', iosLead: 'Apple n’autorise les notifications que pour les apps de l’écran d’accueil. Ça prend 10 secondes, c’est gratuit, rien à télécharger sur l’App Store.',
    ios1: 'Dans Safari, touchez Partager', ios2: 'Choisissez', ios3: 'Ouvrez Restocks depuis l’écran d’accueil, connectez-vous, puis activez les notifications.',
    iosMenu: 'Sur l’écran d’accueil', iosNotSafari: 'Ouvrez cette page dans Safari pour le faire.',
    install: 'Installer l’app', installFine: 'Gratuit, s’ouvre comme une app, sans store.',
    bar: 'Activer les notifications de réassort',
  },
  de: {
    appDesc: 'Pokémon-TCG-Bestand und Restocks, kostenlose Alarme.',
    opt: 'Auch als Benachrichtigung erhalten', optFine: 'Kostenlos, gleichzeitig mit der E-Mail.',
    h: 'Benachrichtigungen auf diesem Gerät', on: 'An: Restock-Alarme erscheinen hier, gleichzeitig mit der E-Mail.', off: 'Auf diesem Gerät aus.',
    enable: 'Benachrichtigungen einschalten', test: 'Test senden', disable: 'Ausschalten', sent: 'Gesendet ✓',
    unsupported: 'Dieser Browser kann keine Benachrichtigungen anzeigen. Deine Alarme kommen weiter per E-Mail.',
    denied: 'Benachrichtigungen sind für diese Seite blockiert. Erlaube sie in den Browser- oder Handy-Einstellungen und versuche es erneut.',
    iosH: 'Auf dem iPhone zuerst die App zum Home-Bildschirm hinzufügen', iosLead: 'Apple erlaubt Benachrichtigungen nur für Apps auf dem Home-Bildschirm. Dauert 10 Sekunden, kostenlos, kein App Store.',
    ios1: 'Tippe in Safari auf Teilen', ios2: 'Wähle', ios3: 'Öffne Restocks vom Home-Bildschirm, melde dich an und schalte die Benachrichtigungen ein.',
    iosMenu: 'Zum Home-Bildschirm', iosNotSafari: 'Öffne diese Seite dafür in Safari.',
    install: 'App installieren', installFine: 'Kostenlos, öffnet sich wie eine App, ohne Store.',
    bar: 'Restock-Benachrichtigungen einschalten',
  },
  es: {
    appDesc: 'Stock y reposiciones de Pokémon TCG, alertas gratis.',
    opt: 'Recibir también una notificación', optFine: 'Gratis, a la vez que el email.',
    h: 'Notificaciones en este dispositivo', on: 'Activadas: las alertas de reposición llegan aquí, a la vez que el email.', off: 'Desactivadas en este dispositivo.',
    enable: 'Activar notificaciones', test: 'Enviar una prueba', disable: 'Desactivar', sent: 'Enviado ✓',
    unsupported: 'Este navegador no puede mostrar notificaciones. Tus alertas siguen llegando por email.',
    denied: 'Las notificaciones están bloqueadas para este sitio. Permítelas en los ajustes del navegador o del móvil y vuelve a intentarlo.',
    iosH: 'En iPhone, primero añade la app a la pantalla de inicio', iosLead: 'Apple solo permite notificaciones de apps en la pantalla de inicio. Son 10 segundos, gratis y sin App Store.',
    ios1: 'En Safari, toca Compartir', ios2: 'Elige', ios3: 'Abre Restocks desde la pantalla de inicio, inicia sesión y activa las notificaciones.',
    iosMenu: 'Añadir a pantalla de inicio', iosNotSafari: 'Abre esta página en Safari para hacerlo.',
    install: 'Instalar la app', installFine: 'Gratis, se abre como una app, sin tienda.',
    bar: 'Activar notificaciones de reposición',
  },
  it: {
    appDesc: 'Disponibilità e riassortimenti Pokémon TCG, avvisi gratuiti.',
    opt: 'Ricevi anche una notifica', optFine: 'Gratis, insieme all’email.',
    h: 'Notifiche su questo dispositivo', on: 'Attive: gli avvisi di riassortimento arrivano qui, insieme all’email.', off: 'Disattivate su questo dispositivo.',
    enable: 'Attiva le notifiche', test: 'Invia una prova', disable: 'Disattiva', sent: 'Inviato ✓',
    unsupported: 'Questo browser non può mostrare notifiche. I tuoi avvisi arrivano comunque via email.',
    denied: 'Le notifiche sono bloccate per questo sito. Consentile nelle impostazioni del browser o del telefono e riprova.',
    iosH: 'Su iPhone, aggiungi prima l’app alla schermata Home', iosLead: 'Apple consente le notifiche solo alle app nella schermata Home. Bastano 10 secondi, è gratis e non serve l’App Store.',
    ios1: 'In Safari, tocca Condividi', ios2: 'Scegli', ios3: 'Apri Restocks dalla schermata Home, accedi e attiva le notifiche.',
    iosMenu: 'Aggiungi alla schermata Home', iosNotSafari: 'Apri questa pagina in Safari per farlo.',
    install: 'Installa l’app', installFine: 'Gratis, si apre come un’app, senza store.',
    bar: 'Attiva le notifiche di riassortimento',
  },
  nl: {
    appDesc: 'Pokémon TCG-voorraad en restocks, gratis alerts.',
    opt: 'Ook een melding ontvangen', optFine: 'Gratis, tegelijk met de e-mail.',
    h: 'Meldingen op dit apparaat', on: 'Aan: restock-alerts verschijnen hier, tegelijk met de e-mail.', off: 'Uit op dit apparaat.',
    enable: 'Meldingen aanzetten', test: 'Test sturen', disable: 'Uitzetten', sent: 'Verstuurd ✓',
    unsupported: 'Deze browser kan geen meldingen tonen. Je alerts komen nog steeds per e-mail.',
    denied: 'Meldingen zijn geblokkeerd voor deze site. Sta ze toe in de instellingen van je browser of telefoon en probeer opnieuw.',
    iosH: 'Zet op iPhone eerst de app op je beginscherm', iosLead: 'Apple staat meldingen alleen toe voor apps op het beginscherm. Duurt 10 seconden, gratis, geen App Store.',
    ios1: 'Tik in Safari op Deel', ios2: 'Kies', ios3: 'Open Restocks vanaf je beginscherm, log in en zet meldingen aan.',
    iosMenu: 'Zet op beginscherm', iosNotSafari: 'Open deze pagina daarvoor in Safari.',
    install: 'App installeren', installFine: 'Gratis, opent als een app, zonder store.',
    bar: 'Restock-meldingen aanzetten',
  },
};
export const pushWords = (T) => UI[T.cc.lang] ?? UI.en;

const SHARE_ICON = '<svg class="ios-share" viewBox="0 0 20 24" width="16" height="19" aria-hidden="true"><path d="M10 2v13M5.5 6.5 10 2l4.5 4.5" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/><path d="M6 10H3.5v12h13V10H14" fill="none" stroke="currentColor" stroke-width="2" stroke-linejoin="round"/></svg>';
const ADD_ICON = '<svg viewBox="0 0 20 20" width="16" height="16" aria-hidden="true"><rect x="1.5" y="1.5" width="17" height="17" rx="4" fill="none" stroke="currentColor" stroke-width="1.8"/><path d="M10 6v8M6 10h8" stroke="currentColor" stroke-width="1.8" stroke-linecap="round"/></svg>';

/** iPhone: Share → "Add to Home Screen" picture + 3 steps. */
export function iosInstallCard(T, { hidden = true } = {}) {
  const L = pushWords(T);
  return `<div class="ios-install"${hidden ? ' hidden' : ''} data-pwa-ios>
  <p><strong>${e(L.iosH)}</strong></p><p class="fine">${e(L.iosLead)}</p>
  <div class="ios-pic" aria-hidden="true">
    <div class="ios-bar"><span>‹</span><span>›</span><span class="ios-hl">${SHARE_ICON}</span><span>▢</span><span>⧉</span></div>
    <span class="ios-arrow">→</span>
    <div class="ios-sheet"><span class="ios-row">${e(L.iosMenu)} ${ADD_ICON}</span></div>
  </div>
  <ol class="ios-steps"><li>${e(L.ios1)} ${SHARE_ICON}</li><li>${e(L.ios2)} « ${e(L.iosMenu)} » ${ADD_ICON}</li><li>${e(L.ios3)}</li></ol>
  <p class="fine" data-pwa-not-safari hidden>${e(L.iosNotSafari)}</p>
</div>`;
}

/** Tick box in the alert form (plan step). */
export function pushOption(T) {
  const L = pushWords(T);
  return `<fieldset class="channels push-opt" data-push-opt hidden><label class="radio"><input type="checkbox" name="push" value="1"> ${e(L.opt)} <span class="fine">${e(L.optFine)}</span></label>
  <p class="fine push-msg" role="status"></p>${iosInstallCard(T)}</fieldset>`;
}

/** /account block: state of this device, turn on / test / turn off, install. */
export function pushAccountBlock(T) {
  const L = pushWords(T);
  return `<section id="push-box" data-lang="${e(T.cc.lang)}" data-t-on="${e(L.on)}" data-t-off="${e(L.off)}" data-t-unsupported="${e(L.unsupported)}" data-t-denied="${e(L.denied)}" data-t-sent="${e(L.sent)}">
  <h2>🔔 ${e(L.h)}</h2>
  <p class="push-state" role="status"></p>
  <p class="push-actions" hidden><button class="btn" type="button" data-push="on">${e(L.enable)}</button>
    <button class="btn ghost small" type="button" data-push="test" hidden>${e(L.test)}</button>
    <button class="link" type="button" data-push="off" hidden>${e(L.disable)}</button></p>
  <p class="pwa-install" hidden><button class="btn ghost" type="button" data-pwa-install>${e(L.install)}</button> <span class="fine">${e(L.installFine)}</span></p>
  ${iosInstallCard(T)}
</section>`;
}
