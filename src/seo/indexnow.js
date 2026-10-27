// IndexNow (§7): tell Bing (and the engines that share IndexNow) the moment a
// page changes for real, i.e. a restock or a new product. That is what got
// InStock Radar cited by ChatGPT within a day: ChatGPT search reads Bing.
// The key file is served at /<INDEXNOW_KEY>.txt by the router.
import { one, run, now } from '../lib/db.js';

export async function pingIndexNow(env, paths) {
  if (!env.INDEXNOW_KEY || !paths?.length || !env.BASE_URL?.startsWith('https')) return;
  // one ping per path per 10 minutes is plenty
  const t = now();
  const fresh = [];
  for (const p of [...new Set(paths)].slice(0, 100)) {
    const k = `indexnow:${p}`;
    const last = await one(env, 'SELECT value FROM settings WHERE key = ?', k);
    if (last && t - Number(last.value) < 10 * 60e3) continue;
    await run(env, 'INSERT INTO settings (key, value, updated_at) VALUES (?, ?, ?) ON CONFLICT(key) DO UPDATE SET value = excluded.value, updated_at = excluded.updated_at', k, String(t), t);
    fresh.push(`${env.BASE_URL}${p}`);
  }
  if (!fresh.length) return;
  const host = new URL(env.BASE_URL).host;
  try {
    await fetch('https://api.indexnow.org/indexnow', {
      method: 'POST', headers: { 'content-type': 'application/json; charset=utf-8' },
      body: JSON.stringify({ host, key: env.INDEXNOW_KEY, keyLocation: `${env.BASE_URL}/${env.INDEXNOW_KEY}.txt`, urlList: fresh }),
    });
  } catch { /* best effort */ }
}
