// Usage: node tools/check.mjs [outDir]  (SCHEME=light|dark, BASE=url)  — screenshots + layout metrics for the UIST page
import puppeteer from 'puppeteer-core';
const out = process.argv[2] || 'shots';
const URL = process.env.BASE || 'http://127.0.0.1:4795/';
const browser = await puppeteer.launch({
  executablePath: '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome',
  headless: true,
});
const sizes = [
  { name: 'laptop', width: 1352, height: 690 },
  { name: 'mbp', width: 1440, height: 900 },
  { name: 'phone', width: 390, height: 844, isMobile: true, hasTouch: true, deviceScaleFactor: 2 },
];
const scheme = process.env.SCHEME || 'dark';
for (const vp of sizes) {
  const page = await browser.newPage();
  await page.setViewport(vp);
  await page.emulateMediaFeatures([{ name: 'prefers-color-scheme', value: scheme }]);
  await page.goto(URL, { waitUntil: 'networkidle0' });
  await new Promise((r) => setTimeout(r, 1500));
  const m = await page.evaluate(() => {
    const b = document.body;
    const groups = [...document.querySelectorAll('.group')].map((g) => ({ id: g.id, h: Math.round(g.clientHeight), sh: g.scrollHeight }));
    const wide = [...document.querySelectorAll('body *')].filter((el) => el.getBoundingClientRect().right > innerWidth + 1 && getComputedStyle(el).position !== 'fixed').slice(0, 5).map((el) => el.tagName + '.' + el.className);
    return { vw: innerWidth, sw: b.scrollWidth, groups, wide };
  });
  console.log(vp.name, JSON.stringify(m));
  // page through with ArrowDown and capture each screen
  const n = vp.isMobile ? 7 : 6;
  for (let i = 0; i < n; i++) {
    await page.screenshot({ path: `${out}/${scheme}-${vp.name}-${i}.png` });
    await page.evaluate(() => document.body.focus());
    if (vp.isMobile) await page.evaluate(() => document.body.scrollBy(0, innerHeight - 70));
    else await page.keyboard.press('ArrowDown');
    await new Promise((r) => setTimeout(r, 900));
  }
  // deep links
  for (const h of ['schedule', 'lab']) {
    await page.goto(URL + '#' + h, { waitUntil: 'networkidle0' });
    await new Promise((r) => setTimeout(r, 1200));
    const top = await page.evaluate((h) => Math.round(document.getElementById(h).getBoundingClientRect().top), h);
    console.log(vp.name, `#${h} top=${top}`);
  }
  await page.close();
}
await browser.close();
