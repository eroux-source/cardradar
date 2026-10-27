// /owner/lottery: add or close Japanese lotteries by hand (in French for Eugène).
// Used until Japanese proxies let the crawler read the shops itself.
import { all, run, now } from '../lib/db.js';
import { escapeHtml as e } from '../lib/util.js';
import { JP_SHOPS } from '../web/pages/lottery.js';
import { upsertLotteries } from '../crawler/lotteries.js';

// "2026-11-02T20:00" typed in Japan time → epoch ms
const jst = (v) => (v ? Date.parse(`${v}:00+09:00`) || null : null);
const fmt = (ms) => (ms ? new Date(ms + 9 * 3600e3).toISOString().slice(0, 16).replace('T', ' ') : '');

export async function ownerLottery(env, req, url) {
  const key = url.searchParams.get('key') ? `?key=${encodeURIComponent(url.searchParams.get('key'))}` : '';
  let msg = '';
  if (req.method === 'POST') {
    const f = await req.formData();
    if (f.get('close')) {
      await run(env, 'UPDATE lotteries SET closes_at = ? WHERE id = ?', now() - 1, Number(f.get('close')));
      msg = 'Tirage fermé.';
    } else {
      const title = String(f.get('title') ?? '').trim(); const source = String(f.get('source') ?? 'other');
      if (!title) msg = 'Il manque le titre.';
      else {
        await upsertLotteries(env, { id: source }, [{
          uid: String(f.get('url') || `${title}|${f.get('opens')}`), title, kind: String(f.get('kind') ?? 'lottery'),
          url: String(f.get('url') ?? '') || null, method: 'web',
          conditions: String(f.get('conditions') ?? '').split(/[,、\n]/).map((x) => x.trim()).filter(Boolean),
          opensAt: jst(f.get('opens')), closesAt: jst(f.get('closes')), resultsAt: jst(f.get('results')),
        }]);
        msg = 'Ajouté. Les abonnés sont prévenus dans la minute.';
      }
    }
  }
  const list = await all(env, 'SELECT * FROM lotteries ORDER BY COALESCE(closes_at, 9e15) DESC LIMIT 40');
  const opts = Object.entries(JP_SHOPS).map(([id, n]) => `<option value="${id}">${e(n)}</option>`).join('');
  const body = `<h1>Tirages au sort Japon</h1>
  <p>Ajoute ici un tirage (抽選), une précommande (予約) ou une remise en vente (再販) vu sur un site japonais. Heures en heure de Tokyo.</p>
  ${msg ? `<p class="note"><strong>${e(msg)}</strong></p>` : ''}
  <form method="post" class="owner-form">
    <label>Boutique <select name="source">${opts}</select></label>
    <label>Type <select name="kind"><option value="lottery">抽選 tirage</option><option value="preorder">予約 précommande</option><option value="resale">再販 remise en vente</option></select></label>
    <label>Titre (en japonais, avec le nom de l'extension) <input name="title" required placeholder="拡張パック「ハドウシーカー」BOX 抽選販売"></label>
    <label>Lien pour participer <input name="url" type="url"></label>
    <label>Ouverture <input name="opens" type="datetime-local"></label>
    <label>Clôture <input name="closes" type="datetime-local"></label>
    <label>Résultats <input name="results" type="datetime-local"></label>
    <label>Conditions (séparées par des virgules) <input name="conditions" placeholder="会員限定, 1人1BOX"></label>
    <button class="btn">Ajouter</button>
  </form>
  <h2>Derniers tirages</h2>
  <table><tr><th>Boutique</th><th>Titre</th><th>Ouverture</th><th>Clôture</th><th></th></tr>
  ${list.map((l) => `<tr><td>${e(JP_SHOPS[l.source] ?? l.source)}</td><td>${e(l.title)}</td><td>${fmt(l.opens_at)}</td><td>${fmt(l.closes_at)}</td>
    <td>${!l.closes_at || l.closes_at > now() ? `<form method="post"><button name="close" value="${l.id}">Fermer</button></form>` : ''}</td></tr>`).join('')}</table>`;
  return new Response(`<!doctype html><html lang="fr"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><meta name="robots" content="noindex">
<title>Tirages Japon</title><link rel="stylesheet" href="/site.css"></head><body class="owner"><main class="wrap">
<p class="crumbs"><a href="/owner/monitor${key}">Surveillance</a> · <a href="/owner/lottery${key}">Tirages Japon</a> · <a href="/jp">Page Japon</a></p>${body}</main></body></html>`,
  { headers: { 'content-type': 'text/html; charset=utf-8', 'cache-control': 'no-store' } });
}
