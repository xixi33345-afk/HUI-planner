// Cloudflare Pages Functions —— 健康打卡云同步后端
// 路由：/api/ping  /api/signup  /api/login  /api/data
// 存储：KV 命名空间，需在 Pages 设置里绑定为变量名 DB
// 账号：邮箱 + 密码（密码加盐 SHA-256 存储），登录返回 HMAC 签名 token（30 天有效）

export async function onRequest(context) {
  const { request, env, params } = context;
  const route = '/' + ((params.path || []).join('/'));
  const method = request.method;
  const json = (obj, status = 200) =>
    new Response(JSON.stringify(obj), {
      status,
      headers: { 'content-type': 'application/json; charset=utf-8', 'cache-control': 'no-store' }
    });

  if (!env.DB) {
    return json({ error: '后端存储未绑定：请在 Cloudflare Pages 设置里把 KV 命名空间绑定为 DB' }, 500);
  }

  try {
    if (route === '/ping') return json({ ok: true });

    if (route === '/signup' && method === 'POST') {
      const { email, password } = await request.json();
      const e = normEmail(email);
      if (!validEmail(e)) return json({ error: '邮箱格式不正确' }, 400);
      if (!password || String(password).length < 6) return json({ error: '密码至少 6 位' }, 400);
      if (await env.DB.get('user:' + e)) return json({ error: '该邮箱已注册，请直接登录' }, 409);
      const salt = crypto.randomUUID();
      const hash = await sha256(salt + ':' + password);
      await env.DB.put('user:' + e, JSON.stringify({ salt, hash, created: Date.now() }));
      return json({ token: await makeToken(e, env), email: e });
    }

    if (route === '/login' && method === 'POST') {
      const { email, password } = await request.json();
      const e = normEmail(email);
      const rec = await env.DB.get('user:' + e, 'json');
      if (!rec) return json({ error: '账号不存在，请先注册' }, 404);
      const hash = await sha256(rec.salt + ':' + password);
      if (hash !== rec.hash) return json({ error: '密码错误' }, 401);
      return json({ token: await makeToken(e, env), email: e });
    }

    if (route === '/data') {
      const email = await auth(request, env);
      if (!email) return json({ error: '未登录或登录已过期' }, 401);
      if (method === 'GET') {
        const data = await env.DB.get('data:' + email);
        return json({ data: data ? JSON.parse(data) : null });
      }
      if (method === 'PUT') {
        const body = await request.json();
        await env.DB.put('data:' + email, JSON.stringify(body.data ?? {}));
        return json({ ok: true });
      }
    }

    return json({ error: 'not found' }, 404);
  } catch (err) {
    return json({ error: String((err && err.message) || err) }, 500);
  }
}

function normEmail(s) { return String(s || '').trim().toLowerCase(); }
function validEmail(s) { return /^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(s); }

async function sha256(str) {
  const b = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(str));
  return [...new Uint8Array(b)].map(x => x.toString(16).padStart(2, '0')).join('');
}
function b64url(buf) {
  let s = btoa(String.fromCharCode(...new Uint8Array(buf)));
  return s.replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
}
function b64urlStr(str) { return b64url(new TextEncoder().encode(str)); }
function b64urlDecode(str) {
  const s = str.replace(/-/g, '+').replace(/_/g, '/');
  return new TextDecoder().decode(Uint8Array.from(atob(s), c => c.charCodeAt(0)));
}

async function getSecret(env) {
  if (env.AUTH_SECRET) return env.AUTH_SECRET;
  let s = await env.DB.get('__secret');
  if (!s) { s = crypto.randomUUID() + crypto.randomUUID(); await env.DB.put('__secret', s); }
  return s;
}
async function hmac(msg, secret) {
  const key = await crypto.subtle.importKey(
    'raw', new TextEncoder().encode(secret), { name: 'HMAC', hash: 'SHA-256' }, false, ['sign']
  );
  const sig = await crypto.subtle.sign('HMAC', key, new TextEncoder().encode(msg));
  return b64url(sig);
}
async function makeToken(email, env) {
  const secret = await getSecret(env);
  const payload = b64urlStr(JSON.stringify({ e: email, x: Date.now() + 1000 * 60 * 60 * 24 * 30 }));
  return payload + '.' + (await hmac(payload, secret));
}
async function auth(request, env) {
  const h = request.headers.get('Authorization') || '';
  const tok = h.startsWith('Bearer ') ? h.slice(7) : '';
  if (!tok || !tok.includes('.')) return null;
  const [payload, sig] = tok.split('.');
  const secret = await getSecret(env);
  if (sig !== (await hmac(payload, secret))) return null;
  try {
    const obj = JSON.parse(b64urlDecode(payload));
    if (!obj.x || Date.now() > obj.x) return null;
    return obj.e;
  } catch { return null; }
}
