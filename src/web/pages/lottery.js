// Japan: the lottery / pre-order / re-sale calendar (抽選・予約・再販).
//   /jp                 calendar: open now (closing soonest first), upcoming, recently closed
//   /jp/set/{slug}      one Japanese set
//   /jp/shop/{id}       one shop
// Lotteries come from shop pages (once Japanese proxies are set) and from the owner form.
import { escapeHtml as e } from '../../lib/util.js';
import { JP_SETS, jpSetBySlug } from '../../data/sets_jp.js';
import { t } from '../../i18n/index.js';
import * as d from '../data.js';
import { now } from '../../lib/db.js';
import { page, alertCta, answers } from '../html.js';
import { factsBlock } from '../facts.js';

export const JP_SHOPS = {
  pcojp: 'ポケモンセンターオンライン', amazonjp: 'Amazon', rakutenbooks: '楽天ブックス', yodobashi: 'ヨドバシ', joshin: 'ジョーシン', bic: 'ビックカメラ',
  yamada: 'ヤマダデンキ', aeon: 'イオン', edion: 'エディオン', sevennet: 'セブンネット', hmv: 'ローソン/HMV', yokado: 'イトーヨーカドー', geo: 'ゲオ',
  toysrus: 'トイザらス', tsutaya: 'TSUTAYA', other: 'その他',
};
const shopName = (id) => JP_SHOPS[id] ?? id;

function state(l, ts) {
  if (l.opens_at && l.opens_at > ts) return 'soon';
  if (l.closes_at && l.closes_at < ts) return 'closed';
  return 'open';
}
function left(T, ms) {
  const h = Math.floor(ms / 3600e3); const m = Math.floor((ms % 3600e3) / 60e3);
  return h >= 48 ? `${Math.floor(h / 24)}日` : h ? `${h}時間${m}分` : `${m}分`;
}

function rows(T, list, ts) {
  if (!list.length) return `<p class="empty">${e(T.lot.none)}</p>`;
  return `<ul class="lots">${list.map((l) => {
    const st = state(l, ts);
    const conds = l.conditions ? JSON.parse(l.conditions) : [];
    return `<li class="lot ${st}">
      <div class="lot-when">${st === 'soon' ? `<span class="chip unknown">${e(T.lot.soon)}</span><span>${e(T.lot.from(T.f.date(l.opens_at)))}</span>` : st === 'closed' ? `<span class="chip out">${e(T.lot.closed)}</span>` : `<span class="chip in">${e(T.lot.open)}</span>${l.closes_at ? `<span><strong>${e(T.lot.left(left(T, l.closes_at - ts)))}</strong><br>${e(T.lot.until(T.f.date(l.closes_at)))}</span>` : ''}`}</div>
      <div class="lot-main"><a class="lot-shop" href="/jp/shop/${e(l.source)}">${e(shopName(l.source))}</a>
        <strong class="lot-title">${e(l.title)}</strong>
        ${conds.length ? `<span class="lot-conds">${conds.map((c) => `<span>${e(c)}</span>`).join('')}</span>` : ''}
        ${l.results_at ? `<span class="fine">${e(T.lot.results)}：${e(T.f.date(l.results_at))}</span>` : ''}</div>
      <div class="lot-go">${l.url && st !== 'closed' ? `<a class="btn small" href="${e(l.url)}" rel="nofollow noopener">${e(T.lot.apply)}</a>` : ''}</div></li>`;
  }).join('')}</ul>`;
}

async function calendar(env, { where = '1=1', args = [], title, h1, path, desc, faqs = [] }) {
  const T = t('jp'); const ts = now();
  const list = await d.lotteries(env, where, args);
  const open = list.filter((l) => state(l, ts) === 'open'); const soon = list.filter((l) => state(l, ts) === 'soon'); const closed = list.filter((l) => state(l, ts) === 'closed');
  const shops = new Set(open.map((l) => l.source)).size;
  const a = faqs.length ? answers(faqs, 'よくある質問') : null;
  const body = `<div class="answer"><h1>${e(h1)}</h1><p class="lede">${open.length ? T.lot.lede(open.length, shops) : e(T.lot.none)}</p><p class="asof">${e(T.asOf(T.f.when(ts)))}</p></div>
  ${alertCta(env, T)}
  <section><h2>${e(T.lot.openH)}</h2>${rows(T, open, ts)}</section>
  ${soon.length ? `<section><h2>${e(T.lot.soonH)}</h2>${rows(T, soon, ts)}</section>` : ''}
  ${closed.length ? `<section><h2>${e(T.lot.closedH)}</h2>${rows(T, closed.slice(0, 20), ts)}</section>` : ''}
  <section><h2>${e(T.lot.bySetH)}</h2><ul class="cities">${JP_SETS.map((s) => `<li><a href="/jp/set/${s.slug}"><strong>${e(s.name)}</strong><span>${e(s.type)}・${e(s.release)}</span></a></li>`).join('')}</ul></section>
  <section id="shops"><h2>${e(T.lot.byShopH)}</h2><ul class="cities">${Object.entries(JP_SHOPS).filter(([id]) => id !== 'other').map(([id, n]) => `<li><a href="/jp/shop/${id}"><strong>${e(n)}</strong><span>ポケカ抽選</span></a></li>`).join('')}</ul></section>
  ${a ? a.html : ''}
  ${await factsBlock(env, T)}`;
  const ld = { '@context': 'https://schema.org', '@type': 'ItemList', itemListElement: open.slice(0, 30).map((l, i) => ({ '@type': 'ListItem', position: i + 1, name: `${shopName(l.source)} ${l.title}`, url: l.url })) };
  return page(env, T, { title, description: desc, path, body, jsonLd: [ld, ...(a ? [a.ld] : [])], noindex: !list.length });
}

export const jpHome = (env) => {
  const T = t('jp');
  return calendar(env, { title: T.home.title(env.BRAND_NAME), h1: T.lot.h1, path: '/jp', desc: T.home.desc(),
    faqs: [
      { q: 'ポケカの抽選はどこで応募できますか？', a: 'ポケモンセンターオンライン、楽天ブックス、ヨドバシ、ジョーシン、イオンなどが新弾ごとに抽選を行います。このページで受付中の抽選を締切順に確認できます。' },
      { q: '抽選の受付期間はどれくらいですか？', a: '多くは2〜5日間で、発売の1〜4週間前に始まります。締切は16:59、20:00、23:59が多いため、締切前の通知が役立ちます。' },
      { q: '再販の情報はいつ出ますか？', a: '再販も抽選や予約で行われることが多く、事前告知は短期間です。受付開始を検知しだい通知します。' },
    ] });
};
export const jpSet = (env, slug) => {
  const s = jpSetBySlug(slug); if (!s) return null; const T = t('jp');
  return calendar(env, { where: 'set_slug = ?', args: [slug], title: T.lot.setTitle(s.name), h1: T.lot.setH1(s.name), path: `/jp/set/${slug}`, desc: `${s.name}（${s.type}、${s.release}発売）の抽選・予約・再販情報をショップ別にまとめています。締切前に通知。` });
};
export const jpShop = (env, id) => {
  if (!JP_SHOPS[id]) return null; const T = t('jp');
  return calendar(env, { where: 'source = ?', args: [id], title: T.lot.shopTitle(JP_SHOPS[id]), h1: T.lot.shopH1(JP_SHOPS[id]), path: `/jp/shop/${id}`, desc: `${JP_SHOPS[id]}のポケモンカード抽選・予約・再販情報。受付期間、応募条件、締切前の通知。` });
};
