// The stepped alert funnel (§2: free daily email or paid instant alerts) and the account page.
// /alerts : 1 email → 2 product (skipped when the product page already chose it) → 3 plan + optional channels → checkout.
// The email is captured at step 1 (lead), so a visitor who stops still gets one
// follow-up. Steps run client-side (public/app.js) against /api/funnel/*.
import { freeMode, freeWords } from '../free.js';
import { escapeHtml as e, timeAgo, formatUtc } from '../../lib/util.js';
import { COUNTRIES, metroById } from '../../data/countries.js';
import { JP_SETS } from '../../data/sets_jp.js';
import { all } from '../../lib/db.js';
import { activePass, PLANS } from '../../billing/pass.js';
import { page } from '../html.js';

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

  <section class="step" data-step="2" hidden>
    <h2>${e(freeMode(env) ? F.s3h : F.s4h)}</h2>
    <form data-form="plan">
      ${(() => { const S = SHOPS_UI[T.cc.lang] ?? SHOPS_UI.en; return `<div class="shops-pick" hidden data-all="${e(S.all)}" data-none="${e(S.none)}" data-in="${e(S.in)}"><p class="sub"><strong>${e(S.h)}</strong> · <span class="shops-sum"></span> · <button type="button" class="link shops-toggle">${e(S.pick)}</button></p><div class="shop-list" hidden></div></div>`; })()}
      ${freeMode(env) ? `<input type="hidden" name="plan" value="launch"><p class="lede"><strong>${e(freeWords(T).plan)}</strong> · ${e(freeWords(T).planDesc)}</p>` : `<label class="plan"><input type="radio" name="plan" value="solo" checked><span><strong>Solo · ${e(T.f.planMoney(T.cc.prices.solo))}</strong> ${e(F.per30)}<br><span class="fine">${e(F.solo)}</span></span></label>
      <label class="plan"><input type="radio" name="plan" value="multi"><span><strong>Multi · ${e(T.f.planMoney(T.cc.prices.multi))}</strong> ${e(F.per30)}<br><span class="fine">${e(F.multi)}</span></span></label>
      ${!lottery && F.free ? `<label class="plan"><input type="radio" name="plan" value="free"><span><strong>${e(F.freeName)} · ${e(T.f.money(0))}</strong><br><span class="fine">${e(F.free)}</span></span></label>` : ''}
      <p class="fine">${e(F.renew)}</p>`}
      ${cc === 'jp' ? `<fieldset class="channels"><label class="radio"><input type="checkbox" name="line" value="1" checked> ${e(F.line)} <span class="fine">${e(F.lineFine)}</span></label></fieldset>` : ''}
      <p class="sub">${e(EMAIL_OK[T.cc.lang] ?? EMAIL_OK.en)}</p>
      <button class="btn" type="submit">${e(freeMode(env) ? freeWords(T).btn : user ? F.checkout : F.cont)}</button></form>
    <p class="err" role="alert"></p>
  </section>
  </div>`;
  return page(env, T, { title: `${F.title} — ${env.BRAND_NAME}`, description: F.title, path: '/alerts', body, noindex: true, nav: 'alerts' });
}

export async function signinPage(env, url) {
  const next = url.searchParams.get('next') ?? '/account';
  const body = `<div class="funnel" id="signin" data-next="${e(next)}"><h1>Sign in</h1>
  ${env.GOOGLE_CLIENT_ID ? `<a class="btn ghost" href="/auth/google?next=${encodeURIComponent(next)}">Continue with Google</a>` : ''}
  <form data-form="email"><label for="s-email">Email</label><input id="s-email" name="email" type="email" autocomplete="email" required><button class="btn" type="submit">Email me a code</button></form>
  <form data-form="code" hidden><label for="s-code">6-digit code (works for 1 hour)</label><input id="s-code" name="code" inputmode="numeric" autocomplete="one-time-code" maxlength="6" required><button class="btn" type="submit">Sign in</button></form>
  <p class="err" role="alert"></p></div>`;
  return page(env, t(visitCountry(url, null)), { title: `Sign in — ${env.BRAND_NAME}`, description: 'Sign in', path: '/signin', body, noindex: true, nav: 'account' });
}

export async function accountPage(env, url, user) {
  if (!user) return Response.redirect(`${env.BASE_URL}/signin?next=/account`, 302);
  const pass = await activePass(env, user.id);
  const alerts = await all(env, `SELECT a.*, k.name AS sku_name, st.name AS set_name FROM alerts a LEFT JOIN skus k ON k.id = a.sku_id LEFT JOIN sets st ON st.id = a.set_id
    WHERE a.user_id = ? AND a.status != 'deleted' ORDER BY a.created_at DESC`, user.id);
  const recent = await all(env, `SELECT s.claimed_at, s.status, s.channels_ok, k.name, st.name AS store, st.online, st.source FROM alert_sent s JOIN alerts a ON a.id = s.alert_id
    JOIN restocks r ON r.id = s.restock_id JOIN skus k ON k.id = r.sku_id JOIN stores st ON st.id = r.store_id WHERE a.user_id = ? ORDER BY s.claimed_at DESC LIMIT 10`, user.id);
  const metroName = (id) => metroById[id]?.name ?? id;
  const T = t(visitCountry(url, user));
  const paid = url.searchParams.get('paid');
  const body = `<div class="account" id="account" data-vapid="${e(env.VAPID_PUBLIC_KEY ?? '')}">
  <h1>Your alerts</h1>
  ${paid ? '<p class="ok" role="status">Payment received. Your alerts are live: we email you the moment a restock is detected.</p>' : ''}
  ${url.searchParams.get('free') ? (freeMode(env) ? '<p class="ok" role="status">Your alert is on. We email you as soon as it is back in stock.</p>' : '<p class="ok" role="status">Your free alert is on. Every morning you get one email with the restocks it caught the day before.</p>') : ''}
  <p class="lede">${e(user.email)} · ${pass ? `<strong>${e(PLANS[pass.plan]?.name ?? pass.plan)}</strong> until ${formatUtc(pass.ends_at)}${pass.renews ? ' (renews)' : ' (will not renew)'}` : alerts.some((a) => a.free) ? '<strong>Free plan</strong>: one email a day with yesterday\'s restocks. Paid alerts arrive within seconds of a restock.' : '<strong>No active plan</strong>: alerts are paused until you pick one.'}</p>
  ${pass ? (pass.renews ? '<p><button class="btn ghost" data-act="cancel">Cancel renewal</button></p>' : '') : `<p><a class="btn" href="/alerts">${alerts.some((a) => a.free) ? 'Get instant alerts' : 'Pick a plan'}</a></p>`}

  <section><h2>What we watch for you</h2>${alerts.length ? `<ul class="rows">${alerts.map((a) => `<li class="row" data-alert="${a.id}">
    <span class="name">${e(a.kind === 'lottery' ? (a.set_slug ? (JP_SETS.find((x) => x.slug === a.set_slug)?.name ?? a.set_slug) : '抽選・再販（すべて）') : (a.sku_name ?? `Anything from ${a.set_name}`))}</span>
    <span class="meta">${COUNTRIES[a.country]?.name ?? ''} · ${a.kind === 'online' ? `Online${JSON.parse(a.store_ids || '[]').length ? ` (${JSON.parse(a.store_ids).length} shops)` : ''}` : a.kind === 'lottery' ? '抽選' : `Stores in ${e(metroName(a.metro))}`} · ${e(JSON.parse(a.channels).join(', '))}${a.status === 'paused' ? ' · paused' : ''}</span>
    <span class="side"><button class="link" data-act="${a.status === 'paused' ? 'resume' : 'pause'}">${a.status === 'paused' ? 'Resume' : 'Pause'}</button>
      <button class="link" data-act="delete">Delete</button></span></li>`).join('')}</ul>` : '<p class="empty">No alert yet. <a href="/alerts">Set one up</a>.</p>'}
    ${pass ? '<p><a href="/alerts">Add an alert</a></p>' : ''}
    <dialog id="del-dialog"><form method="dialog"><p>Why are you deleting this alert?</p>
      <label class="radio"><input type="radio" name="reason" value="bought" checked> I bought it</label>
      <label class="radio"><input type="radio" name="reason" value="too_many"> Too many alerts</label>
      <label class="radio"><input type="radio" name="reason" value="too_slow"> Alerts came too late</label>
      <label class="radio"><input type="radio" name="reason" value="other"> Something else</label>
      <button class="btn" value="ok">Delete alert</button> <button class="link" value="cancel">Keep it</button></form></dialog></section>

  <section><h2>How we reach you</h2><ul class="rows">
    ${user.country === 'jp' || alerts.some((a) => a.country === 'jp') ? `<li class="row"><span class="name">LINE</span><span class="meta">${user.line_user_id ? 'Connected' : 'Not connected'}</span><span class="side">${env.LINE_BOT_ID ? `<button class="link" data-act="line">${user.line_user_id ? 'Reconnect' : 'Connect'}</button>` : ''}</span></li>` : ''}
    <li class="row"><span class="name">Email</span><span class="meta">${e(user.email)}</span><span class="side"></span></li></ul>
    <form class="survey" data-form="channels-survey"${url.searchParams.get('free') || paid ? ' data-open="1"' : ''}>
      <p><strong>Which other ways would you like to get your alerts?</strong> <span class="fine">Tick all that apply: we build the most requested first.</span></p>
      ${[['push', 'Phone notification'], ['whatsapp', 'WhatsApp'], ['telegram', 'Telegram'], ['discord', 'Discord'], ['sms', 'Text message (SMS)']].map(([v, l]) => `<label class="radio"><input type="checkbox" name="ch" value="${v}"> ${l}</label>`).join('')}
      <button class="btn small" type="submit">Send</button><p class="ok" role="status" hidden>Thanks, noted.</p></form></section>

  <section><h2>Latest alerts sent</h2>${recent.length ? `<table><thead><tr><th>Product</th><th>Where</th><th>When</th><th>Via</th></tr></thead><tbody>${recent.map((r) => `<tr><td>${e(r.name)}</td><td>${e(r.online ? 'online' : r.store)}</td><td>${timeAgo(r.claimed_at)}</td><td>${e(r.status === 'held' ? 'email (next digest)' : r.channels_ok ?? '')}</td></tr>`).join('')}</tbody></table>` : '<p class="empty">Nothing yet. You will see each alert here.</p>'}</section>
  <p><button class="link" data-act="signout">Sign out</button></p></div>`;
  return page(env, T, { title: `Account — ${env.BRAND_NAME}`, description: 'Your alerts', path: '/account', body, noindex: true, nav: 'account' });
}
