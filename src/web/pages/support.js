// "Support the site" page (2026-11-06): one-time tips through Whop while the site stays free.
// Whop one-time plans of the product "Support Card Restock Tracker" (public ids, also in wrangler.toml).
import { t } from '../../i18n/index.js';
import { page } from '../html.js';
import { escapeHtml as e } from '../../lib/util.js';

export const TIP_PLANS = {
  eur: { 1: 'plan_g32MZoDt4Ma8B', 2: 'plan_WzETiAmiUq4d9', 5: 'plan_SxQQceuTrVrnp' },
  usd: { 1: 'plan_OuIzJ8IMLpvcL', 2: 'plan_cKKAUKjeXuUrk', 5: 'plan_n1eoY9KfIkeP1' },
};
export const isTipPlan = (id) => Object.values(TIP_PLANS).some((p) => Object.values(p).includes(id));

// Euro plans in Europe (Whop shows the buyer's own currency, £ in the UK), dollar plans elsewhere
const EURO = new Set(['uk', 'de', 'fr', 'nl', 'it', 'es']);

export const supportHref = (cc) => (cc === 'us' ? '/support' : `/${cc}/support`);
// Header button (short word) and the band shown under the content of public pages
export const SUPPORT_BAND = {
  en: { h: 'Support', t: 'Free, ad-free, made by a fellow fan.', s: 'A small tip keeps it running for everyone.', b: '♥ Support the site' },
  fr: { h: 'Soutenir', t: 'Gratuit, sans pub, fait par un fan.', s: 'Un coup de pouce de 1 € ou 2 € aide à le garder en ligne pour tout le monde.', b: '♥ Soutenir le site' },
  de: { h: 'Unterstützen', t: 'Kostenlos, werbefrei, von einem Fan gemacht.', s: 'Ein Beitrag von 1 € oder 2 € hält die Seite für alle am Laufen.', b: '♥ Seite unterstützen' },
  nl: { h: 'Steunen', t: 'Gratis, zonder advertenties, gemaakt door een fan.', s: 'Een bijdrage van € 1 of € 2 houdt de site voor iedereen online.', b: '♥ Steun de site' },
  it: { h: 'Sostieni', t: 'Gratis, senza pubblicità, fatto da un fan.', s: 'Un contributo di 1 € o 2 € lo tiene online per tutti.', b: '♥ Sostieni il sito' },
  es: { h: 'Apoyar', t: 'Gratis, sin anuncios, hecho por un fan.', s: 'Una ayuda de 1 € o 2 € lo mantiene en línea para todos.', b: '♥ Apoya la web' },
};
export const SUPPORT_NAV = { en: 'Support us ♥', fr: 'Nous soutenir ♥', de: 'Unterstützen ♥', nl: 'Steun ons ♥', it: 'Sostienici ♥', es: 'Apóyanos ♥' };

const COPY = {
  en: {
    title: 'Support Card Restock Tracker', h1: 'Help keep Card Restock Tracker free ♥',
    p: [
      'Hey trainer! I\'m a Pokémon TCG fan who got tired of watching Elite Trainer Boxes and booster boxes vanish to scalpers. So I built this site: it checks independent card shops around the clock (sold-out items hourly), so you can find sealed product at shop prices.',
      'It\'s free for now, with no ads, and I\'d love to keep it that way. Servers and shop checks do cost a little every month, though.',
      'If the site helped you snag a box, a small tip of {1} or {2} is already amazing. Thank you, and happy pulls! ✨',
    ],
    fine: 'One-time payment, no subscription. Secure checkout by Whop (card, Apple Pay, Google Pay).', back: 'Back to live stock',
  },
  fr: {
    title: 'Soutenir Card Restock Tracker', h1: 'Aide-nous à garder Card Restock Tracker gratuit ♥',
    p: [
      'Salut dresseur ! Je suis fan du JCC Pokémon, et j\'en avais marre de voir les coffrets Dresseur d\'Élite et les displays filer chez les revendeurs. Alors j\'ai créé ce site : il vérifie jour et nuit les boutiques indépendantes (les produits épuisés toutes les heures) pour que tu trouves tes produits scellés au prix boutique.',
      'C\'est gratuit pour l\'instant, sans pub, et j\'aimerais que ça le reste. Mais les serveurs et les vérifications des boutiques coûtent un peu chaque mois.',
      'Si le site t\'a aidé à choper un coffret ou un display, un petit coup de pouce de {1} ou {2}, c\'est déjà génial. Merci, et bonnes ouvertures de boosters ! ✨',
    ],
    fine: 'Paiement unique, pas d\'abonnement. Paiement sécurisé par Whop (carte, Apple Pay, Google Pay).', back: 'Retour au stock en direct',
  },
  de: {
    title: 'Card Restock Tracker unterstützen', h1: 'Hilf mit, Card Restock Tracker kostenlos zu halten ♥',
    p: [
      'Hey Trainer! Ich bin selbst Pokémon-TCG-Fan und hatte genug davon, dass Top-Trainer-Boxen und Displays bei Scalpern landen. Deshalb habe ich diese Seite gebaut: Sie prüft rund um die Uhr unabhängige Kartenläden (ausverkaufte Produkte stündlich), damit du versiegelte Ware zum Ladenpreis findest.',
      'Sie ist im Moment kostenlos und werbefrei, und so soll es bleiben. Server und Shop-Abfragen kosten aber jeden Monat ein bisschen.',
      'Wenn dir die Seite geholfen hat, eine Box zu ergattern, ist ein kleiner Beitrag von {1} oder {2} schon großartig. Danke und viel Glück beim Öffnen! ✨',
    ],
    fine: 'Einmalige Zahlung, kein Abo. Sichere Zahlung über Whop (Karte, Apple Pay, Google Pay).', back: 'Zurück zum Live-Bestand',
  },
  nl: {
    title: 'Steun Card Restock Tracker', h1: 'Help Card Restock Tracker gratis te houden ♥',
    p: [
      'Hé trainer! Ik ben zelf fan van de Pokémon TCG en was het zat dat Elite Trainer Boxes en displays bij scalpers belandden. Daarom heb ik deze site gemaakt: hij controleert dag en nacht onafhankelijke kaartwinkels (uitverkochte producten elk uur), zodat jij verzegelde producten voor de winkelprijs vindt.',
      'Hij is voorlopig gratis en zonder advertenties, en dat wil ik graag zo houden. Servers en winkelcontroles kosten wel elke maand een beetje.',
      'Heeft de site je geholpen een box te scoren? Een kleine bijdrage van {1} of {2} is al geweldig. Bedankt en veel plezier met openen! ✨',
    ],
    fine: 'Eenmalige betaling, geen abonnement. Veilig betalen via Whop (kaart, Apple Pay, Google Pay).', back: 'Terug naar de live voorraad',
  },
  it: {
    title: 'Sostieni Card Restock Tracker', h1: 'Aiutaci a mantenere Card Restock Tracker gratuito ♥',
    p: [
      'Ciao allenatore! Sono un fan del GCC Pokémon e non ne potevo più di vedere ETB e box finire in mano ai bagarini. Così ho creato questo sito: controlla giorno e notte i negozi indipendenti (i prodotti esauriti ogni ora) per farti trovare i prodotti sigillati a prezzo di negozio.',
      'Per ora è gratis e senza pubblicità, e vorrei che restasse così. Server e controlli dei negozi però costano un po\' ogni mese.',
      'Se il sito ti ha aiutato a prendere un box, un piccolo contributo di {1} o {2} è già fantastico. Grazie e buone aperture! ✨',
    ],
    fine: 'Pagamento unico, nessun abbonamento. Pagamento sicuro con Whop (carta, Apple Pay, Google Pay).', back: 'Torna alla disponibilità live',
  },
  es: {
    title: 'Apoya Card Restock Tracker', h1: 'Ayúdanos a mantener Card Restock Tracker gratis ♥',
    p: [
      '¡Hola, entrenador! Soy fan del JCC Pokémon y estaba harto de ver cómo las cajas de Entrenador Élite y las cajas de sobres acababan en manos de revendedores. Por eso creé esta web: revisa día y noche las tiendas independientes (los productos agotados cada hora) para que encuentres producto sellado a precio de tienda.',
      'Por ahora es gratis y sin anuncios, y quiero que siga así. Pero los servidores y las revisiones de tiendas cuestan un poco cada mes.',
      'Si la web te ayudó a conseguir una caja, una pequeña ayuda de {1} o {2} ya es genial. ¡Gracias y buenas aperturas! ✨',
    ],
    fine: 'Pago único, sin suscripción. Pago seguro con Whop (tarjeta, Apple Pay, Google Pay).', back: 'Volver al stock en directo',
  },
};

export async function supportPage(env, cc) {
  const T = t(cc);
  const C = COPY[T.cc.lang] ?? COPY.en;
  const cur = EURO.has(cc) ? 'eur' : 'usd';
  const fmt = (n) => new Intl.NumberFormat(T.cc.locale, { style: 'currency', currency: cur.toUpperCase(), maximumFractionDigits: 0 }).format(n);
  const para = (s) => e(s).replace('{1}', `<strong>${fmt(1)}</strong>`).replace('{2}', `<strong>${fmt(2)}</strong>`);
  const btns = [1, 2, 5].map((n, i) => `<a class="btn${i === 1 ? '' : ' ghost'}" href="https://whop.com/checkout/${TIP_PLANS[cur][n]}" rel="noopener" data-ev="tip" data-amount="${n}" data-cur="${cur}">${e(fmt(n))}</a>`).join(' ');
  const body = `<div class="prose support">
  <h1>${e(C.h1)}</h1>
  ${C.p.map((x) => `<p>${para(x)}</p>`).join('\n  ')}
  <p class="tips">${btns}</p>
  <p class="fine">${e(C.fine)}</p>
  <p><a href="${cc === 'us' ? '/' : `/${cc}`}">← ${e(C.back)}</a></p>
</div>`;
  return page(env, T, { title: `${C.title} | ${env.BRAND_NAME}`, description: C.h1, path: cc === 'us' ? '/support' : `/${cc}/support`, body, noindex: true });
}
