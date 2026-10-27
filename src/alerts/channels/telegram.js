// Telegram: the person opens t.me/<bot>?start=<token> from their account page;
// our webhook receives "/start <token>" and stores their chat id.
export async function sendTelegram(env, chatId, msg) {
  if (!env.TELEGRAM_BOT_TOKEN) return false;
  const res = await fetch(`https://api.telegram.org/bot${env.TELEGRAM_BOT_TOKEN}/sendMessage`, {
    method: 'POST', headers: { 'content-type': 'application/json' },
    body: JSON.stringify({
      chat_id: chatId, disable_web_page_preview: true,
      text: `${msg.line}\n\nBuy or reserve: ${msg.url}\nLive stock: ${msg.page}`,
    }),
  });
  return res.ok;
}

/** Webhook handler: links a chat to a user, answers test messages. */
export async function telegramWebhook(env, request) {
  if (request.headers.get('x-telegram-bot-api-secret-token') !== env.TELEGRAM_WEBHOOK_SECRET) return new Response('no', { status: 403 });
  const update = await request.json();
  const m = update.message;
  const token = m?.text?.match(/^\/start\s+(\S+)/)?.[1];
  if (token && m.chat?.id) {
    const u = await env.DB.prepare('SELECT id FROM users WHERE telegram_link_token = ?').bind(token).first();
    if (u) {
      await env.DB.prepare('UPDATE users SET telegram_chat_id = ?, telegram_link_token = NULL WHERE id = ?').bind(String(m.chat.id), u.id).run();
      await sendTelegram(env, m.chat.id, { line: 'Telegram is connected. You will get restock alerts here.', url: env.BASE_URL, page: `${env.BASE_URL}/account` });
    }
  }
  return new Response('ok');
}
