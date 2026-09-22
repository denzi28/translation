/**
 * The entry mould: ghost text in every field, a refusal to publish until all of
 * it is written, a half-written draft that still saves, and an entry that
 * renders with its author named.
 *
 *   npm i -D playwright && npx playwright install chromium
 *   node tests/entry-mould.mjs
 */
import { chromium } from 'playwright';
const BASE = process.env.BASE_URL ?? 'http://127.0.0.1:3000';
const browser = await chromium.launch();
let bad = 0;
const check = (n, ok, extra='') => { if (!ok) { bad++; console.log(`FAIL ${n} :: ${extra}`); } else console.log(`PASS ${n}`); };

const ctx = await browser.newContext({ baseURL: BASE, viewport: { width: 390, height: 844 }, deviceScaleFactor: 2, isMobile: true, hasTouch: true });
const page = await ctx.newPage();
await page.goto('/login');
await page.fill('input[name=identifier]', 'ada@uni.edu');
await page.fill('input[name=password]', 'password123');
await page.click('button[type=submit]');
await page.waitForURL('**/dashboard', { timeout: 30000 });

await page.goto('/groups');
const groupHref = await page.locator('a[href^="/groups/"]').first().getAttribute('href');
await page.goto(groupHref);
await page.waitForLoadState('networkidle').catch(() => {});

await page.fill('input[name=title]', 'Gönül');
await page.click('button:has-text("New entry")');
await page.waitForURL(/\/posts\/[0-9a-f-]+\/edit$/, { timeout: 30000 });
await page.waitForLoadState('networkidle').catch(() => {});
const editUrl = page.url();
const postId = editUrl.match(/posts\/([0-9a-f-]+)/)[1];

// --- ghost text is present and is not a real value -------------------------
const ph = await page.$$eval('.mould [placeholder]', els =>
  els.map(e => ({ name: e.getAttribute('name'), placeholder: e.getAttribute('placeholder'), value: e.value })));
check('every mould field carries ghost text', ph.length >= 8 && ph.every(f => f.placeholder), JSON.stringify(ph.map(f=>f.name)));
// The word was typed on creation, so it legitimately carries a value; every
// other field must still be genuinely empty behind its ghost text.
const untouched = ph.filter(f => f.name !== 'title');
check('ghost text is not submitted as a value',
  untouched.length >= 7 && untouched.every(f => f.value === ''),
  JSON.stringify(untouched.filter(f => f.value)));
check('the model entry is the ghost text',
  ph.some(f => f.name === 'definition' && f.placeholder.startsWith('A kind wish said to someone')),
  JSON.stringify(ph.find(f=>f.name==='definition')));

// --- cannot publish an unfinished entry ------------------------------------
await page.click('button:has-text("Publish")');
const blocked = await page.waitForSelector('.alert.error', { timeout: 20000 })
  .then(el => el.textContent()).catch(() => '');
check('publishing an unfinished entry is refused', blocked.includes('Complete the entry before publishing'), blocked);
check('it names the missing sections',
  ['Category','Definition','Context','Examples','Attempts','Why untranslatable'].every(s => blocked.includes(s)), blocked);
check('still a draft after a refused publish', !page.url().endsWith(`/posts/${postId}`), page.url());

// --- a draft may be saved half-written -------------------------------------
const DEFINITION = 'The heart as the seat of feeling, longing and conscience.';
await page.fill('textarea[name=definition]', DEFINITION);
await page.click('button:has-text("Save draft")');
// Check what persisted rather than the flash message: a click that beats
// hydration posts the form natively, which saves but renders no confirmation.
await page.waitForTimeout(1500);
await page.goto(editUrl);
await page.waitForLoadState('networkidle').catch(() => {});
const savedDefinition = await page.inputValue('textarea[name=definition]');
check('a half-written entry can still be saved as a draft',
  savedDefinition === DEFINITION, savedDefinition);

// --- fill the mould and publish --------------------------------------------
await page.goto(editUrl);
await page.waitForLoadState('networkidle').catch(() => {});
await page.fill('input[name=pronunciation]', '/ɟœ.nyl/');
await page.fill('input[name=category]', 'emotion concept');
await page.fill('textarea[name=context_notes]', 'Used in affection, grief and moral talk alike; common in songs and idioms.');
await page.fill('textarea[name=examples]', '“Gönlüm razı değil.” (heart-my consenting not) · “Gönül ister ki…” (heart wishes that…)');
await page.fill('textarea[name=attempts]', '(a) “Heart” — literal; loses the moral sense. (b) “Soul” — cultural substitution; too religious.');
await page.fill('textarea[name=why_untranslatable]', 'Emotion concept. English splits this across heart, mind and soul; Turkish keeps one word.');
await page.locator('.editor').click();
await page.keyboard.type('I asked my grandmother and she used it three times in one sentence.');
await page.waitForTimeout(300);
const badge = await page.textContent('.mould .badge');
check('the form reports the entry as complete', badge.trim() === 'Complete', badge);

await page.click('button:has-text("Publish")');
await page.waitForURL(`**/posts/${postId}`, { timeout: 30000 });
await page.waitForLoadState('networkidle').catch(() => {});
const body = await page.textContent('body');
check('published once the mould is complete', body.includes('Published'));
check('entry renders every section',
  ['Definition.','Context.','Examples.','Attempts.','Why untranslatable.'].every(l => body.includes(l)), '');
check('headline shows word, pronunciation and category',
  body.includes('Gönül') && body.includes('/ɟœ.nyl/') && body.includes('emotion concept'));
check('the extra thoughts appear under the entry', body.includes('asked my grandmother'));
check('the post states who posted it', body.includes('Posted by') && body.includes('Ada Lovelace (20210001)'), '');

await page.goto(groupHref);
await page.waitForLoadState('networkidle').catch(() => {});
const listing = await page.textContent('body');
check('the group listing states the author too',
  listing.includes('Gönül') && listing.includes('posted by Ada Lovelace (20210001)'), '');

// --- a published entry cannot be edited back down to blank -----------------
await page.goto(editUrl);
await page.waitForLoadState('networkidle').catch(() => {});
await page.fill('textarea[name=definition]', '');
await page.click('button:has-text("Save draft")');
const guarded = await page.waitForSelector('.alert.error', { timeout: 20000 })
  .then(el => el.textContent()).catch(() => '');
check('a published entry cannot be emptied',
  guarded.includes('has to stay complete') && guarded.includes('Definition'), guarded);


await browser.close();
console.log(`\n${bad} failures`);
process.exit(bad ? 1 : 0);
