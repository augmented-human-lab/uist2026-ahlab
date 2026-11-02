// Usage: node tools/og.mjs assets/og-image.jpg [dark|light]
// Render the 1200×630 share image from the live hero (real UI glimpse).
import puppeteer from 'puppeteer-core';
const [out, scheme = 'dark'] = process.argv.slice(2);
const browser = await puppeteer.launch({ executablePath: '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome', headless: true });
const page = await browser.newPage();
await page.setViewport({ width: 1200, height: 630, deviceScaleFactor: 1 });
await page.emulateMediaFeatures([{ name: 'prefers-color-scheme', value: scheme }]);
await page.goto(process.env.BASE || 'http://127.0.0.1:4795/', { waitUntil: 'networkidle0' });
await page.addStyleTag({ content: `
  .bar-actions, .nav { display: none !important; }
  .find-us .text-link { display: none; }
  .hero h1 { font-size: 60px !important; white-space: nowrap; }
  .hero .lede { font-size: 19px !important; }
` });
await page.evaluate(() => {
  // Freeze the live states so the card reads as a schedule, not a moment in time.
  document.querySelectorAll('.find-us-list li').forEach((li) => li.classList.remove('past'));
  document.querySelectorAll('.chip.live').forEach((c) => c.remove());
  document.getElementById('findUsTitle').textContent = 'Where to find us';
});
await new Promise((r) => setTimeout(r, 1500));
await page.screenshot({ path: out, type: 'jpeg', quality: 90 });
await browser.close();
