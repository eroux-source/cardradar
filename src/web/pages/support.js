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

const UI = {
 "en": {
  "pick": "Pick an amount",
  "other": "Other amount",
  "give": "Give",
  "ph": "Amount",
  "err": "The payment page could not open. Please pick 1, 2 or 5, or try again.",
  "min": "Enter an amount between {min} and {max}.",
  "thanks": "Thank you so much! ♥ Your support keeps the site free for every collector.",
  "why": [
   "Free alerts for everyone",
   "No ads, ever",
   "Shops checked around the clock"
  ],
  "wait": "Opening…"
 },
 "fr": {
  "pick": "Choisis un montant",
  "other": "Autre montant",
  "give": "Donner",
  "ph": "Montant",
  "err": "La page de paiement n'a pas pu s'ouvrir. Choisis 1, 2 ou 5, ou réessaie.",
  "min": "Indique un montant entre {min} et {max}.",
  "thanks": "Merci beaucoup ! ♥ Ton soutien garde le site gratuit pour tous les collectionneurs.",
  "why": [
   "Alertes gratuites pour tous",
   "Zéro pub",
   "Boutiques vérifiées jour et nuit"
  ],
  "wait": "Ouverture…"
 },
 "de": {
  "pick": "Wähle einen Betrag",
  "other": "Anderer Betrag",
  "give": "Spenden",
  "ph": "Betrag",
  "err": "Die Zahlungsseite konnte nicht geöffnet werden. Wähle 1, 2 oder 5 oder versuche es erneut.",
  "min": "Gib einen Betrag zwischen {min} und {max} ein.",
  "thanks": "Vielen Dank! ♥ Deine Unterstützung hält die Seite für alle Sammler kostenlos.",
  "why": [
   "Kostenlose Alerts für alle",
   "Keine Werbung",
   "Shops rund um die Uhr geprüft"
  ],
  "wait": "Wird geöffnet…"
 },
 "nl": {
  "pick": "Kies een bedrag",
  "other": "Ander bedrag",
  "give": "Doneren",
  "ph": "Bedrag",
  "err": "De betaalpagina kon niet openen. Kies 1, 2 of 5, of probeer het opnieuw.",
  "min": "Vul een bedrag in tussen {min} en {max}.",
  "thanks": "Heel erg bedankt! ♥ Jouw steun houdt de site gratis voor alle verzamelaars.",
  "why": [
   "Gratis alerts voor iedereen",
   "Geen advertenties",
   "Winkels dag en nacht gecontroleerd"
  ],
  "wait": "Openen…"
 },
 "it": {
  "pick": "Scegli un importo",
  "other": "Altro importo",
  "give": "Dona",
  "ph": "Importo",
  "err": "Non è stato possibile aprire la pagina di pagamento. Scegli 1, 2 o 5, oppure riprova.",
  "min": "Inserisci un importo tra {min} e {max}.",
  "thanks": "Grazie mille! ♥ Il tuo sostegno mantiene il sito gratuito per tutti i collezionisti.",
  "why": [
   "Avvisi gratuiti per tutti",
   "Zero pubblicità",
   "Negozi controllati giorno e notte"
  ],
  "wait": "Apertura…"
 },
 "es": {
  "pick": "Elige un importe",
  "other": "Otro importe",
  "give": "Donar",
  "ph": "Importe",
  "err": "No se pudo abrir la página de pago. Elige 1, 2 o 5, o inténtalo de nuevo.",
  "min": "Indica un importe entre {min} y {max}.",
  "thanks": "¡Muchas gracias! ♥ Tu apoyo mantiene la web gratis para todos los coleccionistas.",
  "why": [
   "Alertas gratis para todos",
   "Sin anuncios",
   "Tiendas revisadas día y noche"
  ],
  "wait": "Abriendo…"
 }
};

// Free amount ("Other"): limits in the page currency
const MIN = 1; const MAX = 200;

export async function supportPage(env, cc, url) {
  const T = t(cc);
  const C = COPY[T.cc.lang] ?? COPY.en;
  const cur = EURO.has(cc) ? 'eur' : 'usd';
  const fmt = (n) => new Intl.NumberFormat(T.cc.locale, { style: 'currency', currency: cur.toUpperCase(), maximumFractionDigits: 0 }).format(n);
  const para = (s) => e(s).replace('{1}', `<strong>${fmt(1)}</strong>`).replace('{2}', `<strong>${fmt(2)}</strong>`);
  const U = UI[T.cc.lang] ?? UI.en;
  const thanks = url?.searchParams?.get('thanks') === '1';
  // "Other amount" needs a Whop API key with the checkout_configuration:create permission
  const otherOn = env.TIP_OTHER === '1';
  const cards = [1, 2, 5].map((n) => `<a class="tip-amt${n === 2 ? ' pick' : ''}" href="https://whop.com/checkout/${TIP_PLANS[cur][n]}" rel="noopener" data-ev="tip" data-amount="${n}" data-cur="${cur}">${e(fmt(n))}</a>`).join('');
  const sym = new Intl.NumberFormat(T.cc.locale, { style: 'currency', currency: cur.toUpperCase() }).formatToParts(1).find((x) => x.type === 'currency')?.value ?? '';
  const minMsg = U.min.replace('{min}', fmt(MIN)).replace('{max}', fmt(MAX));
  const body = `<div class="support">
  ${thanks ? `<p class="tip-thanks" role="status">${e(U.thanks)}</p>` : ''}
  <div class="tip-hero"><span class="tip-heart" aria-hidden="true">♥</span><h1>${e(C.h1)}</h1></div>
  <ul class="tip-why">${U.why.map((w) => `<li>${e(w)}</li>`).join('')}</ul>
  <div class="prose">${C.p.map((x) => `<p>${para(x)}</p>`).join('\n  ')}</div>
  <section class="tip-box" aria-label="${e(U.pick)}">
    <h2>${e(U.pick)}</h2>
    <div class="tip-amts${otherOn ? '' : ' three'}">${cards}${otherOn ? `<button type="button" class="tip-amt other" data-ev="tip_other_open" aria-expanded="false" aria-controls="tip-other">${e(U.other)}</button>` : ''}</div>
    <form id="tip-other" class="tip-other" hidden data-cur="${cur}" data-err="${e(U.err)}" data-min="${e(minMsg)}" data-wait="${e(U.wait)}">
      <label class="tip-input"><span>${e(sym)}</span><input name="amount" type="number" inputmode="decimal" min="${MIN}" max="${MAX}" step="0.5" placeholder="${e(U.ph)}" aria-label="${e(U.ph)}" required></label>
      <button class="btn tip-btn" type="submit" data-ev="tip" data-amount="other" data-cur="${cur}">${e(U.give)} ♥</button>
      <p class="tip-msg" role="alert" hidden></p>
    </form>
    <p class="fine">${e(C.fine)}</p>
  </section>
  <p><a href="${cc === 'us' ? '/' : `/${cc}`}">← ${e(C.back)}</a></p>
</div>
<script>(function(){var b=document.querySelector('.tip-amt.other'),f=document.getElementById('tip-other');if(!b||!f)return;var i=f.querySelector('input'),m=f.querySelector('.tip-msg'),s=f.querySelector('button');
b.addEventListener('click',function(){f.hidden=!f.hidden;b.setAttribute('aria-expanded',String(!f.hidden));b.classList.toggle('pick',!f.hidden);var two=document.querySelector('.tip-amt[data-amount="2"]');if(two)two.classList.toggle('pick',f.hidden);if(!f.hidden)i.focus();});
function say(t){m.textContent=t;m.hidden=!t;}
f.addEventListener('submit',function(ev){ev.preventDefault();var a=Math.round(parseFloat(String(i.value).replace(',','.'))*100)/100;
if(!(a>=${MIN}&&a<=${MAX})){say(f.dataset.min);return;}say('');var old=s.textContent;s.disabled=true;s.textContent=f.dataset.wait;
fetch('/api/tip',{method:'POST',headers:{'content-type':'application/json'},body:JSON.stringify({amount:a,cur:f.dataset.cur,cc:document.body.dataset.cc||'us'})}).then(function(r){return r.json()}).then(function(j){if(j&&j.url){location.href=j.url;}else{throw 0;}}).catch(function(){say(f.dataset.err);s.disabled=false;s.textContent=old;});});})();</script>`;
  return page(env, T, { title: `${C.title} | ${env.BRAND_NAME}`, description: C.h1, path: cc === 'us' ? '/support' : `/${cc}/support`, body, noindex: true });
}

// "Other amount": a Whop checkout created on the fly (API v1 checkout_configurations with an inline
// one-time variant in the tip product). metadata.kind = 'tip' lets the webhook record it as a tip.
let tipProduct = null;
async function whop(env, path, init = {}) {
  const r = await fetch(`https://api.whop.com/api/v1${path}`, { ...init, headers: { authorization: `Bearer ${env.WHOP_API_KEY}`, 'content-type': 'application/json', ...(init.headers ?? {}) } });
  const j = await r.json().catch(() => null);
  if (!r.ok) throw new Error(`whop ${path} ${r.status}: ${JSON.stringify(j).slice(0, 200)}`);
  return j;
}
export async function tipCheckout(env, req) {
  const json = (o, status = 200) => new Response(JSON.stringify(o), { status, headers: { 'content-type': 'application/json', 'cache-control': 'no-store' } });
  const b = await req.json().catch(() => ({}));
  const cur = b.cur === 'eur' ? 'eur' : 'usd';
  const amount = Math.round(Number(b.amount) * 100) / 100;
  if (!(amount >= MIN && amount <= MAX)) return json({ error: 'amount' }, 400);
  if (!env.WHOP_API_KEY || env.TIP_OTHER !== '1') return json({ error: 'unavailable' }, 503);
  try {
    tipProduct ??= (await whop(env, `/plans/${TIP_PLANS[cur][1]}`))?.product?.id ?? null;
    if (!tipProduct) throw new Error('tip product not found');
    const cc = /^[a-z]{2}$/.test(String(b.cc ?? '')) ? b.cc : 'us';
    const back = `${env.BASE_URL}${supportHref(cc)}?thanks=1`;
    const ch = await whop(env, '/checkout_configurations', { method: 'POST', body: JSON.stringify({
      variant: { product_id: tipProduct, initial_price: amount, currency: cur, billing_type: 'one_time', visibility: 'hidden', title: 'Tip' },
      metadata: { kind: 'tip', amount: String(amount), currency: cur },
      redirect_url: back,
    }) });
    if (!ch?.purchase_url) throw new Error('no purchase_url');
    return json({ url: ch.purchase_url });
  } catch (err) {
    const msg = String(err?.message ?? err);
    console.log('tip checkout failed', msg);
    // which step failed and Whop's own error text (no key, no buyer data), shown in /api/health → tip_last_error
    await env.DB.prepare("INSERT INTO settings (key, value, updated_at) VALUES ('tip.last_error', ?, ?) ON CONFLICT(key) DO UPDATE SET value = excluded.value, updated_at = excluded.updated_at").bind(msg.slice(0, 300), Date.now()).run().catch(() => {});
    return json({ error: 'checkout' }, 502);
  }
}
