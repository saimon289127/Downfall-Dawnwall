#!/usr/bin/env node
// Renders the three covers Playgama's form takes, from screenshots of the game itself, at the exact sizes:
// square 800x800, portrait 1080x1920, landscape 1920x1080. Each cover is a screenshot cropped to fill the frame, with
// the game's title on it when --title is given, in the game's own font when --font is given.
//
//   node covers.mjs --shot landscape.png [--portrait tall.png] [--square square.png]
//        [--title "Coin Town"] [--title-at bottom|top] [--font fonts/Title.ttf] [--color "#ffffff"]
//        [--focus 0.5,0.45] [--out covers]
//
//   --shot       a screenshot of the game, used for every cover that has no picture of its own
//   --portrait   a screenshot taken in a tall window (the portrait cover crops a wide shot hard)
//   --title-at   where the title sits: bottom (the default) or top, to keep it off the player or the action
//   --focus      what to keep when cropping, as fractions of the picture: 0.5,0.5 is the centre
//
// Prints each file with its format and size in bytes: what start_cover_upload asks for. Needs puppeteer, found in the
// folder it runs from or beside this script (npm i puppeteer), or puppeteer-core with CHROME=/path/to/chrome.
import { existsSync, mkdirSync, readFileSync, rmSync, statSync, writeFileSync } from 'node:fs';
import { createRequire } from 'node:module';
import path from 'node:path';
import { pathToFileURL } from 'node:url';

const args = process.argv.slice(2);
const opt = (n, d) => { const i = args.indexOf('--' + n); return i >= 0 ? args[i + 1] : d; };
const shot = opt('shot');
if (!shot) {
  console.error('usage: node covers.mjs --shot <screenshot.png> [--portrait <png>] [--square <png>] [--title "Game"] [--title-at bottom|top] [--font <file>] [--out covers]');
  process.exit(2);
}
const titleAt = opt('title-at', 'bottom');
if (!['bottom', 'top'].includes(titleAt)) { console.error(`--title-at takes bottom or top, not "${titleAt}"`); process.exit(2); }
const pics = { landscape: shot, portrait: opt('portrait', shot), square: opt('square', shot) };
for (const p of new Set(Object.values(pics))) if (!existsSync(p)) { console.error(`not found: ${p}`); process.exit(2); }
const title = opt('title', '');
const font = opt('font');
const color = opt('color', '#ffffff');
const [fx, fy] = opt('focus', '0.5,0.5').split(',').map((v) => Math.min(1, Math.max(0, +v)));
const outDir = path.resolve(opt('out', 'covers'));
mkdirSync(outDir, { recursive: true });

async function loadPuppeteer() {
  for (const name of ['puppeteer', 'puppeteer-core']) {
    try { return { name, lib: (await import(name)).default }; } catch { /* not beside the script */ }
    try {
      const m = await import(pathToFileURL(createRequire(path.join(process.cwd(), 'index.js')).resolve(name)).href);
      return { name, lib: m.default?.launch ? m.default : m.default?.default || m };
    } catch { /* not in this folder either */ }
  }
  return null;
}
const pp = await loadPuppeteer();
if (!pp) { console.error('puppeteer is not installed: npm i puppeteer (in this folder), then run again'); process.exit(1); }
if (pp.name === 'puppeteer-core' && !process.env.CHROME) { console.error('puppeteer-core needs CHROME=/path/to/chrome'); process.exit(1); }

const esc = (s) => s.replace(/[&<>"]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' })[c]);
const fontFace = font
  ? `@font-face{font-family:"Cover Title";src:url(data:font/${path.extname(font).slice(1)};base64,${readFileSync(font).toString('base64')})}`
  : '';
const SLOTS = [
  { cover: 'square', w: 800, h: 800, size: 0.115 },
  { cover: 'portrait', w: 1080, h: 1920, size: 0.12 },
  { cover: 'landscape', w: 1920, h: 1080, size: 0.11 },
];

const browser = await pp.lib.launch({
  headless: true,
  ...(process.env.CHROME ? { executablePath: process.env.CHROME } : {}),
  args: ['--hide-scrollbars', ...`${process.env.CHROME_ARGS || ''}`.split(/\s+/).filter(Boolean)],
});
const tmp = path.join(outDir, '.cover.html');
try {
  const page = await browser.newPage();
  for (const s of SLOTS) {
    const px = Math.round(Math.min(s.w, s.h) * s.size);
    writeFileSync(tmp, `<!doctype html><meta charset="utf-8"><style>${fontFace}
html,body{margin:0;width:${s.w}px;height:${s.h}px;overflow:hidden;background:#000}
img{position:absolute;inset:0;width:100%;height:100%;object-fit:cover;object-position:${fx * 100}% ${fy * 100}%}
.shade{position:absolute;left:0;right:0;${titleAt}:0;height:42%;background:linear-gradient(to ${titleAt === 'top' ? 'bottom' : 'top'},rgba(0,0,0,.72),rgba(0,0,0,0))}
h1{position:absolute;left:6%;right:6%;${titleAt}:7%;margin:0;color:${color};font:800 ${px}px/1.05 "Cover Title",system-ui,-apple-system,"Segoe UI",Roboto,sans-serif;
text-align:center;text-shadow:0 4px 18px rgba(0,0,0,.55);overflow-wrap:anywhere}</style>
<img src="${pathToFileURL(path.resolve(pics[s.cover])).href}">${title ? `<div class="shade"></div><h1>${esc(title)}</h1>` : ''}`);
    await page.setViewport({ width: s.w, height: s.h, deviceScaleFactor: 1 });
    await page.goto(pathToFileURL(tmp).href, { waitUntil: 'load' });
    await page.evaluate(async () => {
      await document.fonts.ready;
      await document.querySelector('img').decode().catch(() => {});
      const h1 = document.querySelector('h1');
      if (!h1) return;
      // at most two lines: shrink the title until it fits
      let size = parseFloat(getComputedStyle(h1).fontSize);
      while (h1.getBoundingClientRect().height > size * 1.05 * 2 + 2 && size > 20) { size -= 2; h1.style.fontSize = size + 'px'; }
    });
    let buf = Buffer.from(await page.screenshot({ type: 'png' }));
    let format = 'png';
    if (buf.length > 9.5 * 1024 * 1024) { buf = Buffer.from(await page.screenshot({ type: 'jpeg', quality: 90 })); format = 'jpeg'; }
    const file = path.join(outDir, `cover-${s.cover}.${format === 'png' ? 'png' : 'jpg'}`);
    writeFileSync(file, buf);
    console.log(`${file}  ${s.w}x${s.h}  cover "${s.cover}", format "${format}", contentSize ${statSync(file).size}`);
  }
} finally {
  rmSync(tmp, { force: true });
  await browser.close();
}
