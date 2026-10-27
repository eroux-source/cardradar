// Relay: makes HTTPS requests through the residential proxy on behalf of the Worker.
// Workers cannot tunnel TLS through an HTTP proxy (CONNECT + startTls returns empty
// streams in production), Node can. The Worker calls POST /fetch with the request and
// the proxy URL; we answer with the retailer's status, headers (x-relay-headers) and body.
import http from 'node:http';
import { ProxyAgent, request } from 'undici';

const agents = new Map();
const agentFor = (proxy) => {
  if (!agents.has(proxy)) agents.set(proxy, new ProxyAgent({ uri: proxy, connectTimeout: 15000 }));
  return agents.get(proxy);
};

http.createServer(async (req, res) => {
  if (req.method === 'GET' && req.url === '/health') { res.end('ok'); return; }
  if (req.method !== 'POST' || req.url !== '/fetch') { res.statusCode = 404; res.end(); return; }
  const chunks = []; for await (const c of req) chunks.push(c);
  try {
    const { url, method = 'GET', headers = {}, body, proxy, timeoutMs = 20000 } = JSON.parse(Buffer.concat(chunks).toString());
    const r = await request(url, {
      method, headers, body: body ?? undefined, dispatcher: proxy ? agentFor(proxy) : undefined,
      headersTimeout: timeoutMs, bodyTimeout: timeoutMs, maxRedirections: 0,
    });
    const buf = Buffer.from(await r.body.arrayBuffer());
    const h = {}; for (const [k, v] of Object.entries(r.headers)) if (!['transfer-encoding', 'content-encoding', 'content-length', 'connection'].includes(k)) h[k] = Array.isArray(v) ? v.join(', ') : v;
    res.writeHead(200, { 'x-relay-status': String(r.statusCode), 'x-relay-headers': encodeURIComponent(JSON.stringify(h)), 'content-type': 'application/octet-stream' });
    res.end(buf);
  } catch (e) {
    res.writeHead(502, { 'content-type': 'text/plain' });
    res.end(`relay: ${String(e?.code ?? '')} ${String(e?.message ?? e).slice(0, 200)}`);
  }
}).listen(8080, () => console.log('relay on 8080'));
