// Tiny D1 helpers. Every query goes through here so they stay short and safe.
// Rule from the playbook: never run heavy ad-hoc SQL on production; owner pages
// read pre-aggregated tables (mk_stats), never raw rows.

export const now = () => Date.now();

export const one = (env, sql, ...args) => env.DB.prepare(sql).bind(...args).first();
export const all = async (env, sql, ...args) => (await env.DB.prepare(sql).bind(...args).all()).results ?? [];
export const run = (env, sql, ...args) => env.DB.prepare(sql).bind(...args).run();
export const stmt = (env, sql, ...args) => env.DB.prepare(sql).bind(...args);
export const batch = (env, statements) => (statements.length ? env.DB.batch(statements) : []);

/** Live settings / kill switches, cached for the lifetime of the request. */
export async function settings(env) {
  if (!env.__settings) {
    const rows = await all(env, 'SELECT key, value FROM settings');
    env.__settings = Object.fromEntries(rows.map((r) => [r.key, r.value]));
  }
  return env.__settings;
}
export const isOn = async (env, key) => (await settings(env))[key] !== 'off';   // kill switches: on unless 'off'
export const isFlagOn = async (env, key) => (await settings(env))[key] === 'on'; // opt-in flags: off unless 'on'
export const numSetting = async (env, key, fallback) => Number((await settings(env))[key] ?? fallback);

export async function setSetting(env, key, value) {
  await run(env, 'INSERT INTO settings (key, value, updated_at) VALUES (?, ?, ?) ON CONFLICT(key) DO UPDATE SET value = excluded.value, updated_at = excluded.updated_at', key, String(value), now());
  delete env.__settings;
}

export async function report(env, kind, text) {
  await run(env, 'INSERT INTO reports (kind, at, text) VALUES (?, ?, ?)', kind, now(), text);
}
