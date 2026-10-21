import { test } from 'node:test';
import assert from 'node:assert/strict';
import handler from '../api/index.js';

async function request(path, { method = 'GET', body, cookie, origin } = {}) {
  const headers = { host: 'localhost:5173', ...(body ? { 'content-type': 'application/json' } : {}), ...(cookie ? { cookie } : {}), ...(origin ? { origin } : {}) };
  const result = { headers: {}, statusCode: 200 };
  const res = { setHeader(key, value) { result.headers[key.toLowerCase()] = value; }, set statusCode(value) { result.statusCode = value; }, end(value) { result.body = JSON.parse(value); } };
  await handler({ url: `/api/${path}`, method, headers, body }, res);
  return result;
}

test('API protege os dados, autentica, rejeita sessão adulterada e encerra sessão', async () => {
  process.env.SESSION_SECRET = 'test-session-secret-with-more-than-32-characters';
  process.env.ADMIN_USERNAME = 'admin';
  process.env.ADMIN_PASSWORD = 'admin123';
  assert.equal((await request('data')).statusCode, 401);
  assert.equal((await request('students', { method: 'POST', body: { name: 'Ana', grade: 1 } })).statusCode, 401);
  assert.equal((await request('login', { method: 'POST', body: { username: 'admin', password: 'errada' } })).statusCode, 401);
  const login = await request('login', { method: 'POST', body: { username: 'admin', password: 'admin123' } });
  assert.equal(login.statusCode, 200);
  assert.match(login.headers['set-cookie'], /HttpOnly/);
  assert.match(login.headers['set-cookie'], /SameSite=Strict/);
  const cookie = login.headers['set-cookie'].split(';')[0];
  assert.equal((await request('session', { cookie })).statusCode, 200);
  assert.equal((await request('session', { cookie: `${cookie}x` })).statusCode, 401);
  assert.equal((await request('books', { method: 'POST', body: {}, cookie, origin: 'https://outro-site.com' })).statusCode, 403);
  const logout = await request('logout', { method: 'POST', body: {}, cookie });
  assert.match(logout.headers['set-cookie'], /Max-Age=0/);
});

test('configuração de sessão ausente produz erro explícito', async () => {
  const previous = process.env.SESSION_SECRET;
  delete process.env.SESSION_SECRET;
  assert.equal((await request('login', { method: 'POST', body: { username: 'admin', password: 'admin123' } })).statusCode, 503);
  process.env.SESSION_SECRET = previous;
});

test('diagnóstico distingue SQL ausente, chave recusada e falta de permissão', async () => {
  process.env.SESSION_SECRET = 'test-session-secret-with-more-than-32-characters';
  process.env.ADMIN_USERNAME = 'admin';
  process.env.ADMIN_PASSWORD = 'admin123';
  process.env.SUPABASE_URL = 'https://example.supabase.co';
  process.env.SUPABASE_SECRET_KEY = 'test-server-key';
  const login = await request('login', { method: 'POST', body: { username: 'admin', password: 'admin123' } });
  const cookie = login.headers['set-cookie'].split(';')[0];
  const originalFetch = globalThis.fetch;
  try {
    for (const [status, code, expected] of [[404, 'PGRST205', /schema.sql/], [401, 'PGRST301', /recusou a chave/], [403, '42501', /Sem permissão/]]) {
      globalThis.fetch = async () => new Response(JSON.stringify({ code, message: 'Provider diagnostic' }), { status, headers: { 'Content-Type': 'application/json' } });
      const result = await request('data', { cookie });
      assert.equal(result.statusCode, 503);
      assert.match(result.body.error, expected);
      assert.ok(!result.body.error.includes('test-server-key'));
    }
  } finally { globalThis.fetch = originalFetch; }
});
