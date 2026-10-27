// Owner pages (§8), in French for Eugène. Plain-language verdict first.
// Access: Cloudflare Access in front of /owner/* in production (header
// Cf-Access-Jwt-Assertion), or the x-admin-key header. Locally (http) ?key=ADMIN_KEY works.
// These pages read small indexed slices and mk_stats, never heavy SQL on raw events.
import { all, one, run, now, settings, setSetting } from '../lib/db.js';
import { escapeHtml as e, timeAgo, formatDuration } from '../lib/util.js';
import { sourceList, enabledSources } from '../sources/index.js';
import { measuredSpeed } from '../web/data.js';

export function ownerAllowed(env, req, url) {
  if (req.headers.get('cf-access-jwt-assertion')) return true; // Cloudflare Access already checked the person
  if (env.ADMIN_KEY && req.headers.get('x-admin-key') === env.ADMIN_KEY) return true;
  return !!env.ADMIN_KEY && env.BASE_URL?.startsWith('http://') && url.searchParams.get('key') === env.ADMIN_KEY;
}

const shell = (title, body, key) => new Response(`<!doctype html><html lang="fr"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><meta name="robots" content="noindex">
<title>${e(title)}</title><link rel="stylesheet" href="/site.css"></head><body class="owner"><main class="wrap">
<p class="crumbs"><a href="/owner/monitor${key}">Surveillance</a> · <a href="/owner/marketing${key}">Marketing</a> · <a href="/owner/bakeoff${key}">Test des sources</a> · <a href="/">Site</a></p>${body}</main></body></html>`,
{ headers: { 'content-type': 'text/html; charset=utf-8', 'cache-control': 'no-store' } });

const SWITCHES = [
  ['crawl', 'Lecture des magasins', 'kill'], ['alert_pipeline', 'Envoi des alertes', 'kill'], ['deliver_fanout', 'Envoi en file (gros volumes)', 'kill'],
  ['budget.proxy', 'Proxies', 'kill'], ['email_pause', 'Pause des emails (sauf codes)', 'flag'],
];

export async function monitor(env, url) {
  const key = url.searchParams.get('key') ? `?key=${encodeURIComponent(url.searchParams.get('key'))}` : '';
  const t = now(); const day = t - 864e5;
  const s = await settings(env);
  const [health, perSource, claims, outbox, dead, reports, lastRead, speed, paying] = await Promise.all([
    all(env, 'SELECT * FROM source_health'),
    all(env, 'SELECT source, COUNT(*) n, MAX(started_at) last FROM restocks WHERE started_at > ? GROUP BY source', day),
    all(env, 'SELECT status, COUNT(*) n FROM alert_sent WHERE claimed_at > ? GROUP BY status', day),
    one(env, 'SELECT COUNT(*) n, MIN(not_before) oldest FROM email_outbox WHERE sent_at IS NULL'),
    all(env, 'SELECT * FROM dead_letters WHERE at > ? ORDER BY at DESC LIMIT 10', day),
    all(env, "SELECT * FROM reports WHERE kind != 'pass_reminder' ORDER BY at DESC LIMIT 8"),
    one(env, 'SELECT MAX(seen_at) t FROM stock'),
    measuredSpeed(env),
    one(env, "SELECT COUNT(DISTINCT user_id) n FROM passes WHERE status IN ('active','refunded_kept') AND ends_at > ?", t),
  ]);
  const H = Object.fromEntries(health.map((h) => [h.source, h]));
  const R = Object.fromEntries(perSource.map((r) => [r.source, r]));
  const C = Object.fromEntries(claims.map((c) => [c.status, c.n]));
  const enabled = new Set(enabledSources(env).map((x) => x.id));

  // Verdict in plain words
  const problems = [];
  if (s.crawl === 'off') problems.push('la lecture des magasins est coupée');
  if (s.alert_pipeline === 'off') problems.push("l'envoi des alertes est coupé");
  if (!lastRead.t || t - lastRead.t > 10 * 60e3) problems.push(`aucune lecture de stock depuis ${lastRead.t ? timeAgo(lastRead.t) : 'le début'}`);
  for (const src of sourceList) {
    const h = H[src.id];
    if (!enabled.has(src.id)) continue;
    if (h?.status === 'blocked') problems.push(`${src.name} nous bloque (repos 10 min, puis nouvel essai)`);
    if (h?.status === 'stale') problems.push(`${src.name} renvoie des données douteuses (le magasin témoin dit « épuisé »)`);
  }
  if (C.failed) problems.push(`${C.failed} alerte(s) n'ont pas pu partir en 24 h`);
  if (dead.length) problems.push(`${dead.length} message(s) en lettre morte en 24 h`);
  if (outbox.n && outbox.oldest < t - 30 * 60e3 && s.email_pause !== 'on') problems.push(`${outbox.n} email(s) en attente depuis plus de 30 min`);
  if (speed && speed.p90 > 5 * 60e3) problems.push(`les alertes sont lentes (90 % en moins de ${formatDuration(speed.p90)})`);
  const verdict = problems.length ? `⚠️ À regarder : ${problems.join(' ; ')}.` : '✅ Tout va bien : les magasins sont lus, les alertes partent.';

  const plain = [
    `Rapport ${env.BRAND_NAME} — ${new Date(t).toISOString()}`,
    verdict,
    `Clients payants : ${paying.n}. Alertes 24 h : ${Object.entries(C).map(([k, v]) => `${k}=${v}`).join(', ') || 'aucune'}. Vitesse : ${speed ? `médiane ${formatDuration(speed.p50)}, p90 ${formatDuration(speed.p90)} (${speed.n})` : 'pas assez de mesures'}.`,
    ...sourceList.map((src) => `${src.name} : ${enabled.has(src.id) ? (H[src.id]?.status ?? 'jamais lu') : 'désactivé'}, ${R[src.id]?.n ?? 0} réassort(s) en 24 h, dernière erreur : ${H[src.id]?.last_error ?? '—'}`),
    `Emails en attente : ${outbox.n}. Lettres mortes 24 h : ${dead.length}.`,
    ...reports.slice(0, 4).map((r) => `[${r.kind}] ${r.text}`),
  ].join('\n');

  const body = `<h1>Surveillance</h1><p class="lede">${e(verdict)}</p>
  <p class="sub">Clients payants : <strong>${paying.n}</strong> · Dernière lecture : ${lastRead.t ? timeAgo(lastRead.t) : 'jamais'} · Vitesse des alertes : ${speed ? `médiane ${formatDuration(speed.p50)}, 90 % sous ${formatDuration(speed.p90)}` : 'pas encore assez de mesures (20 minimum)'}</p>
  <h2>Magasins</h2><table><thead><tr><th>Source</th><th>État</th><th>Réassorts 24 h</th><th>Dernier OK</th><th>Dernière erreur</th></tr></thead><tbody>
  ${sourceList.map((src) => { const h = H[src.id]; return `<tr><td>${e(src.name)}</td><td>${!enabled.has(src.id) ? 'désactivé (clé manquante)' : h?.status === 'ok' ? '✅ OK' : h?.status === 'blocked' ? '⛔ bloqué' : h?.status === 'stale' ? '⚠️ douteux' : 'pas encore lu'}</td><td>${R[src.id]?.n ?? 0}</td><td>${h?.last_ok_at ? timeAgo(h.last_ok_at) : '—'}</td><td>${e(h?.last_error ?? '—')}</td></tr>`; }).join('')}</tbody></table>
  <h2>Alertes 24 h</h2><p>Envoyées : ${C.sent ?? 0} · En attente (digest email) : ${C.held ?? 0} · Échecs : ${C.failed ?? 0} · Réservées non envoyées : ${C.claimed ?? 0}</p>
  <h2>Interrupteurs</h2><form method="post" action="/owner/settings${key}"><ul class="rows">${SWITCHES.map(([k, label, type]) => {
    const on = type === 'kill' ? s[k] !== 'off' : s[k] === 'on';
    return `<li class="row"><span class="name">${e(label)}</span><span class="meta">${on ? 'actif' : 'arrêté'}</span><span class="side"><button class="link" name="toggle" value="${k}">${on ? 'Arrêter' : 'Activer'}</button></span></li>`; }).join('')}</ul></form>
  <h2>Rapports</h2>${reports.length ? `<ul>${reports.map((r) => `<li>${timeAgo(r.at)} — ${e(r.text)}</li>`).join('')}</ul>` : '<p class="empty">Rien pour le moment.</p>'}
  ${dead.length ? `<h2>Lettres mortes</h2><ul>${dead.map((d) => `<li>${timeAgo(d.at)} · ${e(d.queue)} · ${e(d.error ?? '')}</li>`).join('')}</ul>` : ''}
  <h2>Envoyer à Claude</h2><p class="sub">Copie ce texte et colle-le dans la conversation avec Claude si quelque chose cloche.</p>
  <textarea readonly rows="12" style="width:100%">${e(plain)}</textarea>`;
  return shell('Surveillance', body, key);
}

export async function ownerSettings(env, req, url) {
  const form = await req.formData();
  const k = form.get('toggle');
  const sw = SWITCHES.find(([key]) => key === k);
  if (sw) {
    const s = await settings(env);
    const next = sw[2] === 'kill' ? (s[k] === 'off' ? 'on' : 'off') : (s[k] === 'on' ? 'off' : 'on');
    await setSetting(env, k, next);
    await run(env, 'INSERT INTO reports (kind, at, text) VALUES (?, ?, ?)', 'switch', now(), `Interrupteur « ${sw[1]} » → ${next}`);
  }
  return Response.redirect(`${env.BASE_URL}/owner/monitor${url.search}`, 303);
}

export async function marketing(env, url) {
  const key = url.searchParams.get('key') ? `?key=${encodeURIComponent(url.searchParams.get('key'))}` : '';
  const since = Math.floor(now() / 3600e3) * 3600e3 - 7 * 864e5;
  const rows = await all(env, 'SELECT metric, dim, SUM(value) v FROM mk_stats WHERE hour >= ? GROUP BY metric, dim', since);
  const v = (metric, dim = '') => rows.find((r) => r.metric === metric && r.dim === dim)?.v ?? 0;
  const visits = v('visits');
  const steps = [['Visites', visits], ['Ouvre le formulaire', v('event', 'sheet_open')], ['Donne son email', v('leads')], ['Va au paiement', v('event', 'checkout_start')], ['Paie', v('paid')]];
  const revenue = v('revenue');
  const sources = rows.filter((r) => r.metric === 'visits' && r.dim.startsWith('src:')).sort((a, b) => b.v - a.v);
  const deleted = rows.filter((r) => r.metric === 'alert_deleted');
  const body = `<h1>Marketing — 7 derniers jours</h1>
  <p class="lede">${visits} visites, ${v('paid')} paiement(s), ${revenue.toFixed(2)} $ encaissés. Revenu par visite : <strong>${visits ? (revenue / visits).toFixed(3) : '0'} $</strong>.</p>
  <h2>Entonnoir</h2><table><thead><tr><th>Étape</th><th>Nombre</th><th>% de l'étape d'avant</th></tr></thead><tbody>${steps.map(([n, c], i) => `<tr><td>${n}</td><td>${c}</td><td>${i && steps[i - 1][1] ? `${Math.round((100 * c) / steps[i - 1][1])} %` : '—'}</td></tr>`).join('')}</tbody></table>
  <h2>D'où viennent les visites</h2><table><tbody>${sources.map((s) => `<tr><td>${e(s.dim.slice(4))}</td><td>${s.v}</td></tr>`).join('') || '<tr><td>Pas encore de données (mises à jour chaque heure).</td></tr>'}</tbody></table>
  <p class="sub">« chatgpt », « perplexity », « bing »… = trafic venu des IA et des moteurs. Mobile : ${v('visits', 'dev:ios') + v('visits', 'dev:android')} · Ordinateur : ${v('visits', 'dev:desktop')}</p>
  <h2>Pourquoi les gens suppriment une alerte</h2>${deleted.length ? `<ul>${deleted.map((d) => `<li>${e({ bought: "J'ai acheté", too_many: 'Trop d’alertes', too_slow: 'Alertes trop lentes', other: 'Autre' }[d.dim] ?? d.dim)} : ${d.v}</li>`).join('')}</ul>` : '<p class="empty">Aucune suppression.</p>'}
  <p class="sub">Réassorts vus : ${v('restocks')} · Alertes envoyées : ${v('alerts_sent')}</p>`;
  return shell('Marketing', body, key);
}

/**
 * Bake-off (§3.1): measure each source BEFORE promising anything. Runs the
 * source's first search query n times, with and without proxies, and reports
 * success rate, blocks and speed. Run it from production (real IPs, real proxies).
 */
export async function bakeoff(env, url) {
  const { SOURCES } = await import('../sources/index.js');
  const n = Math.min(20, Number(url.searchParams.get('n') ?? 5));
  const ids = url.searchParams.get('source') ? [url.searchParams.get('source')] : Object.keys(SOURCES);
  const rows = [];
  for (const id of ids) {
    const src = SOURCES[id];
    if (!src || (src.enabled && !src.enabled(env))) { rows.push({ id, note: 'désactivé (clé manquante)' }); continue; }
    for (const proxy of [false, true]) {
      if (proxy && !env.PROXY_LIST) continue;
      const e2 = { ...env, __noProxy: !proxy };
      let ok = 0; let blocked = 0; let items = 0; const ms = [];
      for (let i = 0; i < n; i++) {
        const t = Date.now();
        try { const r = src.snapshot ? await src.snapshot(e2, src.queries[0]) : await src.search(e2, src.queries[0]); ok++; items += r?.length ?? 0; }
        catch (x) { if (x.blocked) blocked++; }
        ms.push(Date.now() - t);
      }
      ms.sort((a, b) => a - b);
      rows.push({ id, proxy, ok, blocked, n, items: Math.round(items / Math.max(1, ok)), p50: ms[Math.floor(ms.length / 2)] });
    }
  }
  const key = url.searchParams.get('key') ? `?key=${encodeURIComponent(url.searchParams.get('key'))}` : '';
  return shell('Test des sources', `<h1>Test des sources (${n} essais chacune)</h1><table><thead><tr><th>Source</th><th>Proxy</th><th>Réussis</th><th>Bloqués</th><th>Produits lus</th><th>Temps médian</th></tr></thead><tbody>${rows.map((r) => r.note ? `<tr><td>${e(r.id)}</td><td colspan="5">${e(r.note)}</td></tr>` : `<tr><td>${e(r.id)}</td><td>${r.proxy ? 'oui' : 'non'}</td><td>${r.ok}/${r.n}</td><td>${r.blocked}</td><td>${r.items}</td><td>${r.p50} ms</td></tr>`).join('')}</tbody></table>
  <p class="sub">Règle : on n'augmente le budget d'une source (et on ne promet une vitesse) qu'après un test à 100 % réussi, sur plusieurs jours.</p>`, key);
}
