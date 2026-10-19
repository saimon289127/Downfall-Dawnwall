#!/usr/bin/env node
// Serves a game's build folder on this computer, so the QA Tool and a headless browser can open it, with no package to
// download. Node only (18+), the same on macOS, Linux and Windows.
//
//   node serve.mjs <build folder> [--port 8080] [--isolate]
//
// It listens on 127.0.0.1 only, prints the address to give get_local_game_qa_tool_link, and runs until stopped. A busy
// port moves it to the next free one. --isolate adds the cross-origin isolation headers (COOP and COEP) that threaded
// web exports, such as Godot 4's, need. Pre-compressed files (.br, .gz, as Unity writes them) are sent with their
// encoding.
import { createServer } from 'node:http';
import { createReadStream, statSync } from 'node:fs';
import path from 'node:path';

const args = process.argv.slice(2);
const opt = (n, d) => { const i = args.indexOf('--' + n); return i >= 0 ? args[i + 1] : d; };
const dir = args.find((a, i) => !a.startsWith('--') && args[i - 1] !== '--port');
if (!dir) {
  console.error('usage: node serve.mjs <build folder> [--port 8080] [--isolate]');
  process.exit(2);
}
const root = path.resolve(dir);
try { if (!statSync(root).isDirectory()) throw new Error(); } catch { console.error(`not a folder: ${dir}`); process.exit(2); }
const isolate = args.includes('--isolate');

const TEXT = '; charset=utf-8';
const TYPES = {
  '.html': 'text/html' + TEXT, '.htm': 'text/html' + TEXT, '.js': 'text/javascript' + TEXT, '.mjs': 'text/javascript' + TEXT,
  '.css': 'text/css' + TEXT, '.json': 'application/json' + TEXT, '.txt': 'text/plain' + TEXT, '.xml': 'application/xml' + TEXT,
  '.wasm': 'application/wasm', '.png': 'image/png', '.jpg': 'image/jpeg', '.jpeg': 'image/jpeg', '.gif': 'image/gif',
  '.webp': 'image/webp', '.svg': 'image/svg+xml', '.ico': 'image/x-icon', '.mp3': 'audio/mpeg', '.ogg': 'audio/ogg',
  '.wav': 'audio/wav', '.m4a': 'audio/mp4', '.mp4': 'video/mp4', '.webm': 'video/webm', '.woff': 'font/woff',
  '.woff2': 'font/woff2', '.ttf': 'font/ttf', '.otf': 'font/otf', '.glb': 'model/gltf-binary', '.gltf': 'model/gltf+json',
};

const server = createServer((req, res) => {
  let url, rel;
  try { url = new URL(req.url, 'http://localhost'); rel = decodeURIComponent(url.pathname); } catch { res.writeHead(400).end(); return; }
  let file = path.join(root, rel);
  if (file !== root && !file.startsWith(root + path.sep)) { res.writeHead(403).end(); return; }
  let isDir = false;
  try { isDir = statSync(file).isDirectory(); } catch { /* answered below */ }
  // a folder without its slash: send it on with one, or the page's relative paths miss
  if (isDir && !url.pathname.endsWith('/')) { res.writeHead(301, { Location: url.pathname + '/' + url.search }).end(); return; }
  if (isDir) file = path.join(file, 'index.html');
  let st;
  try { st = statSync(file); } catch { st = null; }
  if (!st || !st.isFile()) { res.writeHead(404, { 'Content-Type': 'text/plain' + TEXT }).end('not found'); return; }

  let ext = path.extname(file).toLowerCase();
  let encoding = null;
  if (ext === '.br' || ext === '.gz') {
    encoding = ext === '.br' ? 'br' : 'gzip';
    ext = path.extname(file.slice(0, -ext.length)).toLowerCase();
  }
  const headers = {
    'Content-Type': TYPES[ext] || 'application/octet-stream',
    'Content-Length': st.size,
    'Cache-Control': 'no-store',
  };
  if (encoding) headers['Content-Encoding'] = encoding;
  if (isolate) Object.assign(headers, { 'Cross-Origin-Opener-Policy': 'same-origin', 'Cross-Origin-Embedder-Policy': 'require-corp' });
  res.writeHead(200, headers);
  if (req.method === 'HEAD') { res.end(); return; }
  createReadStream(file).pipe(res);
});

let port = Number(opt('port', 8080));
let triesLeft = 20;
server.on('listening', () => {
  console.log(`serving ${root}`);
  console.log(`http://127.0.0.1:${port}/  (stop with Ctrl+C)`);
});
server.on('error', (err) => {
  if (err.code === 'EADDRINUSE' && triesLeft-- > 0) { port += 1; server.listen(port, '127.0.0.1'); return; }
  console.error(err.message);
  process.exit(1);
});
server.listen(port, '127.0.0.1');
