/**
 * Navigation behaviour: which tab lights up where, and that "My group" points
 * straight at the group rather than bouncing through the /my-group redirect
 * (which costs a whole extra server round trip).
 *
 *   npm i -D playwright && npx playwright install chromium
 *   node tests/navigation.mjs
 */
import { chromium } from 'playwright';

const BASE = process.env.BASE_URL ?? 'http://127.0.0.1:3000';
const browser = await chromium.launch();
let bad = 0;
const check = (n, ok, extra='') => { if (!ok) { bad++; console.log(`FAIL ${n} :: ${extra}`); } else console.log(`PASS ${n}`); };

async function session(id, pw) {
  const ctx = await browser.newContext({ baseURL: BASE,
    viewport:{width:390,height:844}, deviceScaleFactor:2, isMobile:true, hasTouch:true });
  const page = await ctx.newPage();
  await page.goto('/login');
  await page.fill('input[name=identifier]', id);
  await page.fill('input[name=password]', pw);
  await page.click('button[type=submit]');
  await page.waitForURL('**/dashboard', { timeout: 30000 });
  return { ctx, page };
}
const activeTab = (page) => page.$$eval('.tabbar a.active', els => els.map(e => e.textContent.trim()));

// --- student who is in a group -------------------------------------------
const s = await session('ada@uni.edu', 'password123');
const myGroupHref = await s.page.locator('.tabbar a', { hasText: 'My group' }).getAttribute('href');
check('My group links straight at the group (no /my-group redirect)',
  /^\/groups\/[0-9a-f-]+$/.test(myGroupHref), myGroupHref);

// Click it the way a student would, and time the navigation.
const t0 = Date.now();
await s.page.locator('.tabbar a', { hasText: 'My group' }).click();
await s.page.waitForURL(/\/groups\/[0-9a-f-]+$/, { timeout: 30000 });
await s.page.waitForLoadState('networkidle').catch(() => {});
console.log(`   navigation took ${Date.now() - t0}ms (local db)`);
check('own group highlights "My group"', JSON.stringify(await activeTab(s.page)) === '["My group"]',
  JSON.stringify(await activeTab(s.page)));

await s.page.goto('/groups');
await s.page.waitForLoadState('networkidle').catch(() => {});
check('group list highlights "Groups"', JSON.stringify(await activeTab(s.page)) === '["Groups"]',
  JSON.stringify(await activeTab(s.page)));

// another group's page must highlight Groups, not My group
const others = await s.page.$$eval('a[href^="/groups/"]', (els, mine) =>
  [...new Set(els.map(e => e.getAttribute('href')))].filter(h => h !== mine), myGroupHref);
if (others.length) {
  await s.page.goto(others[0]);
  await s.page.waitForLoadState('networkidle').catch(() => {});
  check("another group's page highlights \"Groups\"",
    JSON.stringify(await activeTab(s.page)) === '["Groups"]', JSON.stringify(await activeTab(s.page)));
}
await s.page.goto('/dashboard');
await s.page.waitForLoadState('networkidle').catch(() => {});
check('dashboard highlights "Home"', JSON.stringify(await activeTab(s.page)) === '["Home"]',
  JSON.stringify(await activeTab(s.page)));
await s.page.goto('/guidelines');
await s.page.waitForLoadState('networkidle').catch(() => {});
check('guidelines highlights "Guidelines"', JSON.stringify(await activeTab(s.page)) === '["Guidelines"]',
  JSON.stringify(await activeTab(s.page)));
await s.ctx.close();

// --- student with no group -------------------------------------------------
const n = await session('grace@uni.edu', 'password123');
const href = await n.page.locator('.tabbar a', { hasText: 'My group' }).getAttribute('href');
check('no group yet -> My group still points at /my-group', href === '/my-group', href);
await n.page.goto('/my-group');
await n.page.waitForLoadState('networkidle').catch(() => {});
check('/my-group highlights "My group"', JSON.stringify(await activeTab(n.page)) === '["My group"]',
  JSON.stringify(await activeTab(n.page)));
await n.ctx.close();

await browser.close();
console.log(`\n${bad} failures`);
process.exit(bad ? 1 : 0);
