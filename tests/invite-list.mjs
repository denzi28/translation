/**
 * The "Invite a classmate" list with a whole class signed up: ten students a
 * page with page numbers, a search that pages the same way, a page number
 * past the end falling back to the last page, paging landing back on the list,
 * a classmate already invited marked "Invited" instead of offered again, and
 * the result of an invitation reported once, at the top of the list.
 *
 * Uses the fixture student ada@ogr.iuc.edu.tr (password123), who owns a group with
 * room in it, and registers its own classmates for each run.
 *
 *   node tests/invite-list.mjs          # BASE_URL=… to target a deployment
 */
import { chromium } from 'playwright';
import { registerStudent, signIn } from './sign-in.mjs';

const BASE = process.env.BASE_URL ?? 'http://127.0.0.1:3000';
const RUN = Date.now().toString(36);
const TAG = `Pager${RUN}`;
let bad = 0;
const check = (name, ok, extra = '') => {
  if (!ok) { bad++; console.log(`FAIL ${name} :: ${extra}`); } else console.log(`PASS ${name}`);
};

const browser = await chromium.launch();

// Twelve classmates, so a search for this run spans two pages.
for (let i = 1; i <= 12; i++) {
  const ctx = await browser.newContext({ baseURL: BASE });
  const page = await ctx.newPage();
  await registerStudent(page, {
    name: `${TAG} ${String(i).padStart(2, '0')}`,
    number: `p${RUN}${i}`,
    email: `pager.${RUN}.${i}@ogr.iuc.edu.tr`,
  });
  await ctx.close();
}

const ctx = await browser.newContext({ baseURL: BASE, viewport: { width: 1280, height: 900 } });
const page = await ctx.newPage();
await signIn(page, 'ada@ogr.iuc.edu.tr', 'password123');
await page.click('.tabbar a:has-text("My group"), .nav a:has-text("My group")');
await page.waitForURL(/\/groups\//);
const groupPath = new URL(page.url()).pathname;

const read = () => page.evaluate(() => ({
  names: [...document.querySelectorAll('.invite-row strong')].map((e) => e.textContent),
  summary: document.querySelector('.pager-summary')?.textContent ?? '',
  current: document.querySelector('.pager-page[aria-current="page"]')?.textContent ?? '',
  notice: document.querySelector('.invite-notice')?.textContent ?? null,
  heading: Math.round(document.querySelector('#invite')?.getBoundingClientRect().top ?? -1),
}));
const settle = async () => { await page.waitForLoadState('networkidle'); await page.waitForTimeout(400); };

// The unfiltered list never shows more than ten.
await page.goto(groupPath);
await settle();
const all = await read();
check('the list shows at most ten classmates', all.names.length <= 10, all.names.length);
check('the list says how many are without a group', /students? without a group/.test(all.summary), all.summary);

// Searching for this run's classmates: twelve matches over two pages.
await page.fill('input[name=q]', TAG);
await Promise.all([page.waitForURL(/q=/), page.click('button:has-text("Search")')]);
await settle();
const first = await read();
check('a search shows ten on its first page', first.names.length === 10, first.names.length);
check('the search counts its matches and pages', first.summary.includes('12 matches') && first.summary.includes('page 1 of 2'), first.summary);
check('the list is alphabetical', first.names[0].startsWith(`${TAG} 01`) && first.names[9].startsWith(`${TAG} 10`), first.names.join(' | '));
check('searching lands on the list', first.heading >= 0 && first.heading < 160, first.heading);

await Promise.all([page.waitForURL(/page=2/), page.click('.pager-step[rel=next]')]);
await settle();
const second = await read();
check('the second page holds the rest', second.names.length === 2 && second.names[0].startsWith(`${TAG} 11`), second.names.join(' | '));
check('the second page is marked current', second.current === '2', second.current);
check('paging keeps the search', second.summary.includes('12 matches'), second.summary);
check('paging lands on the list, not the top of the page', second.heading >= 0 && second.heading < 160, second.heading);

await page.goto(`${groupPath}?q=${encodeURIComponent(TAG)}&page=99#invite`);
await settle();
const past = await read();
check('a page past the end shows the last page', past.current === '2' && past.names.length === 2, JSON.stringify(past));

// Inviting: one message at the top, and the row turns into "Invited".
await page.goto(`${groupPath}?q=${encodeURIComponent(TAG)}#invite`);
await settle();
const row = page.locator('.invite-row', { hasText: `${TAG} 01` });
await row.locator('button').click();
await page.waitForSelector('.invite-notice');
await page.waitForTimeout(800);
const after = await read();
check('the invitation is confirmed at the top of the list', after.notice?.includes(`Invitation sent to ${TAG} 01`), after.notice);
check('the message sits above the search, not inside a row', await page.evaluate(() => {
  const notice = document.querySelector('.invite-notice');
  return !notice.closest('.invite-row') && notice.getBoundingClientRect().bottom <= document.querySelector('input[name=q]').getBoundingClientRect().top;
}));
check('the invited classmate is marked, with no second Invite button',
  (await row.locator('.badge.invited').count()) === 1 && (await row.locator('button').count()) === 0);
await page.reload();
await settle();
check('the mark survives a reload', (await page.locator('.invite-row', { hasText: `${TAG} 01` }).locator('.badge.invited').count()) === 1);

// Leave the fixture group as it was.
const pending = page.locator('li', { hasText: `${TAG} 01` }).filter({ has: page.locator('button:has-text("Withdraw")') });
if (await pending.count()) {
  await pending.first().locator('button:has-text("Withdraw")').click();
  await page.waitForTimeout(800);
}

await browser.close();
console.log(`\n${bad} failures`);
process.exit(bad ? 1 : 0);
