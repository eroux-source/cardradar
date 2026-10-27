// The paid-only stepped funnel (§2) and the account page.
// /alerts : 1 email → 2 product + place → 3 how to reach you → 4 plan → checkout.
// The email is captured at step 1 (lead), so a visitor who stops still gets one
// follow-up. Steps run client-side (public/app.js) against /api/funnel/*.
import { escapeHtml as e, timeAgo, formatUtc } from '../../lib/util.js';
import { metros } from '../../data/metros.js';
import { all } from '../../lib/db.js';
import { activePass, PLANS } from '../../billing/pass.js';
import { page } from '../html.js';
import { allSkus } from '../data.js';

const metroOptions = (sel = '') => metros.map((m) => `<option value="${m.slug}"${m.slug === sel ? ' selected' : ''}>${e(m.name)}, ${e(m.state)}</option>`).join('');

export async function alertsPage(env, url, user) {
  const skus = await allSkus(env);
  const sku = url.searchParams.get('sku') ?? '';
  const metro = url.searchParams.get('metro') ?? '';
  const pass = user ? await activePass(env, user.id) : null;
  const sets = [...new Map(skus.filter((k) => k.set_id).map((k) => [k.set_id, k.set_name])).entries()];
  const body = `<div class="funnel" id="funnel" data-signed="${user ? 1 : 0}" data-pass="${pass ? e(pass.plan) : ''}" data-vapid="${e(env.VAPID_PUBLIC_KEY ?? '')}">
  <h1>Set up your restock alert</h1>
  <ol class="steps" aria-label="Progress"><li data-s="1">Email</li><li data-s="2">Product</li><li data-s="3">Alerts</li><li data-s="4">Plan</li></ol>

  <section class="step" data-step="1"${user ? ' hidden' : ''}>
    <h2>Where should we reach you?</h2>
    <p class="sub">Your email keeps your alerts and receipts. No password.</p>
    <a class="btn ghost" href="/auth/google?next=${encodeURIComponent('/alerts?' + url.searchParams)}">Continue with Google</a>
    <form data-form="email"><label for="f-email">Email</label><input id="f-email" name="email" type="email" autocomplete="email" required placeholder="you@example.com">
      <button class="btn" type="submit">Continue</button></form>
    <form data-form="code" hidden><label for="f-code">We sent a 6-digit code to your email. It works for 1 hour.</label><input id="f-code" name="code" inputmode="numeric" autocomplete="one-time-code" maxlength="6" required>
      <button class="btn" type="submit">Sign in</button></form>
    <p class="err" role="alert"></p>
  </section>

  <section class="step" data-step="2"${user ? '' : ' hidden'}>
    <h2>What should we watch?</h2>
    <form data-form="product">
      <label for="f-sku">Product</label>
      <select id="f-sku" name="sku" required><option value="">Pick a product</option>
        ${sets.length ? `<optgroup label="Any sealed product of a set (Multi)">${sets.map(([id, n]) => `<option value="set:${id}">Anything from ${e(n)}</option>`).join('')}</optgroup>` : ''}
        <optgroup label="One product">${skus.map((k) => `<option value="${e(k.slug)}"${k.slug === sku ? ' selected' : ''}>${e(k.name)}</option>`).join('')}</optgroup></select>
      <fieldset><legend>Where</legend>
        <label class="radio"><input type="radio" name="kind" value="stores" ${metro || !sku ? 'checked' : ''}> Stores in my city (Target, Best Buy, GameStop)</label>
        <label class="radio"><input type="radio" name="kind" value="online" ${!metro && sku ? 'checked' : ''}> Online (Pokémon Center, Costco, Target, Best Buy)</label>
      </fieldset>
      <label for="f-metro">City</label><select id="f-metro" name="metro"><option value="">Pick your city</option>${metroOptions(metro)}</select>
      <button class="btn" type="submit">Continue</button></form>
    <p class="err" role="alert"></p>
  </section>

  <section class="step" data-step="3" hidden>
    <h2>How should we ping you?</h2>
    <p class="sub">Stock often lasts minutes. A phone notification or Telegram is the fastest; email is the backup.</p>
    <form data-form="channels">
      <label class="radio"><input type="checkbox" name="push" value="1"> Phone notification <span class="fine">On iPhone: Share › Add to Home Screen first, then open it from there.</span></label>
      <label class="radio"><input type="checkbox" name="telegram" value="1"> Telegram <span class="fine">You connect it in one tap after checkout.</span></label>
      <label class="radio"><input type="checkbox" checked disabled> Email (always on, at most one per hour)</label>
      <button class="btn" type="submit">Continue</button></form>
    <p class="err" role="alert"></p>
  </section>

  <section class="step" data-step="4" hidden>
    <h2>Pick your plan</h2>
    <form data-form="plan">
      <label class="plan"><input type="radio" name="plan" value="solo" checked><span><strong>Solo · $${e(env.PRICE_SOLO)}</strong> for 30 days<br><span class="fine">${e(PLANS.solo.blurb)}</span></span></label>
      <label class="plan"><input type="radio" name="plan" value="multi"><span><strong>Multi · $${e(env.PRICE_MULTI)}</strong> for 30 days<br><span class="fine">${e(PLANS.multi.blurb)}</span></span></label>
      <p class="fine">Renews every 30 days, cancel in 2 clicks from your account. Tax may be added at checkout depending on where you live. We alert, you buy from the retailer.</p>
      <button class="btn" type="submit">Go to secure checkout</button></form>
    <p class="err" role="alert"></p>
  </section>
  </div>`;
  return page(env, { title: `Set up a restock alert — ${env.BRAND_NAME}`, description: 'Pokémon TCG restock alerts.', path: '/alerts', body, noindex: true, nav: 'alerts' });
}

export async function signinPage(env, url) {
  const next = url.searchParams.get('next') ?? '/account';
  const body = `<div class="funnel" id="signin" data-next="${e(next)}"><h1>Sign in</h1>
  <a class="btn ghost" href="/auth/google?next=${encodeURIComponent(next)}">Continue with Google</a>
  <form data-form="email"><label for="s-email">Email</label><input id="s-email" name="email" type="email" autocomplete="email" required><button class="btn" type="submit">Email me a code</button></form>
  <form data-form="code" hidden><label for="s-code">6-digit code (works for 1 hour)</label><input id="s-code" name="code" inputmode="numeric" autocomplete="one-time-code" maxlength="6" required><button class="btn" type="submit">Sign in</button></form>
  <p class="err" role="alert"></p></div>`;
  return page(env, { title: `Sign in — ${env.BRAND_NAME}`, description: 'Sign in', path: '/signin', body, noindex: true, nav: 'account' });
}

export async function accountPage(env, url, user) {
  if (!user) return Response.redirect(`${env.BASE_URL}/signin?next=/account`, 302);
  const pass = await activePass(env, user.id);
  const alerts = await all(env, `SELECT a.*, k.name AS sku_name, st.name AS set_name FROM alerts a LEFT JOIN skus k ON k.id = a.sku_id LEFT JOIN sets st ON st.id = a.set_id
    WHERE a.user_id = ? AND a.status != 'deleted' ORDER BY a.created_at DESC`, user.id);
  const recent = await all(env, `SELECT s.claimed_at, s.status, s.channels_ok, k.name, st.name AS store, st.online, st.source FROM alert_sent s JOIN alerts a ON a.id = s.alert_id
    JOIN restocks r ON r.id = s.restock_id JOIN skus k ON k.id = r.sku_id JOIN stores st ON st.id = r.store_id WHERE a.user_id = ? ORDER BY s.claimed_at DESC LIMIT 10`, user.id);
  const metroName = (slug) => metros.find((m) => m.slug === slug)?.name ?? slug;
  const paid = url.searchParams.get('paid');
  const body = `<div class="account" id="account" data-vapid="${e(env.VAPID_PUBLIC_KEY ?? '')}">
  <h1>Your alerts</h1>
  ${paid ? '<p class="ok" role="status">Payment received. Your alerts are live. Connect Telegram or phone notifications below so you hear about restocks first.</p>' : ''}
  <p class="lede">${e(user.email)} · ${pass ? `<strong>${e(PLANS[pass.plan]?.name ?? pass.plan)}</strong> until ${formatUtc(pass.ends_at)}${pass.renews ? ' (renews)' : ' (will not renew)'}` : '<strong>No active plan</strong>: alerts are paused until you pick one.'}</p>
  ${pass ? (pass.renews ? '<p><button class="btn ghost" data-act="cancel">Cancel renewal</button></p>' : '') : '<p><a class="btn" href="/alerts">Pick a plan</a></p>'}

  <section><h2>What we watch for you</h2>${alerts.length ? `<ul class="rows">${alerts.map((a) => `<li class="row" data-alert="${a.id}">
    <span class="name">${e(a.sku_name ?? `Anything from ${a.set_name}`)}</span>
    <span class="meta">${a.kind === 'online' ? 'Online' : `Stores in ${e(metroName(a.metro))}`} · ${e(JSON.parse(a.channels).join(', '))}${a.status === 'paused' ? ' · paused' : ''}</span>
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
    <li class="row"><span class="name">Email</span><span class="meta">${e(user.email)} · backup, at most one per hour</span><span class="side"></span></li></ul></section>

  <section><h2>Latest alerts sent</h2>${recent.length ? `<table><thead><tr><th>Product</th><th>Where</th><th>When</th><th>Via</th></tr></thead><tbody>${recent.map((r) => `<tr><td>${e(r.name)}</td><td>${e(r.online ? 'online' : r.store)}</td><td>${timeAgo(r.claimed_at)}</td><td>${e(r.status === 'held' ? 'email (next digest)' : r.channels_ok ?? '')}</td></tr>`).join('')}</tbody></table>` : '<p class="empty">Nothing yet. You will see each alert here.</p>'}</section>
  <p><button class="link" data-act="signout">Sign out</button></p></div>`;
  return page(env, { title: `Account — ${env.BRAND_NAME}`, description: 'Your alerts', path: '/account', body, noindex: true, nav: 'account' });
}
