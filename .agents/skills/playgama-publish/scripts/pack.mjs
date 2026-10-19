#!/usr/bin/env node
// Packs a game's build folder into the zip Playgama takes: the folder's contents at the root of the zip (so index.html
// is at the top), without system files (.DS_Store, Thumbs.db, __MACOSX, .git), and prints the exact size in bytes that
// start_archive_upload asks for as contentSize. The same on macOS, Linux and Windows: Node only, no zip tool needed.
//
//   node pack.mjs <build folder> [--name my-game-1.4.2] [--out <folder>]
//
// Put the build's version in --name: the game's form keeps every archive it is given, and the name is how a person
// tells them apart. Needs Node 18+.
import { closeSync, mkdirSync, openSync, readdirSync, readFileSync, statSync, writeSync, existsSync } from 'node:fs';
import path from 'node:path';
import zlib from 'node:zlib';

const args = process.argv.slice(2);
const opt = (n) => { const i = args.indexOf('--' + n); return i >= 0 ? args[i + 1] : undefined; };
const dir = args.find((a, i) => !a.startsWith('--') && !['--name', '--out'].includes(args[i - 1]));
if (!dir || !existsSync(dir) || !statSync(dir).isDirectory()) {
  console.error('usage: node pack.mjs <build folder> [--name my-game-1.4.2] [--out <folder>]');
  process.exit(2);
}
const root = path.resolve(dir);
const name = (opt('name') || path.basename(root)).replace(/\.zip$/i, '');
const out = path.resolve(opt('out') || path.dirname(root), name + '.zip');
if (out.startsWith(root + path.sep)) { console.error('write the zip outside the build folder (--out)'); process.exit(2); }

const JUNK = /^(\.DS_Store|Thumbs\.db|desktop\.ini|\.git|__MACOSX)$/;
// already compressed: deflating them again only costs time
const STORED = /\.(png|jpe?g|gif|webp|avif|mp3|ogg|oga|m4a|aac|opus|mp4|webm|woff2?|zip|gz|br|ktx2|basis|unityweb)$/i;
const files = [];
(function walk(d) {
  for (const e of readdirSync(d, { withFileTypes: true }).sort((a, b) => a.name.localeCompare(b.name))) {
    if (JUNK.test(e.name)) continue;
    const p = path.join(d, e.name);
    if (e.isDirectory()) walk(p);
    else if (e.isFile()) files.push(p);
  }
})(root);
const rel = (p) => path.relative(root, p).split(path.sep).join('/');
if (!files.some((p) => rel(p) === 'index.html')) {
  console.error(`no index.html at the top of ${root}: pack the folder that holds it`);
  process.exit(1);
}
if (files.length >= 65535) { console.error('more than 65,534 files: too many for one zip'); process.exit(1); }

const CRC = (() => {
  if (typeof zlib.crc32 === 'function') return (b) => zlib.crc32(b) >>> 0;
  const t = new Uint32Array(256);
  for (let n = 0; n < 256; n++) { let c = n; for (let k = 0; k < 8; k++) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1; t[n] = c >>> 0; }
  return (b) => { let c = 0xffffffff; for (const x of b) c = t[(c ^ x) & 0xff] ^ (c >>> 8); return (c ^ 0xffffffff) >>> 0; };
})();
const dosTime = (d) => ((d.getHours() << 11) | (d.getMinutes() << 5) | (d.getSeconds() >> 1)) & 0xffff;
const dosDate = (d) => (((Math.max(d.getFullYear(), 1980) - 1980) << 9) | ((d.getMonth() + 1) << 5) | d.getDate()) & 0xffff;

mkdirSync(path.dirname(out), { recursive: true });
const fd = openSync(out, 'w');
let offset = 0;
const put = (buf) => { writeSync(fd, buf); offset += buf.length; };
const central = [];
for (const p of files) {
  const raw = readFileSync(p);
  const crc = CRC(raw);
  let data = raw, method = 0;
  if (!STORED.test(p) && raw.length > 0) {
    const z = zlib.deflateRawSync(raw, { level: 9 });
    if (z.length < raw.length) { data = z; method = 8; }
  }
  const fname = Buffer.from(rel(p), 'utf8');
  const mtime = statSync(p).mtime;
  const head = Buffer.alloc(30);
  head.writeUInt32LE(0x04034b50, 0); head.writeUInt16LE(20, 4); head.writeUInt16LE(0x0800, 6);
  head.writeUInt16LE(method, 8); head.writeUInt16LE(dosTime(mtime), 10); head.writeUInt16LE(dosDate(mtime), 12);
  head.writeUInt32LE(crc, 14); head.writeUInt32LE(data.length, 18); head.writeUInt32LE(raw.length, 22);
  head.writeUInt16LE(fname.length, 26); head.writeUInt16LE(0, 28);
  const at = offset;
  put(head); put(fname); put(data);
  const cen = Buffer.alloc(46);
  cen.writeUInt32LE(0x02014b50, 0); cen.writeUInt16LE(20, 4); cen.writeUInt16LE(20, 6); cen.writeUInt16LE(0x0800, 8);
  cen.writeUInt16LE(method, 10); cen.writeUInt16LE(dosTime(mtime), 12); cen.writeUInt16LE(dosDate(mtime), 14);
  cen.writeUInt32LE(crc, 16); cen.writeUInt32LE(data.length, 20); cen.writeUInt32LE(raw.length, 24);
  cen.writeUInt16LE(fname.length, 28); cen.writeUInt32LE(at, 42);
  central.push(Buffer.concat([cen, fname]));
  if (offset > 0xffffffff - 1e6) { closeSync(fd); console.error('the zip would pass 4 GB'); process.exit(1); }
}
const cdStart = offset;
for (const c of central) put(c);
const end = Buffer.alloc(22);
end.writeUInt32LE(0x06054b50, 0); end.writeUInt16LE(files.length, 8); end.writeUInt16LE(files.length, 10);
end.writeUInt32LE(offset - cdStart, 12); end.writeUInt32LE(cdStart, 16);
put(end);
closeSync(fd);

const bytes = statSync(out).size;
const LIMIT = 314572800;
console.log(`${out}\n${files.length} files, ${bytes} bytes (${(bytes / 1024 / 1024).toFixed(1)} MB)`);
if (bytes > LIMIT) { console.error(`over Playgama's 300 MB (${LIMIT} bytes) limit: make the build smaller`); process.exit(1); }
console.log(`start_archive_upload: name "${name}", contentSize ${bytes}`);
