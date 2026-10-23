// Bakes the LAST CALL art from tools/barman.html in headless Chrome.
// Serve the repo root (python3 -m http.server 8080), then: node tools/bake-barman.mjs [url] [outdir]
// Writes img/lastcall-bar.webp, img/lastcall-head.webp, img/lastcall-arm.webp and prints the pivots for style.css.
import { spawn } from 'node:child_process';
import { mkdtempSync, writeFileSync, mkdirSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

const url = process.argv[2] || 'http://127.0.0.1:8080/tools/barman.html';
const out = process.argv[3] || 'img';
const CHROME = process.env.CHROME || (process.platform === 'win32' ? 'C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe' : process.platform === 'darwin' ? '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome' : 'google-chrome');
const port = 9400 + Math.floor(Math.random() * 400), profile = mkdtempSync(join(tmpdir(), 'bake-'));
const chrome = spawn(CHROME, ['--headless=new', `--remote-debugging-port=${port}`, `--user-data-dir=${profile}`, '--use-angle=swiftshader', '--enable-unsafe-swiftshader', 'about:blank'], { stdio: 'ignore' });
const sleep = ms => new Promise(r => setTimeout(r, ms));
try {
  let page;
  for (let i = 0; i < 60 && !page; i++) { try { page = (await (await fetch(`http://127.0.0.1:${port}/json`)).json()).find(t => t.type === 'page'); } catch {} if (!page) await sleep(200); }
  const ws = new WebSocket(page.webSocketDebuggerUrl); await new Promise(r => ws.addEventListener('open', r, { once: true }));
  let id = 0; const waits = new Map();
  ws.addEventListener('message', e => { const m = JSON.parse(e.data); if (waits.has(m.id)) { waits.get(m.id)(m); waits.delete(m.id); } });
  const send = (method, params = {}) => new Promise(r => { const n = ++id; waits.set(n, r); ws.send(JSON.stringify({ id: n, method, params })); });
  await send('Page.navigate', { url });
  let bake;
  for (let i = 0; i < 300 && !bake; i++) { await sleep(200); const r = await send('Runtime.evaluate', { expression: 'window.__bake ? JSON.stringify(window.__bake) : ""', returnByValue: true }); bake = r.result?.result?.value; }
  if (!bake) throw new Error('bake timed out');
  const b = JSON.parse(bake); mkdirSync(out, { recursive: true });
  const save = (name, dataUrl) => { const buf = Buffer.from(dataUrl.split(',')[1], 'base64'); writeFileSync(join(out, name), buf); console.log(name, (buf.length / 1024).toFixed(1) + ' KB'); };
  save('lastcall-bar.webp', b.bar); save('lastcall-head.webp', b.head); save('lastcall-arm.webp', b.arm);
  if (process.env.PREVIEW) save(process.env.PREVIEW, b.full);
  console.log('pivots', JSON.stringify(b.pivots));
  ws.close();
} finally { chrome.kill(); }
