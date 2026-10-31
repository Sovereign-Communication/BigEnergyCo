import { createServer } from 'node:http';
import { readFile } from 'node:fs/promises';
import { extname, resolve, sep } from 'node:path';
import { createRequire } from 'node:module';
const require = createRequire('C:/tmp/pr215-fix/package.json');
const { chromium } = require('playwright');
const root = process.cwd();
const mime = { '.html': 'text/html; charset=utf-8', '.js': 'text/javascript; charset=utf-8', '.css': 'text/css; charset=utf-8', '.json': 'application/json; charset=utf-8', '.svg': 'image/svg+xml', '.webmanifest': 'application/manifest+json' };
const server = createServer(async (req, res) => {
  try {
    const pathname = decodeURIComponent(new URL(req.url, 'http://127.0.0.1').pathname);
    const file = resolve(root, `.${pathname === '/' ? '/index.html' : pathname}`);
    if (!(file === root || file.startsWith(root + sep))) { res.writeHead(403).end(); return; }
    const body = await readFile(file);
    res.writeHead(200, { 'content-type': mime[extname(file)] || 'application/octet-stream', 'cache-control': 'no-store' });
    res.end(body);
  } catch { res.writeHead(404).end('not found'); }
});
await new Promise((done) => server.listen(0, '127.0.0.1', done));
const { port } = server.address();
const browser = await chromium.launch({ channel: 'chrome', headless: true, args: ['--disable-gpu'] });
try {
  const results = [];
  for (const motion of ['reduce', 'no-preference']) {
    const context = await browser.newContext({ reducedMotion: motion, viewport: { width: 1280, height: 900 }, serviceWorkers: 'block' });
    const page = await context.newPage();
    const errors = [];
    page.on('pageerror', e => errors.push(String(e)));
    await page.addInitScript(() => {
      window.__scrollCalls = [];
      const original = Element.prototype.scrollIntoView;
      Element.prototype.scrollIntoView = function(options) {
        window.__scrollCalls.push({ id: this.id, options: options ?? null });
        return original?.call(this, options);
      };
    });
    await page.goto(`http://127.0.0.1:${port}/?qa=${motion}`, { waitUntil: 'domcontentloaded' });
    await page.waitForFunction(() => (document.getElementById('billSliderVal')?.textContent || '').trim().length > 0, null, { timeout: 15000 });
    await page.locator('#citySearch').fill('New York');
    await page.locator('#citySuggestions [role="option"]').first().waitFor({ timeout: 5000 });
    await page.locator('#citySuggestions [role="option"]').first().click();
    await page.waitForFunction(() => /New York/i.test(document.getElementById('locNote')?.textContent || ''), null, { timeout: 5000 });
    const oldLocation = await page.evaluate(() => ({ city: document.getElementById('citySearch')?.value, lat: Number(document.getElementById('latInput')?.value), lon: Number(document.getElementById('lonInput')?.value) }));
    await page.evaluate(() => {
      window.__runPosts = 0;
      const original = Worker.prototype.postMessage;
      Worker.prototype.postMessage = function(message) { if (message?.type === 'run') window.__runPosts++; return original.apply(this, arguments); };
    });
    await page.locator('#btnSeeExample').click();
    const immediate = await page.evaluate(() => {
      const slider = document.getElementById('billSlider');
      const value = Number(slider?.value), min = Number(slider?.min), step = Number(slider?.step);
      const shown = Number((document.getElementById('billSliderVal')?.textContent || '').replace(/[^0-9.]/g, ''));
      return { city: document.getElementById('citySearch')?.value, value, min, step, shown, stepAligned: step > 0 && Math.abs((value - min) / step - Math.round((value - min) / step)) < 1e-7, resultsHidden: document.getElementById('resultsRegion')?.hidden, scroll: window.__scrollCalls.at(-1) };
    });
    await page.waitForFunction(() => {
      const city = document.getElementById('citySearch')?.value || '';
      const note = document.getElementById('locNote')?.textContent || '';
      const lat = Number(document.getElementById('latInput')?.value), lon = Number(document.getElementById('lonInput')?.value);
      return /Honolulu/i.test(city) && /Honolulu/i.test(note) && Math.abs(lat - 21.31) < 0.03 && Math.abs(lon + 157.86) < 0.03;
    }, null, { timeout: 8000 });
    const settled = await page.evaluate(() => ({ city: document.getElementById('citySearch')?.value, note: document.getElementById('locNote')?.textContent, lat: Number(document.getElementById('latInput')?.value), lon: Number(document.getElementById('lonInput')?.value), bill: document.getElementById('billSlider')?.value, label: document.getElementById('billSliderVal')?.textContent, runPosts: window.__runPosts, resultsHidden: document.getElementById('resultsRegion')?.hidden }));
    results.push({ motion, oldLocation, immediate, settled, errors });
    await context.close();
  }
  console.log(JSON.stringify(results, null, 2));
} finally {
  await browser.close();
  await new Promise(done => server.close(done));
}
