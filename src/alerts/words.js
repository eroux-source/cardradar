// Restock alert texts (email + push) in the language of the alert's country (2026-11-11).
// es covers es, mx and cl. Japan has lottery notices of its own (src/crawler/lotteries.js).
import { COUNTRIES } from '../data/countries.js';

const qtyIf = (q, w) => (q > 1 ? ` (${q} ${w})` : '');
const W = {
  en: {
    title: (n) => `In stock: ${n}`, online: (s) => `${s} online`,
    line: (n, w, q) => `${n} is in stock at ${w}${qtyIf(q, 'available')}.`,
    buy: 'Buy or reserve', live: 'Live stock', foot: 'Stock moves within minutes. Check the retailer before you travel.',
    digest: (k) => `${k} restocks you asked about`,
  },
  fr: {
    title: (n) => `En stock : ${n}`, online: (s) => `${s}, en ligne`,
    line: (n, w, q) => `${n} est en stock chez ${w}${qtyIf(q, 'disponibles')}.`,
    buy: 'Acheter ou réserver', live: 'Stock en direct', foot: 'Le stock part souvent en quelques minutes. Vérifiez chez le vendeur avant de vous déplacer.',
    digest: (k) => `${k} réassorts que vous suivez`,
  },
  de: {
    title: (n) => `Auf Lager: ${n}`, online: (s) => `${s} online`,
    line: (n, w, q) => `${n} ist bei ${w} auf Lager${qtyIf(q, 'verfügbar')}.`,
    buy: 'Kaufen oder reservieren', live: 'Live-Bestand', foot: 'Der Bestand ist oft in wenigen Minuten weg. Prüfe beim Händler, bevor du losgehst.',
    digest: (k) => `${k} Restocks, die du beobachtest`,
  },
  es: {
    title: (n) => `En stock: ${n}`, online: (s) => `${s}, online`,
    line: (n, w, q) => `${n} está en stock en ${w}${qtyIf(q, 'disponibles')}.`,
    buy: 'Comprar o reservar', live: 'Stock en directo', foot: 'El stock suele agotarse en minutos. Compruébalo en la tienda antes de desplazarte.',
    digest: (k) => `${k} reposiciones que sigues`,
  },
  it: {
    title: (n) => `Disponibile: ${n}`, online: (s) => `${s} online`,
    line: (n, w, q) => `${n} è disponibile da ${w}${qtyIf(q, 'disponibili')}.`,
    buy: 'Acquista o prenota', live: 'Disponibilità in tempo reale', foot: 'Le scorte finiscono spesso in pochi minuti. Verifica sul sito del negozio prima di muoverti.',
    digest: (k) => `${k} riassortimenti che segui`,
  },
  nl: {
    title: (n) => `Op voorraad: ${n}`, online: (s) => `${s} online`,
    line: (n, w, q) => `${n} is op voorraad bij ${w}${qtyIf(q, 'beschikbaar')}.`,
    buy: 'Kopen of reserveren', live: 'Live voorraad', foot: 'Voorraad is vaak binnen enkele minuten weg. Check de winkel voordat je gaat.',
    digest: (k) => `${k} restocks die je volgt`,
  },
};

export const langOf = (cc) => (W[COUNTRIES[cc]?.lang] ? COUNTRIES[cc].lang : 'en');
export const alertWords = (lang) => W[lang] ?? W.en;

/** Solo price and plans link of a country (JP, MX, CL pay the US plan). */
export function planOf(env, cc) {
  const c = cc && COUNTRIES[cc] && cc !== 'jp' && COUNTRIES[cc].prices ? cc : 'us';
  const C = COUNTRIES[c];
  return { solo: new Intl.NumberFormat(C.locale, { style: 'currency', currency: C.currency }).format(Number(C.prices.solo)), link: `${env.BASE_URL}${c === 'us' ? '' : `/${c}`}/pricing` };
}

/** One line in the instant alerts of grace-week accounts (behind UPSELL_TEXT, text approved by Eugène). */
export const graceLine = (env, cc, lang) => {
  const p = planOf(env, cc);
  return lang === 'fr'
    ? `Gratuit pour toi jusqu'au lundi 23 novembre. Ensuite, garde tes alertes instantanées avec Solo à ${p.solo} pour 30 jours : ${p.link}`
    : `Free for you until Monday 23 November. After that, keep instant alerts with Solo at ${p.solo} for 30 days: ${p.link}`;
};

/** Email body of one alert: the digest splits on the closing line, so keep it last. */
export const alertEmailText = (msg, lang, extra = '') => {
  const L = alertWords(lang);
  return `${msg.line}\n\n${L.buy}: ${msg.url}\n${L.live}: ${msg.page}${extra ? `\n\n${extra}` : ''}\n\n${L.foot}`;
};

/** For the hourly digest: the language of a queued alert email and its text without the closing line. */
export function splitAlertEmail(text) {
  for (const [lang, L] of Object.entries(W)) {
    const i = text.lastIndexOf(`\n\n${L.foot}`);
    if (i >= 0) return { lang, body: text.slice(0, i) };
  }
  return { lang: 'en', body: text.split('\n\nStock moves')[0] };
}
