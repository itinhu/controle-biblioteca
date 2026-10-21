import { createServer } from 'node:http';
import { loadEnv, createServer as createViteServer } from 'vite';
import handler from '../api/index.js';
Object.assign(process.env, loadEnv('development', process.cwd(), ''));
const vite = await createViteServer({ server: { middlewareMode: true }, appType: 'spa' });
createServer((req, res) => req.url.startsWith('/api/') ? handler(req, res) : vite.middlewares(req, res)).listen(5173, '127.0.0.1', () => console.log('Biblioteca: http://localhost:5173'));
