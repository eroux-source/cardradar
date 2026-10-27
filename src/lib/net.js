// Outbound HTTP for the crawler.
// - Browser-like headers, timeout, no compression surprises.
// - Optional proxies (secret PROXY_LIST, kill switch `budget.proxy`):
//   Workers' fetch() cannot use an HTTP proxy, so we open a TCP socket to the
//   proxy, send CONNECT, upgrade to TLS and speak HTTP/1.1 ourselves.
//   Validate with scripts/bakeoff.mjs before relying on it (playbook §3).

export const UA = 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/129.0 Safari/537.36';

export class SourceError extends Error {
  constructor(source, status, url, detail = '') {
    super(`${source} ${status} ${String(url).split('?')[0]}${detail ? ` ${detail}` : ''}`);
    this.source = source; this.status = status;
  }
  get blocked() { return [401, 403, 412, 429, 435, 503].includes(this.status); } // 435 = Target refusing datacenter IPs
}

/** "host:port:user:pass" or "http://user:pass@host:port", one per line or comma. */
export function parseProxies(list) {
  return String(list ?? '').split(/[\n,]+/).map((s) => s.trim()).filter(Boolean).map((p) => {
    if (p.includes('://')) { const u = new URL(p); return { host: u.hostname, port: Number(u.port || 80), user: decodeURIComponent(u.username), pass: decodeURIComponent(u.password) }; }
    const [host, port, user, pass] = p.split(':');
    return { host, port: Number(port), user, pass };
  });
}

let rr = 0;
// Proxies per country: PROXY_LIST_UK, PROXY_LIST_JP… (retailers geo-block foreign IPs); PROXY_LIST = US/default.
const COUNTRY_OF = (source) => (/_(uk|ca|au|jp|de|fr|nl|it|es)$/.exec(source)?.[1] ?? '');
function pickProxy(env, source = '') {
  const cc = COUNTRY_OF(source).toUpperCase();
  env.__proxies ??= {};
  const list = env.__proxies[cc] ??= parseProxies((cc && env[`PROXY_LIST_${cc}`]) || env.PROXY_LIST);
  return list.length ? list[rr++ % list.length] : null;
}

/**
 * fetch() for a retailer. Returns a standard Response. 404 → null.
 * Throws SourceError on other non-2xx statuses (blocked ones carry .blocked).
 */
export async function sourceFetch(env, source, url, { method = 'GET', headers = {}, body, useProxy = true, timeoutMs = 20000 } = {}) {
  const h = { 'user-agent': UA, 'accept-language': 'en-US,en;q=0.9', 'accept-encoding': 'identity', ...headers };
  const proxy = useProxy && !env.__noProxy && env.__settings?.['budget.proxy'] !== 'off' ? pickProxy(env, source) : null;
  const res = proxy
    ? await viaProxy(proxy, url, { method, headers: h, body, timeoutMs })
    : await fetch(url, { method, headers: h, body, signal: AbortSignal.timeout(timeoutMs) });
  if (res.status === 404) return null;
  if (!res.ok) {
    // diagnosis: who answered (proxy or site) and a hint of what it said
    let hint = ''; try { hint = (await res.text()).replace(/\s+/g, ' ').slice(0, 80); } catch {}
    throw new SourceError(source, res.status, url, `${proxy ? `via ${proxy.host}${MODE[proxy.host] ? ` (${MODE[proxy.host]})` : ''}` : 'direct'} server=${res.headers.get('server') ?? '?'}${res.headers.get('location') ? ` loc=${res.headers.get('location').slice(0, 60)}` : ''} «${hint}»`);
  }
  return res;
}

export async function sourceJson(env, source, url, opts = {}) {
  const res = await sourceFetch(env, source, url, { ...opts, headers: { accept: 'application/json', ...opts.headers } });
  return res ? res.json() : null;
}
export async function sourceText(env, source, url, opts = {}) {
  const res = await sourceFetch(env, source, url, { ...opts, headers: { accept: 'text/html,application/xhtml+xml', ...opts.headers } });
  return res ? res.text() : null;
}

/* ---------- HTTP/1.1 over CONNECT ---------- */

const enc = new TextEncoder();
const dec = new TextDecoder();

// Workers' startTls after CONNECT returns an empty stream in production (works locally).
// So we first ask the proxy to make the HTTPS request itself ("absolute-form" request over
// plain HTTP, which most residential providers accept), and fall back to CONNECT+TLS.
// Absolute-form turned out to be fetched over plain HTTP by Decodo (sites answer 301 → https),
// so we tunnel with CONNECT and upgrade with node:tls (a different code path than startTls).
const MODE = {};
async function viaProxy(proxy, url, opts) {
  MODE[proxy.host] = 'node-tls';
  return viaProxyNodeTls(proxy, url, opts);
}

async function viaProxyNodeTls(proxy, url, { method, headers, body, timeoutMs }) {
  const net = await import('node:net');
  const tls = await import('node:tls');
  const target = new URL(url);
  const port = Number(target.port || 443);
  return await new Promise((resolve, reject) => {
    const timer = setTimeout(() => { reject(new Error('proxy timeout')); try { raw.destroy(); } catch {} }, timeoutMs);
    const fail = (e) => { clearTimeout(timer); reject(e instanceof Error ? e : new Error(String(e))); };
    const raw = net.connect({ host: proxy.host, port: proxy.port });
    raw.once('error', fail);
    raw.once('connect', () => {
      const auth = proxy.user ? `Proxy-Authorization: Basic ${btoa(`${proxy.user}:${proxy.pass}`)}\r\n` : '';
      raw.write(`CONNECT ${target.hostname}:${port} HTTP/1.1\r\nHost: ${target.hostname}:${port}\r\n${auth}\r\n`);
    });
    let head = '';
    const onData = (chunk) => {
      head += Buffer.from(chunk).toString('latin1');
      const i = head.indexOf('\r\n\r\n'); if (i < 0) return;
      raw.removeListener('data', onData);
      if (!/^HTTP\/1\.[01] 200/.test(head)) return fail(new Error(`proxy CONNECT refused: ${head.split('\r\n')[0].slice(0, 80)}`));
      const sec = tls.connect({ socket: raw, servername: target.hostname });
      sec.once('error', fail);
      sec.once('secureConnect', () => {
        const payload = body ? (typeof body === 'string' ? body : Buffer.from(body)) : null;
        const lines = [`${method} ${target.pathname}${target.search} HTTP/1.1`, `Host: ${target.host}`, 'Connection: close'];
        for (const [k, v] of Object.entries(headers)) lines.push(`${k}: ${v}`);
        if (payload) lines.push(`Content-Length: ${Buffer.byteLength(payload)}`);
        sec.write(`${lines.join('\r\n')}\r\n\r\n`); if (payload) sec.write(payload);
      });
      const parts = [];
      sec.on('data', (d) => parts.push(new Uint8Array(d)));
      sec.once('end', () => {
        clearTimeout(timer);
        try { resolve(parseRaw(parts.reduce((a, b) => concat(a, b), new Uint8Array()))); } catch (e) { reject(e); }
        try { sec.destroy(); } catch {}
      });
    };
    raw.on('data', onData);
  });
}

function parseRaw(bytes) {
  const idx = indexOfCRLFCRLF(bytes);
  if (idx < 0) throw new Error(`proxy: unreadable response (${bytes.length} bytes)`);
  const [statusLine, ...hdrLines] = dec.decode(bytes.slice(0, idx)).split('\r\n');
  const status = Number(statusLine.split(' ')[1]);
  if (!(status >= 200 && status <= 599)) throw new Error(`proxy: unreadable response (head "${statusLine.slice(0, 60)}")`);
  const headers = new Headers();
  for (const l of hdrLines) { const i = l.indexOf(':'); if (i > 0) headers.append(l.slice(0, i).trim(), l.slice(i + 1).trim()); }
  let bodyBytes = bytes.slice(idx + 4);
  if (/chunked/i.test(headers.get('transfer-encoding') ?? '')) bodyBytes = dechunk(bodyBytes);
  headers.delete('transfer-encoding');
  return new Response([204, 304].includes(status) ? null : bodyBytes, { status, headers });
}

async function viaProxyAbsolute(proxy, url, { method, headers, body, timeoutMs }) {
  const { connect } = await import('cloudflare:sockets');
  const target = new URL(url);
  const socket = connect({ hostname: proxy.host, port: proxy.port }, { allowHalfOpen: false });
  const timer = setTimeout(() => socket.close(), timeoutMs);
  try {
    const w = socket.writable.getWriter();
    const payload = body ? (typeof body === 'string' ? enc.encode(body) : body) : null;
    const lines = [`${method} ${target.href} HTTP/1.1`, `Host: ${target.host}`, 'Connection: close', 'Proxy-Connection: close'];
    if (proxy.user) lines.push(`Proxy-Authorization: Basic ${btoa(`${proxy.user}:${proxy.pass}`)}`);
    for (const [k, v] of Object.entries(headers)) lines.push(`${k}: ${v}`);
    if (payload) lines.push(`Content-Length: ${payload.byteLength}`);
    await w.write(enc.encode(`${lines.join('\r\n')}\r\n\r\n`));
    if (payload) await w.write(payload);
    w.releaseLock();
    return await readResponse(socket.readable.getReader());
  } finally {
    clearTimeout(timer);
    socket.close().catch(() => {});
  }
}

async function viaProxyConnect(proxy, url, { method, headers, body, timeoutMs }) {
  const { connect } = await import('cloudflare:sockets');
  const target = new URL(url);
  const port = Number(target.port || 443);
  const socket = connect({ hostname: proxy.host, port: proxy.port }, { secureTransport: 'starttls', allowHalfOpen: false });
  const timer = setTimeout(() => socket.close(), timeoutMs);
  try {
    let w = socket.writable.getWriter();
    const auth = proxy.user ? `Proxy-Authorization: Basic ${btoa(`${proxy.user}:${proxy.pass}`)}\r\n` : '';
    await w.write(enc.encode(`CONNECT ${target.hostname}:${port} HTTP/1.1\r\nHost: ${target.hostname}:${port}\r\n${auth}\r\n`));
    w.releaseLock();
    const reader = socket.readable.getReader();
    const head = await readHead(reader);
    reader.releaseLock();
    if (!/^HTTP\/1\.[01] 200/.test(head.text)) throw new Error(`proxy CONNECT refused: ${head.text.split('\r\n')[0].slice(0, 80) || 'no answer'}`);

    const tls = socket.startTls({ expectedServerHostname: target.hostname });
    w = tls.writable.getWriter();
    const payload = body ? (typeof body === 'string' ? enc.encode(body) : body) : null;
    const lines = [`${method} ${target.pathname}${target.search} HTTP/1.1`, `Host: ${target.host}`, 'Connection: close'];
    for (const [k, v] of Object.entries(headers)) lines.push(`${k}: ${v}`);
    if (payload) lines.push(`Content-Length: ${payload.byteLength}`);
    await w.write(enc.encode(`${lines.join('\r\n')}\r\n\r\n`));
    if (payload) await w.write(payload);
    w.releaseLock();
    return await readResponse(tls.readable.getReader());
  } finally {
    clearTimeout(timer);
    socket.close().catch(() => {});
  }
}

async function readHead(reader, carry = new Uint8Array()) {
  let buf = carry;
  for (;;) {
    const idx = indexOfCRLFCRLF(buf);
    if (idx >= 0) return { text: dec.decode(buf.slice(0, idx)), rest: buf.slice(idx + 4) };
    const { value, done } = await reader.read();
    if (done) return { text: dec.decode(buf), rest: new Uint8Array() };
    buf = concat(buf, value);
  }
}

async function readResponse(reader) {
  const head = await readHead(reader);
  const [statusLine, ...hdrLines] = head.text.split('\r\n');
  const status = Number(statusLine.split(' ')[1]);
  if (!(status >= 200 && status <= 599)) throw new Error(`proxy: unreadable response (head "${statusLine.slice(0, 60)}", ${head.text.length} chars, ${head.rest.length} body bytes)`);
  const headers = new Headers();
  for (const l of hdrLines) { const i = l.indexOf(':'); if (i > 0) headers.append(l.slice(0, i).trim(), l.slice(i + 1).trim()); }
  let bodyBytes = head.rest;
  for (;;) { const { value, done } = await reader.read(); if (done) break; bodyBytes = concat(bodyBytes, value); }
  if (/chunked/i.test(headers.get('transfer-encoding') ?? '')) bodyBytes = dechunk(bodyBytes);
  headers.delete('transfer-encoding');
  return new Response([204, 304].includes(status) ? null : bodyBytes, { status, headers });
}

export function dechunk(bytes) {
  const out = [];
  let i = 0;
  while (i < bytes.length) {
    let j = i;
    while (j < bytes.length - 1 && !(bytes[j] === 13 && bytes[j + 1] === 10)) j++;
    const size = parseInt(dec.decode(bytes.slice(i, j)).split(';')[0], 16);
    if (!size) break;
    out.push(bytes.slice(j + 2, j + 2 + size));
    i = j + 2 + size + 2;
  }
  return out.reduce((a, b) => concat(a, b), new Uint8Array());
}

function indexOfCRLFCRLF(b) {
  for (let i = 0; i + 3 < b.length; i++) if (b[i] === 13 && b[i + 1] === 10 && b[i + 2] === 13 && b[i + 3] === 10) return i;
  return -1;
}
function concat(a, b) { const c = new Uint8Array(a.length + b.length); c.set(a); c.set(b, a.length); return c; }

/* ---------- page parsing helpers ---------- */

export function nextData(html) {
  const m = html?.match(/<script id="__NEXT_DATA__"[^>]*>([\s\S]*?)<\/script>/);
  if (!m) return null;
  try { return JSON.parse(m[1]); } catch { return null; }
}

export function jsonLdProducts(html) {
  const out = [];
  for (const m of html?.matchAll(/<script[^>]*type="application\/ld\+json"[^>]*>([\s\S]*?)<\/script>/g) ?? []) {
    try {
      const data = JSON.parse(m[1]);
      for (const node of [data, ...(Array.isArray(data) ? data : []), ...(data['@graph'] ?? [])].flat()) if (node?.['@type'] === 'Product') out.push(node);
    } catch { /* ignore */ }
  }
  return out;
}

export function offerAvailability(product) {
  const offers = Array.isArray(product?.offers) ? product.offers : [product?.offers].filter(Boolean);
  const a = offers.map((o) => String(o.availability ?? '')).join(' ');
  if (/InStock|LimitedAvailability|OnlineOnly/i.test(a)) return 'in';
  if (/OutOfStock|SoldOut|Discontinued/i.test(a)) return 'out';
  return null;
}
