// LINE (Japan's default messenger). Official Account + Messaging API.
// Linking: the account page shows a 6-character code; the person adds the bot
// as a friend and sends the code; the webhook stores their LINE user id.
// Cost note (LINE pricing): pushes count against the monthly quota, replies are
// free — so alerts are LINE only for paying users, and digests stay short.
const enc = new TextEncoder();

async function validSignature(env, raw, sig) {
  if (!env.LINE_CHANNEL_SECRET || !sig) return false;
  const key = await crypto.subtle.importKey('raw', enc.encode(env.LINE_CHANNEL_SECRET), { name: 'HMAC', hash: 'SHA-256' }, false, ['sign']);
  const mac = btoa(String.fromCharCode(...new Uint8Array(await crypto.subtle.sign('HMAC', key, enc.encode(raw)))));
  return mac === sig;
}

async function call(env, path, body) {
  return fetch(`https://api.line.me/v2/bot/${path}`, { method: 'POST', headers: { authorization: `Bearer ${env.LINE_CHANNEL_TOKEN}`, 'content-type': 'application/json' }, body: JSON.stringify(body) });
}

export async function sendLine(env, userId, msg) {
  if (!env.LINE_CHANNEL_TOKEN || !userId) return false;
  const res = await call(env, 'message/push', { to: userId, messages: [{ type: 'text', text: `${msg.line}\n\n${msg.url ?? msg.page}` }] });
  return res.ok;
}

/** POST /api/line/webhook */
export async function lineWebhook(env, request) {
  const raw = await request.text();
  if (!(await validSignature(env, raw, request.headers.get('x-line-signature')))) return new Response('no', { status: 403 });
  for (const ev of JSON.parse(raw).events ?? []) {
    const code = ev.type === 'message' && ev.message?.type === 'text' ? ev.message.text.trim().toUpperCase() : null;
    const reply = (text) => ev.replyToken && call(env, 'message/reply', { replyToken: ev.replyToken, messages: [{ type: 'text', text }] });
    if (ev.type === 'follow') { await reply('友だち追加ありがとうございます！アカウントページに表示されている6文字のコードを送ってください。'); continue; }
    if (!code || !/^[A-Z0-9]{6}$/.test(code)) continue;
    const u = await env.DB.prepare('SELECT id FROM users WHERE line_link_token = ?').bind(code).first();
    if (u) {
      await env.DB.prepare('UPDATE users SET line_user_id = ?, line_link_token = NULL WHERE id = ?').bind(ev.source?.userId, u.id).run();
      await reply('LINE連携が完了しました。抽選の受付開始と締切前にここでお知らせします。');
    } else await reply('コードが見つかりません。アカウントページで新しいコードを表示してください。');
  }
  return new Response('ok');
}
