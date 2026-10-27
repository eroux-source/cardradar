// The stepped alert funnel (§2: free daily email or paid instant alerts) and the account page.
// /alerts : 1 email → 2 product + place → 3 how to reach you → 4 plan → checkout.
// The email is captured at step 1 (lead), so a visitor who stops still gets one
// follow-up. Steps run client-side (public/app.js) against /api/funnel/*.
import { escapeHtml as e, timeAgo, formatUtc } from '../../lib/util.js';
import { COUNTRIES, metroById } from '../../data/countries.js';
import { JP_SETS } from '../../data/sets_jp.js';
import { all } from '../../lib/db.js';
import { activePass, PLANS } from '../../billing/pass.js';
import { page } from '../html.js';
import { allSkus } from '../data.js';
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
  const sets = [...new Map(skus.filter((k) => k.set_id).map((k) => [k.set_id, k.set_name])).entries()];
  const shops = (kind) => [...new Set(sourcesOf(cc).filter((s) => (kind === 'stores' ? s.kind === 'stores' : s.kind !== 'stores')).map((s) => s.name))].join(', ');
  const metroOptions = T.cc.metros.map((m) => `<option value="${m.slug}"${m.slug === metro ? ' selected' : ''}>${e(m.name)}</option>`).join('');
  const productStep = lottery
    ? `<form data-form="product"><input type="hidden" name="kind" value="lottery">
      <label for="f-sku">${e(F.product)}</label>
      <select id="f-sku" name="sku"><option value="jpset:*">${e(F.allSets)}</option>${JP_SETS.map((s) => `<option value="jpset:${s.slug}">${e(F.anything(s.name))}</option>`).join('')}</select>
      <button class="btn" type="submit">${e(F.cont)}</button></form>`
    : `<form data-form="product">
      <label for="f-sku">${e(F.product)}</label>
      <select id="f-sku" name="sku" required><option value="">${e(F.pick)}</option>
        ${sets.length ? `<optgroup label="${e(F.anySet)}">${sets.map(([id, n]) => `<option value="set:${id}">${e(F.anything(n))}</option>`).join('')}</optgroup>` : ''}
        <optgroup label="${e(F.one)}">${skus.map((k) => `<option value="${e(k.slug)}"${k.slug === sku ? ' selected' : ''}>${e(k.name)}</option>`).join('')}</optgroup></select>
      <fieldset><legend>${e(F.where)}</legend>
        ${shops('stores') ? `<label class="radio"><input type="radio" name="kind" value="stores" ${metro || !sku ? 'checked' : ''}> ${e(F.storesIn(shops('stores')))}</label>` : ''}
        <label class="radio"><input type="radio" name="kind" value="online" ${(!metro && sku) || !shops('stores') ? 'checked' : ''}> ${e(F.onlineAt(shops('online')))}</label>
      </fieldset>
      <label for="f-metro">${e(F.city)}</label><select id="f-metro" name="metro"><option value="">${e(F.pickCity)}</option>${metroOptions}</select>
      <button class="btn" type="submit">${e(F.cont)}</button></form>`;
  if (!lottery && !skus.length) {
    return page(env, T, { title: `${F.title} — ${env.BRAND_NAME}`, description: F.title, path: '/alerts', noindex: true, nav: 'alerts',
      body: `<div class="funnel"><h1>${e(F.h1)}</h1><p class="lede">${T.home.soon(T.cc.name)}</p><p><a href="/">United States</a> · <a href="/jp">日本</a></p></div>` });
  }
  const body = `<div class="funnel" id="funnel" data-country="${cc}" data-signed="${user ? 1 : 0}" data-pass="${pass ? e(pass.plan) : ''}" data-vapid="${e(env.VAPID_PUBLIC_KEY ?? '')}">
  <h1>${e(F.h1)}</h1>
  <ol class="steps" aria-label="Progress">${F.steps.map((x, i) => `<li data-s="${i + 1}">${e(x)}</li>`).join('')}</ol>

  <section class="step" data-step="1"${user ? ' hidden' : ''}>
    <h2>${e(F.s1h)}</h2>
    <p class="sub">${e(F.s1sub)}</p>
    <a class="btn ghost" href="/auth/google?next=${encodeURIComponent('/alerts?' + url.searchParams)}">${e(F.google)}</a>
    <form data-form="email"><label for="f-email">${e(F.email)}</label><input id="f-email" name="email" type="email" autocomplete="email" required placeholder="you@example.com">
      <button class="btn" type="submit">${e(F.cont)}</button></form>
    <form data-form="code" hidden><label for="f-code">${e(F.codeLabel)}</label><input id="f-code" name="code" inputmode="numeric" autocomplete="one-time-code" maxlength="6" required>
      <button class="btn" type="submit">${e(F.signIn)}</button></form>
    <p class="err" role="alert"></p>
  </section>

  <section class="step" data-step="2"${user ? '' : ' hidden'}>
    <h2>${e(F.s2h)}</h2>
    ${productStep}
    <p class="err" role="alert"></p>
  </section>

  <section class="step" data-step="3" hidden>
    <h2>${e(F.s3h)}</h2>
    <p class="sub">${e(F.s3sub)}</p>
    <form data-form="channels">
      <label class="radio"><input type="checkbox" name="push" value="1"> ${e(F.push)} <span class="fine">${e(F.pushFine)}</span></label>
      ${cc === 'jp' ? `<label class="radio"><input type="checkbox" name="line" value="1" checked> ${e(F.line)} <span class="fine">${e(F.lineFine)}</span></label>` : ''}
      <label class="radio"><input type="checkbox" name="telegram" value="1"> ${e(F.telegram)} <span class="fine">${e(F.tgFine)}</span></label>
      <label class="radio"><input type="checkbox" checked disabled> ${e(F.emailAlways)}</label>
      <button class="btn" type="submit">${e(F.cont)}</button></form>
    <p class="err" role="alert"></p>
  </section>

  <section class="step" data-step="4" hidden>
    <h2>${e(F.s4h)}</h2>
    <form data-form="plan">
      <label class="plan"><input type="radio" name="plan" value="solo" checked><span><strong>Solo · ${e(T.f.money(T.cc.prices.solo))}</strong> ${e(F.per30)}<br><span class="fine">${e(F.solo)}</span></span></label>
      <label class="plan"><input type="radio" name="plan" value="multi"><span><strong>Multi · ${e(T.f.money(T.cc.prices.multi))}</strong> ${e(F.per30)}<br><span class="fine">${e(F.multi)}</span></span></label>
      ${!lottery && F.free ? `<label class="plan"><input type="radio" name="plan" value="free"><span><strong>${e(F.freeName)} · ${e(T.f.money(0))}</strong><br><span class="fine">${e(F.free)}</span></span></label>` : ''}
      <p class="fine">${e(F.renew)}</p>
      <button class="btn" type="submit">${e(F.checkout)}</button></form>
    <p class="err" role="alert"></p>
  </section>
  </div>`;
  return page(env, T, { title: `${F.title} — ${env.BRAND_NAME}`, description: F.title, path: '/alerts', body, noindex: true, nav: 'alerts' });
}

export async function signinPage(env, url) {
  const next = url.searchParams.get('next') ?? '/account';
  const body = `<div class="funnel" id="signin" data-next="${e(next)}"><h1>Sign in</h1>
  <a class="btn ghost" href="/auth/google?next=${encodeURIComponent(next)}">Continue with Google</a>
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
  ${paid ? '<p class="ok" role="status">Payment received. Your alerts are live. Connect Telegram or phone notifications below so you hear about restocks first.</p>' : ''}
  ${url.searchParams.get('free') ? '<p class="ok" role="status">Your free alert is on. Every morning you get one email with the restocks it caught the day before.</p>' : ''}
  <p class="lede">${e(user.email)} · ${pass ? `<strong>${e(PLANS[pass.plan]?.name ?? pass.plan)}</strong> until ${formatUtc(pass.ends_at)}${pass.renews ? ' (renews)' : ' (will not renew)'}` : alerts.some((a) => a.free) ? '<strong>Free plan</strong>: one email a day with yesterday\'s restocks. Paid alerts arrive within seconds of a restock.' : '<strong>No active plan</strong>: alerts are paused until you pick one.'}</p>
  ${pass ? (pass.renews ? '<p><button class="btn ghost" data-act="cancel">Cancel renewal</button></p>' : '') : `<p><a class="btn" href="/alerts">${alerts.some((a) => a.free) ? 'Get instant alerts' : 'Pick a plan'}</a></p>`}

  <section><h2>What we watch for you</h2>${alerts.length ? `<ul class="rows">${alerts.map((a) => `<li class="row" data-alert="${a.id}">
    <span class="name">${e(a.kind === 'lottery' ? (a.set_slug ? (JP_SETS.find((x) => x.slug === a.set_slug)?.name ?? a.set_slug) : '抽選・再販（すべて）') : (a.sku_name ?? `Anything from ${a.set_name}`))}</span>
    <span class="meta">${COUNTRIES[a.country]?.name ?? ''} · ${a.kind === 'online' ? 'Online' : a.kind === 'lottery' ? '抽選' : `Stores in ${e(metroName(a.metro))}`} · ${e(JSON.parse(a.channels).join(', '))}${a.status === 'paused' ? ' · paused' : ''}</span>
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
    <li class="row"><span class="name">Phone notification</span><span class="meta">${user.push_endpoint ? 'On for this device' : 'Off'}</span><span class="side"><button class="link" data-act="push">${user.push_endpoint ? 'Use this device' : 'Turn on'}</button>${user.push_endpoint ? ' <button class="link" data-act="test" data-ch="push">Send a test</button>' : ''}</span></li>
    <li class="row"><span class="name">Telegram</span><span class="meta">${user.telegram_chat_id ? 'Connected' : 'Not connected'}</span><span class="side">${env.TELEGRAM_BOT_NAME ? `<button class="link" data-act="telegram">${user.telegram_chat_id ? 'Reconnect' : 'Connect'}</button>` : ''}${user.telegram_chat_id ? ' <button class="link" data-act="test" data-ch="telegram">Send a test</button>' : ''}</span></li>
    ${user.country === 'jp' || alerts.some((a) => a.country === 'jp') ? `<li class="row"><span class="name">LINE</span><span class="meta">${user.line_user_id ? 'Connected' : 'Not connected'}</span><span class="side">${env.LINE_BOT_ID ? `<button class="link" data-act="line">${user.line_user_id ? 'Reconnect' : 'Connect'}</button>` : ''}</span></li>` : ''}
    <li class="row"><span class="name">Email</span><span class="meta">${e(user.email)} · backup, at most one per hour</span><span class="side"></span></li></ul></section>

  <section><h2>Latest alerts sent</h2>${recent.length ? `<table><thead><tr><th>Product</th><th>Where</th><th>When</th><th>Via</th></tr></thead><tbody>${recent.map((r) => `<tr><td>${e(r.name)}</td><td>${e(r.online ? 'online' : r.store)}</td><td>${timeAgo(r.claimed_at)}</td><td>${e(r.status === 'held' ? 'email (next digest)' : r.channels_ok ?? '')}</td></tr>`).join('')}</tbody></table>` : '<p class="empty">Nothing yet. You will see each alert here.</p>'}</section>
  <p><button class="link" data-act="signout">Sign out</button></p></div>`;
  return page(env, T, { title: `Account — ${env.BRAND_NAME}`, description: 'Your alerts', path: '/account', body, noindex: true, nav: 'account' });
}
