// Japan: store lotteries (抽選), pre-orders (予約) and re-sales (再販).
// Sources return items { uid, kind, title, product, method, conditions[], url, price, opensAt, closesAt, resultsAt }.
// New open lotteries are announced to matching alerts at once; a reminder goes 3 h before closing.
import { all, one, run, now } from '../lib/db.js';
import { jpSetOf } from '../data/sets_jp.js';
import { notifyUser } from '../alerts/notify.js';
import { t as tr } from '../i18n/index.js';

export async function upsertLotteries(env, src, items) {
  const t = now(); const fresh = [];
  for (const x of items) {
    if (!x?.uid || !x?.title) continue;
    const set = jpSetOf(`${x.title} ${x.product ?? ''}`);
    const res = await run(env, `INSERT INTO lotteries (country, source, uid, kind, title, product, set_name, set_slug, method, conditions, url, price, opens_at, closes_at, results_at, first_seen, last_seen)
      VALUES ('jp', ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
      ON CONFLICT(source, uid) DO UPDATE SET title = excluded.title, product = COALESCE(excluded.product, lotteries.product), url = COALESCE(excluded.url, lotteries.url),
        opens_at = COALESCE(excluded.opens_at, lotteries.opens_at), closes_at = COALESCE(excluded.closes_at, lotteries.closes_at),
        results_at = COALESCE(excluded.results_at, lotteries.results_at), conditions = COALESCE(excluded.conditions, lotteries.conditions), last_seen = excluded.last_seen`,
      src.id, x.uid, x.kind ?? 'lottery', x.title, x.product ?? null, set?.name ?? null, set?.slug ?? null, x.method ?? 'web',
      x.conditions?.length ? JSON.stringify(x.conditions) : null, x.url ?? null, x.price ?? null, x.opensAt ?? null, x.closesAt ?? null, x.resultsAt ?? null, t, t);
    if (res.meta.changes && res.meta.last_row_id && (await one(env, 'SELECT first_seen FROM lotteries WHERE id = ?', res.meta.last_row_id))?.first_seen === t) fresh.push(res.meta.last_row_id);
  }
  await announce(env);
  return fresh;
}

const shopName = (src) => src;

/** Open-now and closing-soon notices, deduped per alert × lottery × moment. */
export async function announce(env) {
  const t = now(); const T = tr('jp');
  const due = await all(env, `SELECT * FROM lotteries WHERE country = 'jp' AND (closes_at IS NULL OR closes_at > ?) AND (opens_at IS NULL OR opens_at <= ?)
    AND (notified_open IS NULL OR (notified_close IS NULL AND closes_at IS NOT NULL AND closes_at - ? < 3 * 3600000)) LIMIT 50`, t, t, t);
  for (const l of due) {
    const moment = l.notified_open ? 'close' : 'open';
    const alerts = await all(env, `SELECT a.id AS alert_id, a.channels, u.* FROM alerts a JOIN users u ON u.id = a.user_id
      JOIN passes p ON p.user_id = a.user_id AND p.status IN ('active','refunded_kept') AND p.ends_at > ?
      WHERE a.status = 'active' AND a.kind = 'lottery' AND a.country = 'jp' AND (a.set_slug IS NULL OR a.set_slug = ?)`, t, l.set_slug ?? '');
    const when = l.closes_at ? T.lot.until(T.f.date(l.closes_at)) : '';
    const msg = { title: `${moment === 'open' ? '【受付開始】' : '【締切間近】'}${l.title}`, line: `${moment === 'open' ? '受付開始' : 'まもなく締切'}：${l.title}${when ? `（${when}）` : ''}`, url: l.url, page: `${env.BASE_URL}/jp` };
    for (const a of alerts) {
      const claim = await run(env, 'INSERT OR IGNORE INTO lottery_sent (alert_id, lottery_id, moment, at) VALUES (?, ?, ?, ?)', a.alert_id, l.id, moment, t);
      if (!claim.meta.changes) continue;
      const ok = await notifyUser(env, a, JSON.parse(a.channels || '["email"]'), msg).catch(() => []);
      await run(env, 'UPDATE lottery_sent SET channels_ok = ? WHERE alert_id = ? AND lottery_id = ? AND moment = ?', ok.join(','), a.alert_id, l.id, moment);
    }
    await run(env, `UPDATE lotteries SET ${moment === 'open' ? 'notified_open' : 'notified_close'} = ? WHERE id = ?`, t, l.id);
  }
}
