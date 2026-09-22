/**
 * Light/dark theme: the system preference is honoured until the reader picks
 * for themselves, the choice survives a reload and applies across pages, and
 * the palette genuinely changes rather than only the attribute.
 *
 *   npm i -D playwright && npx playwright install chromium
 *   node tests/theme.mjs
 */
import { chromium } from 'playwright';

const BASE = process.env.BASE_URL ?? 'http://127.0.0.1:3000';
let bad = 0;
const check = (name, ok, extra = '') => {
  if (!ok) { bad++; console.log(`FAIL ${name} :: ${extra}`); } else console.log(`PASS ${name}`);
};

const browser = await chromium.launch();
const read = (page) => page.getAttribute('html', 'data-theme');
const bodyBg = (page) =>
  page.evaluate(() => getComputedStyle(document.body).backgroundColor);

// ---- the operating system's preference is the starting point --------------
for (const [scheme, expected] of [['light', 'light'], ['dark', 'dark']]) {
  const ctx = await browser.newContext({ baseURL: BASE, colorScheme: scheme });
  const page = await ctx.newPage();
  await page.goto('/login');
  await page.waitForTimeout(400);
  check(`a ${scheme} system preference starts in ${expected}`, (await read(page)) === expected,
    await read(page));
  await ctx.close();
}

// ---- the reader's choice wins, and sticks --------------------------------
const ctx = await browser.newContext({ baseURL: BASE, colorScheme: 'light' });
const page = await ctx.newPage();
await page.goto('/login');
await page.waitForTimeout(400);

const lightBg = await bodyBg(page);
await page.click('.theme-toggle');
await page.waitForTimeout(900);
check('the toggle switches to dark', (await read(page)) === 'dark', await read(page));

const darkBg = await bodyBg(page);
check('the page background actually changes', lightBg !== darkBg, `${lightBg} vs ${darkBg}`);
check('dark is genuinely darker', (() => {
  const lum = (c) => c.match(/\d+/g).slice(0, 3).reduce((a, n) => a + Number(n), 0);
  return lum(darkBg) < lum(lightBg);
})(), `${lightBg} vs ${darkBg}`);

await page.reload();
await page.waitForTimeout(500);
check('the choice survives a reload', (await read(page)) === 'dark', await read(page));

// ---- and holds while moving around the app --------------------------------
await page.fill('input[name=identifier]', 'ada@uni.edu');
await page.fill('input[name=password]', 'password123');
await page.click('button[type=submit]');
await page.waitForURL('**/dashboard', { timeout: 30000 });
await page.waitForTimeout(400);
check('the choice holds after signing in', (await read(page)) === 'dark', await read(page));
await page.goto('/guidelines');
await page.waitForTimeout(400);
check('the choice holds across pages', (await read(page)) === 'dark', await read(page));

// ---- the toggle is reachable and reversible -------------------------------
const box = await page.locator('.theme-toggle').boundingBox();
check('the toggle is a usable tap target', box.width >= 40 && box.height >= 40,
  JSON.stringify(box));
check('the toggle stays inside the viewport', await page.evaluate(() => {
  const r = document.querySelector('.theme-toggle').getBoundingClientRect();
  return r.right <= innerWidth + 1 && r.bottom <= innerHeight + 1 && r.left >= -1;
}));
await page.click('.theme-toggle');
await page.waitForTimeout(900);
check('the toggle switches back to light', (await read(page)) === 'light', await read(page));

// ---- a fresh visitor who has chosen is not overridden by the system -------
const ctx2 = await browser.newContext({ baseURL: BASE, colorScheme: 'dark',
  storageState: await ctx.storageState() });
const page2 = await ctx2.newPage();
await page2.goto('/login');
await page2.waitForTimeout(400);
check('a saved light choice beats a dark system setting', (await read(page2)) === 'light',
  await read(page2));
await ctx2.close();
await ctx.close();

await browser.close();
console.log(`\n${bad} failures`);
process.exit(bad ? 1 : 0);
