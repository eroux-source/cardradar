// The stepped alert funnel (paid alerts only since 2026-11-18; older free alerts keep the daily email) and the account page.
// /alerts : 1 email → 2 product (skipped when the product page already chose it) → 3 plan + optional channels → checkout.
// The email is captured at step 1 (lead), so a visitor who stops still gets one
// follow-up. Steps run client-side (public/app.js) against /api/funnel/*.
import { freeMode, freeWords } from '../free.js';
import { pushVisible, pushOption, pushAccountBlock } from '../pwa.js';
import { escapeHtml as e, timeAgo, formatUtc } from '../../lib/util.js';
import { COUNTRIES, metroById } from '../../data/countries.js';
import { JP_SETS } from '../../data/sets_jp.js';
import { all } from '../../lib/db.js';
import { activePass, PLANS } from '../../billing/pass.js';
import { page } from '../html.js';
import { accountWords } from '../account_words.js';

// Email only for now: restocks at independent shops usually last hours, so an email is fast enough.
// The checkbox counts who would like phone notifications (event "wants_phone"), to decide whether to build them.
// Shop picker on the plan step (one product, online): {n} = number of shops
const SHOPS_UI = {
  en: { h: 'Shops to watch', all: 'All {n} shops that sell it', pick: 'Choose', none: 'Pick at least one shop.', in: 'in stock' },
  fr: { h: 'Boutiques surveillées', all: 'Les {n} boutiques qui le vendent', pick: 'Choisir', none: 'Choisissez au moins une boutique.', in: 'en stock' },
  de: { h: 'Beobachtete Shops', all: 'Alle {n} Shops, die es führen', pick: 'Auswählen', none: 'Wähle mindestens einen Shop.', in: 'auf Lager' },
  nl: { h: 'Gevolgde winkels', all: 'Alle {n} winkels die het verkopen', pick: 'Kiezen', none: 'Kies minstens één winkel.', in: 'op voorraad' },
  it: { h: 'Negozi seguiti', all: 'Tutti i {n} negozi che lo vendono', pick: 'Scegli', none: 'Scegli almeno un negozio.', in: 'disponibile' },
  es: { h: 'Tiendas vigiladas', all: 'Las {n} tiendas que lo venden', pick: 'Elegir', none: 'Elige al menos una tienda.', in: 'en stock' },
};

// Shown on the plan step when an alert is refused without a plan
const PLAN_NEEDED = {
  en: 'Alerts need a plan: pick Solo or Multi.', fr: 'Les alertes demandent une formule : choisissez Solo ou Multi.',
  de: 'Alarme brauchen einen Tarif: wähle Solo oder Multi.', nl: 'Meldingen vragen een abonnement: kies Solo of Multi.',
  it: 'Gli avvisi richiedono un piano: scegli Solo o Multi.', es: 'Las alertas necesitan un plan: elige Solo o Multi.', ja: 'プランを選んでください（Solo または Multi）。',
};

// Plan step (2026-11-18): Solo highlighted, Multi below; the free card shows only if FREE_PLAN != "0".
export const PLAN_UI = {
  en: { badge: 'Recommended', why: 'Solo warns you as soon as we spot the restock, so you can buy before it sells out again.', solo: 'Instant alert · 1 product', free: '1 email a day, the morning after · 1 product' },
  fr: { badge: 'Recommandé', why: 'Solo vous prévient dès que nous repérons le réassort : vous achetez avant la rupture.', solo: 'Alerte instantanée · 1 produit', free: '1 e-mail par jour, le lendemain matin · 1 produit' },
  de: { badge: 'Empfohlen', why: 'Solo meldet sich, sobald wir den Restock sehen: So kaufst du, bevor er wieder ausverkauft ist.', solo: 'Sofort-Alarm · 1 Produkt', free: '1 E-Mail pro Tag, am Morgen danach · 1 Produkt' },
  nl: { badge: 'Aanbevolen', why: 'Solo meldt zich zodra we de restock zien, zodat je koopt voordat hij weer uitverkocht is.', solo: 'Directe melding · 1 product', free: '1 e-mail per dag, de ochtend erna · 1 product' },
  it: { badge: 'Consigliato', why: 'Solo ti avvisa appena vediamo il restock, così compri prima che si esaurisca di nuovo.', solo: 'Avviso istantaneo · 1 prodotto', free: '1 email al giorno, la mattina dopo · 1 prodotto' },
  es: { badge: 'Recomendado', why: 'Solo te avisa en cuanto detectamos la reposición, para que compres antes de que se agote otra vez.', solo: 'Alerta al instante · 1 producto', free: '1 email al día, a la mañana siguiente · 1 producto' },
};

const EMAIL_OK = {
  en: 'Alerts come by email. That is fast enough: at the shops we track, a restock usually stays in stock for several hours before it sells out.',
  fr: 'Les alertes arrivent par e-mail. C\'est assez rapide : dans les boutiques suivies, un réassort reste généralement en stock plusieurs heures avant la rupture.',
  de: 'Alarme kommen per E-Mail. Das reicht: In den Shops, die wir prüfen, bleibt ein Restock meist mehrere Stunden verfügbar, bevor er ausverkauft ist.',
  it: 'Gli avvisi arrivano via email. È abbastanza veloce: nei negozi che seguiamo un restock di solito resta disponibile per diverse ore prima di esaurirsi.',
  es: 'Las alertas llegan por email. Es suficiente: en las tiendas que seguimos, una reposición suele durar varias horas antes de agotarse.',
  nl: 'Meldingen komen per e-mail. Dat is snel genoeg: bij de winkels die we volgen blijft een restock meestal enkele uren op voorraad voordat hij uitverkocht is.',
  ja: '通知はメールで届きます。追跡しているショップでは再入荷は通常数時間続くため、メールで十分間に合います。',
};
const WANT_PHONE = {
  en: 'I would like my alerts as a notification on my phone too',
  fr: 'J\'aimerais aussi recevoir mes alertes en notification sur mon téléphone',
  de: 'Ich hätte meine Alarme gern auch als Benachrichtigung auf dem Handy',
  it: 'Vorrei ricevere gli avvisi anche come notifica sul telefono',
  es: 'Me gustaría recibir mis alertas también como notificación en el móvil',
  nl: 'Ik wil mijn meldingen ook graag als pushbericht op mijn telefoon',
  ja: 'スマホへのプッシュ通知でも受け取りたい',
};
import { allSkus, popularity } from '../data.js';
import { sealed } from './local_data.js';
import { t } from '../../i18n/index.js';
import { fun } from '../../i18n/funnel.js';
import { sourcesOf } from '../../sources/index.js';
import { exitSurvey } from '../exitsurvey.js';

/** Country of the visit: ?c=, else the person's, else US. */
export const visitCountry = (url, user) => (COUNTRIES[url.searchParams.get('c')] ? url.searchParams.get('c') : COUNTRIES[user?.country] ? user.country : 'us');

export async function alertsPage(env, url, user) {
  const cc = visitCountry(url, user); const T = t(cc); const F = fun(T.cc.lang);
  const lottery = T.cc.mode === 'lottery';
  const skus = lottery ? [] : await allSkus(env, cc);
  const sku = url.searchParams.get('sku') ?? '';
  const metro = url.searchParams.get('metro') ?? '';
  const pass = user ? await activePass(env, user.id) : null;
  // online shops only (store-by-store sources are blocked); real sealed products we have read, most wanted first
  const pop = lottery ? new Map() : await popularity(env, cc);
  const picks = skus.filter((k) => sealed(k) && (k.places > 0 || k.slug === sku)).sort((a, b) => (pop.get(b.slug) ?? 0) - (pop.get(a.slug) ?? 0) || (b.places_in ?? 0) - (a.places_in ?? 0) || a.name.localeCompare(b.name));
  const setCount = new Map(); for (const k of picks) if (k.set_id) setCount.set(k.set_id, (setCount.get(k.set_id) ?? 0) + 1);
  const sets = [...new Map(picks.filter((k) => k.set_id && setCount.get(k.set_id) >= 3).map((k) => [k.set_id, k.set_name])).entries()].sort((a, b) => setCount.get(b[0]) - setCount.get(a[0])).slice(0, 15);
  const shops = (kind) => [...new Set(sourcesOf(cc).filter((s) => (kind === 'stores' ? s.kind === 'stores' : s.kind !== 'stores')).map((s) => s.name))].join(', ');
  const metroOptions = T.cc.metros.map((m) => `<option value="${m.slug}"${m.slug === metro ? ' selected' : ''}>${e(m.name)}</option>`).join('');
  const productStep = lottery
    ? `<form data-form="product"><input type="hidden" name="kind" value="lottery">
      <label for="f-sku">${e(F.product)}</label>
      <select id="f-sku" name="sku"><option value="jpset:*">${e(F.allSets)}</option>${JP_SETS.map((s) => `<option value="jpset:${s.slug}">${e(F.anything(s.name))}</option>`).join('')}</select>
      <button class="btn" type="submit">${e(F.cont)}</button></form>`
    : `<form data-form="product"><input type="hidden" name="kind" value="online">
      <label for="f-sku">${e(F.product)}</label>
      <select id="f-sku" name="sku" required><option value="">${e(F.pick)}</option>
        <optgroup label="${e(F.one)}">${picks.map((k) => `<option value="${e(k.slug)}"${k.slug === sku ? ' selected' : ''}>${e(k.name)}</option>`).join('')}</optgroup>
        ${sets.length ? `<optgroup label="${e(F.anySet)}">${sets.map(([id, n]) => `<option value="set:${id}">${e(F.anything(n))}</option>`).join('')}</optgroup>` : ''}</select>
      <button class="btn" type="submit">${e(F.cont)}</button></form>`;
  if (!lottery && !skus.length) {
    return page(env, T, { title: `${F.title} — ${env.BRAND_NAME}`, description: F.title, path: '/alerts', noindex: true, nav: 'alerts',
      body: `<div class="funnel"><h1>${e(F.h1)}</h1><p class="lede">${T.home.soon(T.cc.name)}</p><p><a href="/">United States</a> · <a href="/jp">日本</a></p></div>` });
  }
  const showPush = await pushVisible(env, user);
  const PU = PLAN_UI[T.cc.lang] ?? PLAN_UI.en;
  const body = `<div class="funnel" id="funnel" data-country="${cc}" data-sku="${skus.some((k) => k.slug === sku) || sku.startsWith('jpset:') ? e(sku) : ''}" data-signed="${user ? 1 : 0}" data-pass="${pass ? e(pass.plan) : ''}" data-vapid="${e(env.VAPID_PUBLIC_KEY ?? '')}">
  <h1>${e(F.h1)}</h1>
  <ol class="steps" aria-label="Progress">${[F.steps[1], F.steps[3], F.steps[0]].map((x, i) => `<li data-s="${i + 1}">${e(x)}</li>`).join('')}</ol>

  <section class="step" data-step="3" hidden>
    <h2>${e(F.s1h)}</h2>
    <p class="sub">${e(F.s1sub)}</p>
    ${env.GOOGLE_CLIENT_ID ? `<a class="btn ghost" href="/auth/google?next=${encodeURIComponent('/alerts?' + url.searchParams)}">${e(F.google)}</a>` : ''}
    <form data-form="email"><label for="f-email">${e(F.email)}</label><input id="f-email" name="email" type="email" autocomplete="email" required placeholder="you@example.com">
      <button class="btn" type="submit">${e(F.cont)}</button></form>
    <form data-form="code" hidden><label for="f-code">${e(F.codeLabel)}</label><input id="f-code" name="code" inputmode="numeric" autocomplete="one-time-code" maxlength="6" required>
      <button class="btn" type="submit">${e(F.signIn)}</button></form>
    <p class="err" role="alert"></p>
  </section>

  <section class="step" data-step="1">
    <h2>${e(F.s2h)}</h2>
    ${productStep}
    <p class="err" role="alert"></p>
  </section>

  <section class="step" data-step="2" hidden data-plan-needed="${e(PLAN_NEEDED[T.cc.lang] ?? PLAN_NEEDED.en)}">
    <h2>${e(freeMode(env) ? F.s3h : F.s4h)}</h2>
    <form data-form="plan">
      ${(() => { const S = SHOPS_UI[T.cc.lang] ?? SHOPS_UI.en; return `<div class="shops-pick" hidden data-all="${e(S.all)}" data-none="${e(S.none)}" data-in="${e(S.in)}"><p class="sub"><strong>${e(S.h)}</strong> · <span class="shops-sum"></span> · <button type="button" class="link shops-toggle">${e(S.pick)}</button></p><div class="shop-list" hidden></div></div>`; })()}
      ${freeMode(env) ? `<input type="hidden" name="plan" value="launch"><p class="lede"><strong>${e(freeWords(T).plan)}</strong> · ${e(freeWords(T).planDesc)}</p>` : `${lottery ? '' : `<p class="plan-why">${e(PU.why)}</p>`}<div class="plans${lottery ? ' plans-jp' : ''}">
      <label class="plan plan-rec"><input type="radio" name="plan" value="solo" checked><span>${lottery ? '' : `<span class="plan-badge">${e(PU.badge)}</span>`}<strong>Solo</strong><span class="plan-price">${e(T.f.planMoney(T.cc.prices.solo))} <span class="fine">${e(F.per30)}</span></span><span class="fine">${e(lottery ? F.solo : PU.solo)}</span></span></label>
      ${!lottery && F.free && env.FREE_PLAN !== '0' ? `<label class="plan"><input type="radio" name="plan" value="free"><span><strong>${e(F.freeName)}</strong><span class="plan-price">${e(T.f.money(0))}</span><span class="fine">${e(PU.free)}</span></span></label>` : ''}
      <label class="plan${env.FREE_PLAN === '0' && !lottery ? '' : ' plan-wide'}"><input type="radio" name="plan" value="multi"><span><strong>Multi · ${e(T.f.planMoney(T.cc.prices.multi))}</strong> ${e(F.per30)}<br><span class="fine">${e(F.multi)}</span></span></label></div>`}
      ${cc === 'jp' ? `<fieldset class="channels"><label class="radio"><input type="checkbox" name="line" value="1" checked> ${e(F.line)} <span class="fine">${e(F.lineFine)}</span></label></fieldset>` : ''}
      ${showPush ? pushOption(T) : ''}
      ${cc === 'jp' ? `<p class="sub">${e(EMAIL_OK.ja)}</p>` : ''}
      <button class="btn plan-go" type="submit">${e(freeMode(env) ? freeWords(T).btn : user ? F.checkout : F.cont)}</button>
      ${freeMode(env) ? '' : `<p class="fine plan-fine">${e(F.renew)}</p>`}</form>
    <p class="err" role="alert"></p>
    ${freeMode(env) || pass ? '' : exitSurvey(T, (n) => T.f.planMoney(n).replace(/[.,]00(?=\D|$)/, ''), T.cc.prices.currency ?? T.cc.currency, T.cc.prices.solo)}
  </section>
  </div>`;
  return page(env, T, { title: `${F.title} — ${env.BRAND_NAME}`, description: F.title, path: '/alerts', body, noindex: true, nav: 'alerts' });
}

export async function signinPage(env, url) {
  const next = url.searchParams.get('next') ?? '/account';
  const T = t(visitCountry(url, null)); const W = accountWords(T.cc.lang).signin;
  const body = `<div class="funnel" id="signin" data-next="${e(next)}"><h1>${e(W.h1)}</h1>
  ${env.GOOGLE_CLIENT_ID ? `<a class="btn ghost" href="/auth/google?next=${encodeURIComponent(next)}">${e(W.google)}</a>` : ''}
  <form data-form="email"><label for="s-email">${e(W.email)}</label><input id="s-email" name="email" type="email" autocomplete="email" required><button class="btn" type="submit">${e(W.send)}</button></form>
  <form data-form="code" hidden><label for="s-code">${e(W.code)}</label><input id="s-code" name="code" inputmode="numeric" autocomplete="one-time-code" maxlength="6" required><button class="btn" type="submit">${e(W.btn)}</button></form>
  <p class="err" role="alert"></p></div>`;
  return page(env, T, { title: `${W.h1} — ${env.BRAND_NAME}`, description: W.h1, path: '/signin', body, noindex: true, nav: 'account' });
}

export async function accountPage(env, url, user) {
  if (!user) { const c = url.searchParams.get('c'); return Response.redirect(`${env.BASE_URL}/signin?next=/account${COUNTRIES[c] ? `&c=${c}` : ''}`, 302); }
  const pass = await activePass(env, user.id);
  const alerts = await all(env, `SELECT a.*, k.name AS sku_name, st.name AS set_name FROM alerts a LEFT JOIN skus k ON k.id = a.sku_id LEFT JOIN sets st ON st.id = a.set_id
    WHERE a.user_id = ? AND a.status != 'deleted' ORDER BY a.created_at DESC`, user.id);
  const recent = await all(env, `SELECT s.claimed_at, s.status, s.channels_ok, k.name, st.name AS store, st.online, st.source FROM alert_sent s JOIN alerts a ON a.id = s.alert_id
    JOIN restocks r ON r.id = s.restock_id JOIN skus k ON k.id = r.sku_id JOIN stores st ON st.id = r.store_id WHERE a.user_id = ? ORDER BY s.claimed_at DESC LIMIT 10`, user.id);
  const metroName = (id) => metroById[id]?.name ?? id;
  const T = t(visitCountry(url, user)); const W = accountWords(T.cc.lang);
  const alertsHref = `/alerts?c=${T.cc.code}`;
  const paid = url.searchParams.get('paid');
  const showPush = await pushVisible(env, user);
  const body = `<div class="account" id="account" data-vapid="${e(env.VAPID_PUBLIC_KEY ?? '')}">
  <h1>${e(W.h1)}</h1>
  ${paid ? `<p class="ok" role="status">${e(W.paid)}</p>` : ''}
  ${url.searchParams.get('free') ? `<p class="ok" role="status">${e(freeMode(env) ? W.freeOn : W.freeDaily)}</p>` : ''}
  <p class="lede">${e(user.email)} · ${pass ? W.until(e(PLANS[pass.plan]?.name ?? pass.plan), e(T.f.when(pass.ends_at)), pass.renews) : alerts.some((a) => a.free) ? W.freePlan : W.noPlan}</p>
  ${pass ? (pass.renews ? `<p><button class="btn ghost" data-act="cancel">${e(W.cancel)}</button></p>` : '') : `<p><a class="btn" href="${alertsHref}">${e(alerts.some((a) => a.free) ? W.getInstant : W.pickPlan)}</a></p>`}

  <section><h2>${e(W.watchH)}</h2>${alerts.length ? `<ul class="rows">${alerts.map((a) => `<li class="row" data-alert="${a.id}">
    <span class="name">${e(a.kind === 'lottery' ? (a.set_slug ? (JP_SETS.find((x) => x.slug === a.set_slug)?.name ?? a.set_slug) : '抽選・再販（すべて）') : (a.sku_name ?? W.anything(a.set_name)))}</span>
    <span class="meta">${COUNTRIES[a.country]?.name ?? ''} · ${a.kind === 'online' ? `${e(W.online)}${JSON.parse(a.store_ids || '[]').length ? ` (${e(W.shops(JSON.parse(a.store_ids).length))})` : ''}` : a.kind === 'lottery' ? '抽選' : e(W.stores(metroName(a.metro)))} · ${e(JSON.parse(a.channels).join(', '))}${a.status === 'paused' ? ` · ${e(W.paused)}` : ''}</span>
    <span class="side"><button class="link" data-act="${a.status === 'paused' ? 'resume' : 'pause'}">${e(a.status === 'paused' ? W.resume : W.pause)}</button>
      <button class="link" data-act="delete">${e(W.del)}</button></span></li>`).join('')}</ul>` : `<p class="empty">${e(W.none)} <a href="${alertsHref}">${e(W.setOne)}</a>.</p>`}
    ${pass ? `<p><a href="${alertsHref}">${e(W.add)}</a></p>` : ''}
    <dialog id="del-dialog"><form method="dialog"><p>${e(W.why)}</p>
      <label class="radio"><input type="radio" name="reason" value="bought" checked> ${e(W.bought)}</label>
      <label class="radio"><input type="radio" name="reason" value="too_many"> ${e(W.tooMany)}</label>
      <label class="radio"><input type="radio" name="reason" value="too_slow"> ${e(W.tooSlow)}</label>
      <label class="radio"><input type="radio" name="reason" value="other"> ${e(W.other)}</label>
      <button class="btn" value="ok">${e(W.delBtn)}</button> <button class="link" value="cancel">${e(W.keep)}</button></form></dialog></section>

  ${showPush ? pushAccountBlock(T) : ''}
  <section><h2>${e(W.reachH)}</h2><ul class="rows">
    ${user.country === 'jp' || alerts.some((a) => a.country === 'jp') ? `<li class="row"><span class="name">LINE</span><span class="meta">${e(user.line_user_id ? W.connected : W.notConnected)}</span><span class="side">${env.LINE_BOT_ID ? `<button class="link" data-act="line">${e(user.line_user_id ? W.reconnect : W.connect)}</button>` : ''}</span></li>` : ''}
    <li class="row"><span class="name">${e(W.email)}</span><span class="meta">${e(user.email)}</span><span class="side"></span></li></ul>
    <form class="survey" data-form="channels-survey"${url.searchParams.get('free') || paid ? ' data-open="1"' : ''}>
      <p><strong>${e(W.surveyQ)}</strong> <span class="fine">${e(W.surveyFine)}</span></p>
      ${['push', 'whatsapp', 'telegram', 'discord', 'sms'].map((v) => `<label class="radio"><input type="checkbox" name="ch" value="${v}"> ${e(W.ch[v])}</label>`).join('')}
      <button class="btn small" type="submit">${e(W.send)}</button><p class="ok" role="status" hidden>${e(W.thanks)}</p></form></section>

  <section><h2>${e(W.latestH)}</h2>${recent.length ? `<table><thead><tr>${W.th.map((x) => `<th>${e(x)}</th>`).join('')}</tr></thead><tbody>${recent.map((r) => `<tr><td>${e(r.name)}</td><td>${e(r.online ? W.onlineShop : r.store)}</td><td>${e(T.f.ago(r.claimed_at))}</td><td>${e(r.status === 'held' ? W.digest : r.channels_ok ?? '')}</td></tr>`).join('')}</tbody></table>` : `<p class="empty">${e(W.nothing)}</p>`}</section>
  <p><button class="link" data-act="signout">${e(W.signout)}</button></p></div>`;
  return page(env, T, { title: `${W.title} — ${env.BRAND_NAME}`, description: W.desc, path: '/account', body, noindex: true, nav: 'account' });
}
