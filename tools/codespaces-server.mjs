import fs from 'node:fs';
import http from 'node:http';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const dist = path.join(root, 'dist');
const port = Number.parseInt(process.env.PORT || '4179', 10);
const host = process.env.HOST || '0.0.0.0';

const apiFiles = new Map([
  ['/api/catalog', '_public-data/catalog.json'],
  ['/api/npay', '_public-data/npay.json'],
  ['/api/stats', '_public-data/stats.json'],
  ['/api/stats.csv', '_public-data/stats-month.csv']
]);
const types = new Map([
  ['.html', 'text/html; charset=utf-8'],
  ['.js', 'text/javascript; charset=utf-8'],
  ['.css', 'text/css; charset=utf-8'],
  ['.json', 'application/json; charset=utf-8'],
  ['.csv', 'text/csv; charset=utf-8'],
  ['.svg', 'image/svg+xml'],
  ['.png', 'image/png'],
  ['.jpg', 'image/jpeg'],
  ['.jpeg', 'image/jpeg'],
  ['.webp', 'image/webp'],
  ['.ico', 'image/x-icon']
]);

function safeFile(urlPath) {
  const mapped = apiFiles.get(urlPath);
  const relative = mapped || (urlPath === '/' ? 'index.html' : decodeURIComponent(urlPath).replace(/^\/+/, ''));
  const target = path.resolve(dist, relative);
  return target === dist || target.startsWith(dist + path.sep) ? target : null;
}

function headers(res, type) {
  res.setHeader('Content-Type', type);
  res.setHeader('X-Content-Type-Options', 'nosniff');
  res.setHeader('Referrer-Policy', 'no-referrer');
  res.setHeader('Cache-Control', 'no-store');
  res.setHeader('Content-Security-Policy', "default-src 'self'; script-src 'self'; connect-src 'self' https://*.supabase.co; style-src 'self'; img-src 'self' data:; object-src 'none'; base-uri 'none'; form-action 'none'; frame-ancestors 'none'");
}

export function createCodespacesServer() {
 return http.createServer((req, res) => {
  if (!['GET', 'HEAD'].includes(req.method || '')) {
    res.writeHead(405, { Allow: 'GET, HEAD' });
    return res.end('Method Not Allowed');
  }
  let pathname;
  try { pathname = new URL(req.url || '/', 'http://codespace.local').pathname; }
  catch { res.writeHead(400); return res.end('Bad Request'); }
  const target = safeFile(pathname);
  if (!target || !fs.existsSync(target) || !fs.statSync(target).isFile()) {
    res.writeHead(404); return res.end('Not Found');
  }
  headers(res, types.get(path.extname(target).toLowerCase()) || 'application/octet-stream');
  res.statusCode = 200;
  if (req.method === 'HEAD') return res.end();
  fs.createReadStream(target).pipe(res);
 });
}

if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  createCodespacesServer().listen(port, host, () => {
    console.log(`Codespaces preview: http://localhost:${port}`);
  });
}
