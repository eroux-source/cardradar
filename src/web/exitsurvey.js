// Exit survey on the plan step (2026-11-18): when someone leaves without paying (desktop exit intent,
// back from the Whop checkout, or the "not convinced?" link), ask why and, if it is the price, how much.
import { escapeHtml as e } from '../lib/util.js';

export const REASONS = ['price', 'card', 'free_enough', 'looking', 'later', 'trust', 'missing', 'payment_failed', 'other'];
export const PAYS = ['paypal', 'apple_pay', 'google_pay', 'bank', 'none'];

const W = {
  en: { link: 'Not convinced? Tell us why (20 seconds)', h: 'Before you go: what held you back?', sub: 'One honest answer helps us fix it. Nothing is charged here.',
    r: { price: 'Too expensive', card: 'I didn\'t want to enter my card', free_enough: 'The free daily email is enough for me', looking: 'I was just looking', later: 'I\'ll come back later', trust: 'I don\'t know the site well enough yet', missing: 'My product or shop is missing', payment_failed: 'The payment didn\'t work', other: 'Something else' },
    qPrice: 'How much would you pay for 30 days of instant alerts?', other: 'Other amount', qPay: 'How would you rather pay?', pay: { paypal: 'PayPal', apple_pay: 'Apple Pay', google_pay: 'Google Pay', bank: 'Bank transfer', none: 'I wouldn\'t pay online' },
    comment: 'Anything to add? (optional)', mail: 'Your email (optional, if you want an answer)', send: 'Send', skip: 'No thanks', thanks: 'Thank you, that really helps! 🙏', pick: 'Pick an answer first.' },
  fr: { link: 'Pas convaincu ? Dis-nous pourquoi (20 secondes)', h: 'Avant de partir : qu\'est-ce qui t\'a retenu ?', sub: 'Une réponse honnête nous aide à corriger. Rien n\'est débité ici.',
    r: { price: 'Trop cher', card: 'Je ne voulais pas donner ma carte', free_enough: 'L\'e-mail gratuit du jour me suffit', looking: 'Je regardais juste', later: 'Je reviendrai plus tard', trust: 'Je ne connais pas encore assez le site', missing: 'Mon produit ou ma boutique manque', payment_failed: 'Le paiement n\'a pas marché', other: 'Autre chose' },
    qPrice: 'Combien paierais-tu pour 30 jours d\'alertes instantanées ?', other: 'Autre montant', qPay: 'Comment préférerais-tu payer ?', pay: { paypal: 'PayPal', apple_pay: 'Apple Pay', google_pay: 'Google Pay', bank: 'Virement', none: 'Je ne paierais pas en ligne' },
    comment: 'Un mot à ajouter ? (facultatif)', mail: 'Ton e-mail (facultatif, si tu veux une réponse)', send: 'Envoyer', skip: 'Non merci', thanks: 'Merci, ça nous aide vraiment ! 🙏', pick: 'Choisis d\'abord une réponse.' },
  de: { link: 'Nicht überzeugt? Sag uns warum (20 Sekunden)', h: 'Bevor du gehst: Was hat dich abgehalten?', sub: 'Eine ehrliche Antwort hilft uns. Hier wird nichts abgebucht.',
    r: { price: 'Zu teuer', card: 'Ich wollte meine Karte nicht angeben', free_enough: 'Die kostenlose Tages-E-Mail reicht mir', looking: 'Ich habe nur geschaut', later: 'Ich komme später wieder', trust: 'Ich kenne die Seite noch nicht gut genug', missing: 'Mein Produkt oder Shop fehlt', payment_failed: 'Die Zahlung hat nicht geklappt', other: 'Etwas anderes' },
    qPrice: 'Wie viel würdest du für 30 Tage Sofort-Alarme zahlen?', other: 'Anderer Betrag', qPay: 'Wie würdest du lieber zahlen?', pay: { paypal: 'PayPal', apple_pay: 'Apple Pay', google_pay: 'Google Pay', bank: 'Überweisung', none: 'Ich würde nicht online zahlen' },
    comment: 'Noch etwas? (optional)', mail: 'Deine E-Mail (optional, falls du eine Antwort willst)', send: 'Senden', skip: 'Nein danke', thanks: 'Danke, das hilft uns sehr! 🙏', pick: 'Wähle zuerst eine Antwort.' },
  nl: { link: 'Niet overtuigd? Vertel ons waarom (20 seconden)', h: 'Voor je gaat: wat hield je tegen?', sub: 'Eén eerlijk antwoord helpt ons. Hier wordt niets afgeschreven.',
    r: { price: 'Te duur', card: 'Ik wilde mijn kaart niet invullen', free_enough: 'De gratis dagelijkse e-mail is genoeg', looking: 'Ik keek alleen even', later: 'Ik kom later terug', trust: 'Ik ken de site nog niet goed genoeg', missing: 'Mijn product of winkel ontbreekt', payment_failed: 'De betaling werkte niet', other: 'Iets anders' },
    qPrice: 'Hoeveel zou je betalen voor 30 dagen directe meldingen?', other: 'Ander bedrag', qPay: 'Hoe zou je liever betalen?', pay: { paypal: 'PayPal', apple_pay: 'Apple Pay', google_pay: 'Google Pay', bank: 'Overschrijving / iDEAL', none: 'Ik zou niet online betalen' },
    comment: 'Nog iets? (optioneel)', mail: 'Je e-mail (optioneel, als je antwoord wilt)', send: 'Versturen', skip: 'Nee bedankt', thanks: 'Bedankt, dit helpt echt! 🙏', pick: 'Kies eerst een antwoord.' },
  it: { link: 'Non convinto? Dicci perché (20 secondi)', h: 'Prima di andare: cosa ti ha frenato?', sub: 'Una risposta sincera ci aiuta a migliorare. Qui non viene addebitato nulla.',
    r: { price: 'Troppo caro', card: 'Non volevo inserire la carta', free_enough: 'L\'e-mail gratuita giornaliera mi basta', looking: 'Stavo solo guardando', later: 'Tornerò più tardi', trust: 'Non conosco ancora abbastanza il sito', missing: 'Manca il mio prodotto o negozio', payment_failed: 'Il pagamento non ha funzionato', other: 'Altro' },
    qPrice: 'Quanto pagheresti per 30 giorni di avvisi istantanei?', other: 'Altro importo', qPay: 'Come preferiresti pagare?', pay: { paypal: 'PayPal', apple_pay: 'Apple Pay', google_pay: 'Google Pay', bank: 'Bonifico', none: 'Non pagherei online' },
    comment: 'Vuoi aggiungere qualcosa? (facoltativo)', mail: 'La tua e-mail (facoltativa, se vuoi una risposta)', send: 'Invia', skip: 'No grazie', thanks: 'Grazie, ci aiuta davvero! 🙏', pick: 'Scegli prima una risposta.' },
  es: { link: '¿No te convence? Dinos por qué (20 segundos)', h: 'Antes de irte: ¿qué te frenó?', sub: 'Una respuesta sincera nos ayuda a mejorar. Aquí no se cobra nada.',
    r: { price: 'Demasiado caro', card: 'No quería poner mi tarjeta', free_enough: 'El e-mail diario gratis me basta', looking: 'Solo estaba mirando', later: 'Volveré más tarde', trust: 'Aún no conozco bien la web', missing: 'Falta mi producto o tienda', payment_failed: 'El pago no funcionó', other: 'Otra cosa' },
    qPrice: '¿Cuánto pagarías por 30 días de alertas al instante?', other: 'Otro importe', qPay: '¿Cómo preferirías pagar?', pay: { paypal: 'PayPal', apple_pay: 'Apple Pay', google_pay: 'Google Pay', bank: 'Transferencia', none: 'No pagaría online' },
    comment: '¿Algo más? (opcional)', mail: 'Tu e-mail (opcional, si quieres respuesta)', send: 'Enviar', skip: 'No, gracias', thanks: '¡Gracias, nos ayuda mucho! 🙏', pick: 'Elige primero una respuesta.' },
};

/** Link + dialog for the plan step. `money(n)` formats in the plan currency, `cur` is its code. */
export function exitSurvey(T, money, cur, soloPrice) {
  const S = W[T.cc.lang] ?? W.en;
  const p = Number(soloPrice) || 5.99;
  const big = p >= 50; // JPY-like or CLP-like amounts: round steps
  const steps = [0.2, 0.4, 0.6, 0.8].map((f) => (big ? Math.round((p * f) / 10) * 10 : Math.max(1, Math.round(p * f))));
  const chip = (name, v, label) => `<label class="xs-chip"><input type="radio" name="${name}" value="${e(v)}"><span>${e(label)}</span></label>`;
  return `<dialog class="exit-survey" id="exit-survey" data-thanks="${e(S.thanks)}" data-pick="${e(S.pick)}" data-cur="${e(cur)}">
  <form data-form="exit" method="dialog">
    <h2>${e(S.h)}</h2><p class="sub">${e(S.sub)}</p>
    <div class="xs-reasons">${REASONS.map((r) => chip('reason', r, S.r[r])).join('')}</div>
    <fieldset class="xs-more" data-for="price" hidden><legend>${e(S.qPrice)}</legend>
      <div class="xs-row">${[...new Set(steps)].map((v) => chip('price', v, money(v))).join('')}<label class="xs-other"><input type="number" name="price_other" min="0" step="any" inputmode="decimal" placeholder="${e(S.other)}"></label></div></fieldset>
    <fieldset class="xs-more" data-for="card" hidden><legend>${e(S.qPay)}</legend>
      <div class="xs-row">${PAYS.map((v) => chip('pay', v, S.pay[v])).join('')}</div></fieldset>
    <label class="xs-label" for="xs-text">${e(S.comment)}</label><textarea id="xs-text" name="text" rows="2" maxlength="1000"></textarea>
    <input name="email" type="email" autocomplete="email" maxlength="190" placeholder="${e(S.mail)}" aria-label="${e(S.mail)}">
    <p class="err" role="alert"></p>
    <div class="xs-actions"><button class="btn" type="submit" value="send">${e(S.send)}</button><button class="link" type="button" data-xs-close>${e(S.skip)}</button></div>
  </form>
</dialog>`;
}
