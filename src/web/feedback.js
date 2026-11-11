// Feedback block (2026-11-11): "is your country missing?", "which card game should we track next?",
// a free comment and an optional email. Shown on every public page, opened from a floating button.
import { escapeHtml as e } from '../lib/util.js';
import { COUNTRIES } from '../data/countries.js';
import { one, all, run, now } from '../lib/db.js';

export const GAMES = ['one-piece', 'lorcana', 'magic', 'yugioh', 'dragon-ball', 'riftbound', 'star-wars', 'digimon'];
const GAME_NAMES = { 'one-piece': 'One Piece', lorcana: 'Disney Lorcana', magic: 'Magic: The Gathering', yugioh: 'Yu-Gi-Oh!', 'dragon-ball': 'Dragon Ball Super', riftbound: 'Riftbound (League of Legends)', 'star-wars': 'Star Wars Unlimited', digimon: 'Digimon' };
// countries people may ask for (ours are left out automatically)
const ASK = ['be', 'ch', 'at', 'ie', 'pt', 'pl', 'se', 'dk', 'no', 'fi', 'cz', 'gr', 'nz', 'sg', 'my', 'ph', 'in', 'br', 'ar', 'co', 'pe', 'za', 'ae', 'kr', 'tw', 'hk'];

const W = {
  en: { h: 'Help us choose what comes next 💬', q1: 'Is your country missing?', pick: 'Pick your country', q2: 'Which card game should we track next?', other: 'Other…', q3: 'Anything else? An idea, a bug, a shop we\'re missing…', mail: 'Your email (optional, to hear when it\'s live)', send: 'Send', thanks: 'Thank you! We read every answer. 🙏', empty: 'Pick an answer or write a few words first.', fab: '💬 Your say' },
  fr: { h: 'Aide-nous à choisir la suite 💬', q1: 'Ton pays n\'est pas là ?', pick: 'Choisis ton pays', q2: 'Quel jeu de cartes suivre ensuite ?', other: 'Autre…', q3: 'Autre chose ? Une idée, un bug, une boutique qui manque…', mail: 'Ton e-mail (facultatif, pour être prévenu)', send: 'Envoyer', thanks: 'Merci ! On lit toutes les réponses. 🙏', empty: 'Choisis une réponse ou écris quelques mots.', fab: '💬 Ton avis' },
  de: { h: 'Hilf uns, das Nächste auszuwählen 💬', q1: 'Fehlt dein Land?', pick: 'Land auswählen', q2: 'Welches Kartenspiel sollen wir als Nächstes verfolgen?', other: 'Anderes…', q3: 'Sonst noch etwas? Eine Idee, ein Fehler, ein fehlender Shop…', mail: 'Deine E-Mail (optional, damit wir dir Bescheid geben)', send: 'Senden', thanks: 'Danke! Wir lesen jede Antwort. 🙏', empty: 'Wähle eine Antwort oder schreib ein paar Worte.', fab: '💬 Deine Meinung' },
  nl: { h: 'Help ons kiezen wat er komt 💬', q1: 'Staat je land er niet bij?', pick: 'Kies je land', q2: 'Welk kaartspel moeten we hierna volgen?', other: 'Anders…', q3: 'Nog iets? Een idee, een bug, een winkel die ontbreekt…', mail: 'Je e-mail (optioneel, om op de hoogte te blijven)', send: 'Versturen', thanks: 'Bedankt! We lezen elk antwoord. 🙏', empty: 'Kies een antwoord of schrijf een paar woorden.', fab: '💬 Jouw mening' },
  it: { h: 'Aiutaci a scegliere cosa arriva dopo 💬', q1: 'Il tuo paese non c\'è?', pick: 'Scegli il tuo paese', q2: 'Quale gioco di carte seguire dopo?', other: 'Altro…', q3: 'Altro da dirci? Un\'idea, un bug, un negozio che manca…', mail: 'La tua e-mail (facoltativa, per avvisarti)', send: 'Invia', thanks: 'Grazie! Leggiamo ogni risposta. 🙏', empty: 'Scegli una risposta o scrivi qualche parola.', fab: '💬 Il tuo parere' },
  es: { h: 'Ayúdanos a elegir lo próximo 💬', q1: '¿Tu país no está?', pick: 'Elige tu país', q2: '¿Qué juego de cartas seguimos después?', other: 'Otro…', q3: '¿Algo más? Una idea, un fallo, una tienda que falta…', mail: 'Tu e-mail (opcional, para avisarte)', send: 'Enviar', thanks: '¡Gracias! Leemos todas las respuestas. 🙏', empty: 'Elige una respuesta o escribe unas palabras.', fab: '💬 Tu opinión' },
};
export const feedbackWords = (lang) => W[lang] ?? W.en;

export function feedbackBlock(T) {
  const F = feedbackWords(T.cc.lang);
  let names; try { names = new Intl.DisplayNames([T.cc.locale, 'en'], { type: 'region' }); } catch { names = null; }
  const ours = new Set(Object.keys(COUNTRIES).map((c) => (c === 'uk' ? 'gb' : c)));
  const opts = ASK.filter((c) => !ours.has(c)).map((c) => [c, names?.of(c.toUpperCase()) ?? c.toUpperCase()]).sort((a, b) => a[1].localeCompare(b[1], T.cc.locale));
  return `<section class="feedback" id="feedback" aria-labelledby="fb-h" data-thanks="${e(F.thanks)}" data-empty="${e(F.empty)}">
  <h2 id="fb-h">${e(F.h)}</h2>
  <form data-form="feedback">
    <div class="fb-q"><label for="fb-country">${e(F.q1)}</label>
      <select id="fb-country" name="country"><option value="">${e(F.pick)}</option>${opts.map(([c, n]) => `<option value="${c}">${e(n)}</option>`).join('')}<option value="other">${e(F.other)}</option></select></div>
    <fieldset class="fb-q"><legend>${e(F.q2)}</legend><div class="fb-games">${GAMES.map((g) => `<label class="fb-game"><input type="radio" name="game" value="${g}"><span>${e(GAME_NAMES[g])}</span></label>`).join('')}<label class="fb-game"><input type="radio" name="game" value="other"><span>${e(F.other)}</span></label></div></fieldset>
    <div class="fb-q"><label for="fb-text">${e(F.q3)}</label><textarea id="fb-text" name="text" rows="3" maxlength="1000"></textarea></div>
    <div class="fb-q fb-row"><input name="email" type="email" autocomplete="email" maxlength="190" placeholder="${e(F.mail)}" aria-label="${e(F.mail)}"><button class="btn" type="submit">${e(F.send)}</button></div>
    <p class="err" role="alert"></p>
  </form>
</section>`;
}

export const feedbackFab = (T) => `<a class="fb-fab" href="#feedback" data-ev="feedback_open">${e(feedbackWords(T.cc.lang).fab)}</a>`;

const sha = async (s) => [...new Uint8Array(await crypto.subtle.digest('SHA-256', new TextEncoder().encode(s)))].map((b) => b.toString(16).padStart(2, '0')).join('').slice(0, 24);

/** POST /api/feedback */
export async function saveFeedback(env, b, ip) {
  const country = /^[a-z]{2}$|^other$/.test(String(b.country ?? '')) ? b.country : null;
  const game = GAMES.includes(b.game) || b.game === 'other' ? b.game : null;
  const text = String(b.text ?? '').trim().slice(0, 1000) || null;
  const email = /^[^\s@]{1,64}@[^\s@]{1,190}\.[^\s@]{2,24}$/.test(String(b.email ?? '').trim()) ? String(b.email).trim().toLowerCase() : null;
  if (!country && !game && !text) return { ok: false, error: 'empty' };
  const ipHash = await sha(`${ip}:${env.SESSION_SECRET ?? 'fb'}`);
  const recent = await one(env, 'SELECT COUNT(*) n FROM feedback WHERE ip_hash = ? AND at > ?', ipHash, now() - 3600e3);
  if (recent?.n >= 5) return { ok: false, error: 'Too many answers from this network, try again later.' };
  await run(env, 'INSERT INTO feedback (at, cc, page, visit, ip_hash, country, game, text, email) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)',
    now(), COUNTRIES[b.cc] ? b.cc : null, String(b.page ?? '').slice(0, 200), String(b.visit ?? '').slice(0, 40) || null, ipHash, country, game, text, email);
  return { ok: true };
}

/** Counts only (public health): never texts or emails. */
export async function feedbackCounts(env, days = 30) {
  const since = now() - days * 864e5;
  const [c, g, n] = await Promise.all([
    all(env, 'SELECT country k, COUNT(*) n FROM feedback WHERE at > ? AND country IS NOT NULL GROUP BY 1 ORDER BY 2 DESC LIMIT 20', since),
    all(env, 'SELECT game k, COUNT(*) n FROM feedback WHERE at > ? AND game IS NOT NULL GROUP BY 1 ORDER BY 2 DESC', since),
    one(env, 'SELECT COUNT(*) total, COUNT(text) texts, COUNT(email) emails FROM feedback WHERE at > ?', since),
  ]);
  return { countries: c.map((r) => `${r.k} ${r.n}`), games: g.map((r) => `${r.k} ${r.n}`), ...n };
}

/** Owner page: every answer, newest first. */
export async function ownerFeedback(env) {
  const rows = await all(env, 'SELECT at, cc, page, country, game, text, email FROM feedback ORDER BY at DESC LIMIT 500');
  const c = await feedbackCounts(env, 90);
  const body = `<!doctype html><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>Retours visiteurs</title>
<style>body{font:15px system-ui;margin:24px;max-width:1100px}table{border-collapse:collapse;width:100%}td,th{border-bottom:1px solid #ddd;padding:6px;text-align:left;vertical-align:top}small{color:#666}</style>
<h1>Retours visiteurs</h1><p><b>${c.total ?? 0}</b> réponses sur 90 jours · ${c.texts ?? 0} commentaires · ${c.emails ?? 0} e-mails</p>
<p><b>Pays demandés :</b> ${e(c.countries.join(' · ') || '—')}<br><b>Jeux demandés :</b> ${e(c.games.join(' · ') || '—')}</p>
<table><tr><th>Quand (UTC)</th><th>Site</th><th>Pays</th><th>Jeu</th><th>Commentaire</th><th>E-mail</th></tr>
${rows.map((r) => `<tr><td>${new Date(r.at).toISOString().slice(0, 16).replace('T', ' ')}<br><small>${e(r.page ?? '')}</small></td><td>${e(r.cc ?? '')}</td><td>${e(r.country ?? '')}</td><td>${e(r.game ?? '')}</td><td>${e(r.text ?? '')}</td><td>${e(r.email ?? '')}</td></tr>`).join('')}</table>`;
  return new Response(body, { headers: { 'content-type': 'text/html; charset=utf-8', 'cache-control': 'private, no-store' } });
}
