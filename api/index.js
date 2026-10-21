import { createClient } from '@supabase/supabase-js';
import { SignJWT, jwtVerify } from 'jose';
import { timingSafeEqual, createHash } from 'node:crypto';
import { today, dueDate, textField, integer } from '../server/domain.js';

const hash = value => createHash('sha256').update(value).digest();
const equal = (a, b) => timingSafeEqual(hash(a), hash(b));
const cookie = (token, age) => `library_session=${token}; HttpOnly; SameSite=Strict; Path=/; Max-Age=${age}${process.env.NODE_ENV === 'production' || process.env.VERCEL ? '; Secure' : ''}`;
function secret() {
  if (!process.env.SESSION_SECRET || process.env.SESSION_SECRET.length < 32) throw Object.assign(new Error('Configure SESSION_SECRET com pelo menos 32 caracteres no servidor.'), { status: 503 });
  return new TextEncoder().encode(process.env.SESSION_SECRET);
}
function database() {
  if (!process.env.SUPABASE_URL || !(process.env.SUPABASE_SECRET_KEY || process.env.SUPABASE_SERVICE_ROLE_KEY)) throw Object.assign(new Error('Configure SUPABASE_URL e SUPABASE_SECRET_KEY no servidor e execute o SQL de instalação.'), { status: 503 });
  return createClient(process.env.SUPABASE_URL, (process.env.SUPABASE_SECRET_KEY || process.env.SUPABASE_SERVICE_ROLE_KEY), { auth: { persistSession: false, autoRefreshToken: false } });
}
async function body(req) {
  if (req.body && typeof req.body === 'object') return req.body;
  let raw = typeof req.body === 'string' ? req.body : '';
  if (!raw) for await (const chunk of req) { raw += chunk; if (raw.length > 16384) throw Object.assign(new Error('Dados muito grandes.'), { status: 413 }); }
  try { return JSON.parse(raw || '{}'); } catch { throw Object.assign(new Error('JSON inválido.'), { status: 400 }); }
}
async function query(promise) {
  const { data, error } = await promise;
  if (error) {
    console.error('Database error:', error.code);
    if (error.code === 'P0001') throw Object.assign(new Error(error.message), { status: 409 });
    if (error.code === '23505') throw Object.assign(new Error('Este cadastro já existe.'), { status: 409 });
    throw Object.assign(new Error('Não foi possível acessar o banco. Verifique a configuração e a instalação do SQL.'), { status: 503 });
  }
  return data;
}
async function allRows(db, table, order) {
  const rows = [];
  for (let offset = 0; ; offset += 500) {
    const page = await query(db.from(table).select('*').order(order, { ascending: table !== 'loans' }).order('id').range(offset, offset + 499));
    rows.push(...page);
    if (page.length < 500) return rows;
  }
}
export default async function handler(req, res) {
  res.setHeader('Cache-Control', 'no-store');
  res.setHeader('X-Content-Type-Options', 'nosniff');
  const send = (status, data) => { res.statusCode = status; res.setHeader('Content-Type', 'application/json; charset=utf-8'); res.end(JSON.stringify(data)); };
  try {
    const route = new URL(req.url, 'http://localhost').pathname.replace(/\/$/, '');
    if (!['GET', 'POST'].includes(req.method)) return send(405, { error: 'Método não permitido.' });
    if (req.method === 'POST') {
      const origin = req.headers.origin;
      const host = req.headers['x-forwarded-host'] || req.headers.host;
      if (origin && new URL(origin).host !== host) return send(403, { error: 'Origem não permitida.' });
      if (!req.headers['content-type']?.includes('application/json')) return send(415, { error: 'Envie application/json.' });
    }
    if (route === '/api/login' && req.method === 'POST') {
      const input = await body(req);
      const key = secret();
      if (!process.env.ADMIN_PASSWORD) return send(503, { error: 'Configure ADMIN_PASSWORD no servidor.' });
      // Custo uniforme também para credenciais incorretas.
      const validUser = equal(String(input.username || ''), process.env.ADMIN_USERNAME || 'admin');
      const validPass = equal(String(input.password || ''), process.env.ADMIN_PASSWORD);
      if (!validUser || !validPass) { await new Promise(resolve => setTimeout(resolve, 700)); return send(401, { error: 'Usuário ou senha incorretos.' }); }
      const token = await new SignJWT({ role: 'admin' }).setProtectedHeader({ alg: 'HS256' }).setIssuedAt().setExpirationTime('8h').setIssuer('biblioteca').setAudience('biblioteca-admin').sign(key);
      res.setHeader('Set-Cookie', cookie(token, 28800));
      return send(200, { authenticated: true });
    }
    if (route === '/api/logout' && req.method === 'POST') { res.setHeader('Set-Cookie', cookie('', 0)); return send(200, { ok: true }); }
    const token = (req.headers.cookie || '').split(';').map(v => v.trim()).find(v => v.startsWith('library_session='))?.slice(16);
    try { const { payload } = await jwtVerify(token || '', secret(), { algorithms: ['HS256'], issuer: 'biblioteca', audience: 'biblioteca-admin' }); if (payload.role !== 'admin') throw new Error(); }
    catch (error) { if (error.status === 503) throw error; return send(401, { error: 'Faça login para continuar.' }); }
    if (route === '/api/session' && req.method === 'GET') return send(200, { authenticated: true });
    const db = database();
    if (route === '/api/data' && req.method === 'GET') {
      const [students, books, loans] = await Promise.all([allRows(db, 'students', 'name'), allRows(db, 'books', 'title'), allRows(db, 'loans', 'created_at')]);
      return send(200, { students, books, loans, today: today() });
    }
    if (req.method !== 'POST') return send(404, { error: 'Rota não encontrada.' });
    const input = await body(req);
    if (route === '/api/students') {
      const data = await query(db.from('students').insert({ name: textField(input.name, 'Nome'), grade: integer(input.grade, 'Ano', 1, 6) }).select().single());
      return send(201, data);
    }
    if (route === '/api/books') {
      const data = await query(db.from('books').insert({ title: textField(input.title, 'Título'), author: typeof input.author === 'string' ? input.author.trim().slice(0, 160) : '', copies: integer(input.copies, 'Exemplares', 1, 999) }).select().single());
      return send(201, data);
    }
    if (route === '/api/loans') {
      const days = integer(input.days, 'Prazo', 1, 90);
      const data = await query(db.rpc('create_loan', { p_student_id: input.student_id || null, p_student_name: input.student_id ? null : textField(input.student_name, 'Nome'), p_grade: input.student_id ? null : integer(input.grade, 'Ano', 1, 6), p_book_id: input.book_id || null, p_book_title: input.book_id ? null : textField(input.book_title, 'Título'), p_book_author: String(input.book_author || '').slice(0, 160), p_loan_date: today(), p_due_date: dueDate(today(), days) }));
      return send(201, data);
    }
    if (route === '/api/return') {
      const data = await query(db.from('loans').update({ returned_at: new Date().toISOString() }).eq('id', input.id).is('returned_at', null).select());
      if (!data.length) return send(409, { error: 'Empréstimo não encontrado ou já devolvido.' });
      return send(200, data[0]);
    }
    return send(404, { error: 'Rota não encontrada.' });
  } catch (error) { send(error.status || 400, { error: error.status ? error.message : 'Dados inválidos. Confira os campos e tente novamente.' }); }
}
