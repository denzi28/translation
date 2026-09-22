/**
 * End-to-end check of the rules that matter: registration identity, the
 * one-group-per-student and 1–5 member limits, editor formatting, read-only
 * access for other groups, feedback privacy, and the guidelines PDF.
 *
 * Needs a running app and a database:
 *
 *   npm i -D playwright && npx playwright install chromium
 *   DATABASE_URL=… npm run db:setup && npm run build && npm start
 *   node tests/e2e.mjs                    # or BASE_URL=… node tests/e2e.mjs
 *
 * It creates real students, groups and posts, so point it at a scratch
 * database rather than the live course one.
 */
import { chromium } from 'playwright';

const BASE = process.env.BASE_URL ?? 'http://127.0.0.1:3000';
// Every run uses fresh identities so the suite can be replayed against the same
// database without a reset.
const RUN = Date.now().toString(36).slice(-6);
const num = (n) => `${RUN}${n}`;
const mail = (n) => `s${n}.${RUN}@uni.edu`;
const results = [];
function check(name, cond, extra = '') {
  results.push(`${cond ? 'PASS' : 'FAIL'}  ${name}${extra && !cond ? ' :: ' + extra : ''}`);
}

const browser = await chromium.launch();

async function session() {
  const ctx = await browser.newContext({ baseURL: BASE });
  const page = await ctx.newPage();
  page.on('pageerror', e => console.log('PAGEERROR', e.message));
  return { ctx, page };
}

/** Pages stream a skeleton first, so wait for the real content to land. */
async function go(page, url) {
  await page.goto(url);
  await page.waitForLoadState('networkidle').catch(() => {});
}

async function register(page, name, num, email, pw = 'password123') {
  await page.goto('/register');
  await page.fill('input[name=full_name]', name);
  await page.fill('input[name=student_number]', num);
  await page.fill('input[name=email]', email);
  await page.fill('input[name=password]', pw);
  await page.fill('input[name=confirm]', pw);
  await page.click('button[type=submit]');
  await page.waitForURL('**/dashboard', { timeout: 30000 });
}

async function login(page, id, pw) {
  await page.goto('/login');
  await page.fill('input[name=identifier]', id);
  await page.fill('input[name=password]', pw);
  await page.click('button[type=submit]');
  await page.waitForURL('**/dashboard', { timeout: 30000 });
}

// ---- 1. student A registers, creates a group -------------------------------
const a = await session();
await register(a.page, 'Ada Lovelace', num(1), mail(1));
check('student A registered', a.page.url().includes('/dashboard'));
check('display name shows name + student number',
  (await a.page.textContent('.whoami')).includes(`Ada Lovelace (${num(1)})`),
  await a.page.textContent('.whoami'));

await a.page.goto('/my-group');
await a.page.fill('input[name=name]', `Team Aurora ${RUN}`);
await a.page.fill('textarea[name=description]', 'Our final project blog.');
await a.page.click('button:has-text("Create group")');
await a.page.waitForURL(/\/groups\/[0-9a-f-]+$/, { timeout: 15000 });
const groupUrl = a.page.url();
check('group created', /\/groups\//.test(groupUrl));
const inviteCode = (await a.page.textContent('.mono')).trim();
check('invite code shown to member', /^[0-9A-F]{8}$/.test(inviteCode), inviteCode);

// ---- 2. student B registers and joins by code ------------------------------
const b = await session();
await register(b.page, 'Grace Hopper', num(2), mail(2));
await b.page.goto('/my-group');
await b.page.fill('input[name=invite_code]', inviteCode);
await b.page.click('button:has-text("Join group")');
await b.page.waitForURL(/\/groups\//, { timeout: 15000 });
check('student B joined by invite code', b.page.url() === groupUrl, b.page.url());

// ---- 3. one-group-only rule ------------------------------------------------
await b.page.goto('/my-group');
await b.page
  .waitForURL((u) => !u.pathname.startsWith('/my-group'), { timeout: 15000 })
  .catch(() => {});
check('member redirected away from /my-group', b.page.url() === groupUrl, b.page.url());

// ---- 4. capacity: fill to 5 then try a 6th ---------------------------------
const extras = [];
for (let i = 3; i <= 6; i++) {
  const s = await session();
  await register(s.page, `Student ${i}`, num(i), mail(i));
  extras.push(s);
}
for (let i = 0; i < 3; i++) {
  await extras[i].page.goto('/my-group');
  await extras[i].page.fill('input[name=invite_code]', inviteCode);
  await extras[i].page.click('button:has-text("Join group")');
  await extras[i].page.waitForURL(/\/groups\//, { timeout: 15000 });
}
await go(a.page, groupUrl);
check('group reports 5 of 5 members',
  (await a.page.textContent('.page-head')).includes('5 of 5'),
  await a.page.textContent('.page-head'));

const sixth = extras[3];
await sixth.page.goto('/my-group');
await sixth.page.fill('input[name=invite_code]', inviteCode);
await sixth.page.click('button:has-text("Join group")');
await sixth.page.waitForTimeout(2500);
const sixthErr = await sixth.page.textContent('body');
check('6th member refused', sixthErr.includes('maximum of 5 members'), sixthErr.slice(0, 200));

// ---- 5. blog post: create, format, publish ---------------------------------
await go(a.page, groupUrl);
await a.page.fill('input[name=title]', 'Week 1 report');
await a.page.click('button:has-text("New post")');
await a.page.waitForURL(/\/posts\/[0-9a-f-]+\/edit$/, { timeout: 15000 });
const editUrl = a.page.url();
const postId = editUrl.match(/posts\/([0-9a-f-]+)/)[1];

await a.page.click('.editor');
await a.page.keyboard.type('Our project introduction.');
await a.page.keyboard.press('Control+A');
await a.page.click('button[title^="Bold"]');
await a.page.click('.editor');
await a.page.keyboard.press('End');
await a.page.keyboard.press('Enter');
await a.page.click('button[title="Bulleted list"]');
await a.page.keyboard.type('First milestone');
await a.page.waitForTimeout(300);
await a.page.click('button:has-text("Save draft")');
const savedNotice = await a.page
  .waitForSelector('.alert.ok', { timeout: 20000 })
  .then((el) => el.textContent())
  .catch(() => '');
check('draft saved', savedNotice.includes('Draft saved'), savedNotice);

await go(a.page, `/posts/${postId}`);
const draftBody = await a.page.innerHTML('.prose');
check('bold formatting stored', /font-weight:\s*bold|<b>|<strong>/i.test(draftBody), draftBody.slice(0,200));
check('list stored', /<ul>/i.test(draftBody), draftBody.slice(0, 200));

await go(a.page, editUrl);
await a.page.waitForTimeout(500);
await a.page.click('button:has-text("Publish")');
await a.page.waitForURL(`**/posts/${postId}`, { timeout: 30000 });
await a.page.waitForLoadState('networkidle').catch(() => {});
check('post published',
  (await a.page.textContent('main .page-head .badge')).includes('Published'));

// ---- 6. read-only for other students ---------------------------------------
await go(sixth.page, `/posts/${postId}`);
const outsiderBody = await sixth.page.textContent('body');
check('outsider can read published post', outsiderBody.includes('Our project introduction'));
check('outsider sees read-only notice', outsiderBody.includes("another group"));
check('outsider has no edit button', !(await sixth.page.locator('a:has-text("Open editor")').count()));
await sixth.page.goto(`/posts/${postId}/edit`);
await sixth.page.waitForTimeout(1500);
check('outsider redirected away from editor', !sixth.page.url().endsWith('/edit'), sixth.page.url());

// ---- 7. teacher: login, grade, privacy -------------------------------------
const t = await session();
await login(t.page, 'devrim.gunay', 'devrim.gunay.123');
check('teacher signed in', (await t.page.textContent('.whoami')).includes('Teacher'));
await t.page.goto(groupUrl);
await t.page.fill('input[name=grade]', '88');
await t.page.fill('textarea[name=comment]', 'Strong start; add references.');
await t.page.click('button:has-text("Save feedback")');
const savedGrade = await t.page
  .waitForSelector('#evaluation .alert.ok', { timeout: 20000 })
  .then((el) => el.textContent())
  .catch(() => '');
check('teacher saved grade',
  savedGrade.includes('Evaluation saved') && (await t.page.textContent('body')).includes('88'),
  savedGrade);
check('teacher cannot edit the blog',
  !(await t.page.locator('button:has-text("New post")').count()));

await go(a.page, groupUrl);
const memberBody = await a.page.textContent('body');
check('group member sees own grade', memberBody.includes('88') && memberBody.includes('add references'));

// ---- 7b. feedback with no grade at all -------------------------------------
await go(t.page, groupUrl);
await t.page.fill('textarea[name=comment]', 'Nice structure — no grade yet, keep going.');
await t.page.click('button:has-text("Save feedback")');
// Assert on what was stored, not on the flash message: if the click lands
// before hydration the form posts natively, which still saves but renders no
// confirmation.
const landed = await t.page
  .waitForFunction(
    () => document.querySelector('#evaluation')?.textContent?.includes('no grade yet, keep going'),
    null,
    { timeout: 30000 },
  )
  .then(() => true)
  .catch(() => false);
check('teacher can leave feedback without a grade', landed);
const panel = await t.page.textContent('#evaluation');
check('comment-only entry is marked as carrying no grade',
  panel.includes('Comment only'), panel.slice(0, 200));

await go(a.page, groupUrl);
check('group members see the ungraded feedback',
  (await a.page.textContent('body')).includes('no grade yet, keep going'));

await go(sixth.page, groupUrl);
const otherBody = await sixth.page.textContent('body');
check('other students still cannot see ungraded feedback',
  !otherBody.includes('no grade yet, keep going'));
check('other student cannot see the grade', !otherBody.includes('add references'), otherBody.slice(0, 300));
check('other student sees no evaluation panel', !otherBody.includes('Teacher evaluation'));

// ---- 8. admin --------------------------------------------------------------
const ad = await session();
await login(ad.page, 'admin323123', 'admin323321');
check('admin signed in', (await ad.page.textContent('.whoami')).includes('Admin'));
await go(ad.page, '/admin');
const adminBody = await ad.page.textContent('body');
check('admin lists accounts', adminBody.includes('Ada Lovelace') && adminBody.includes('Team Aurora'));
await go(ad.page, groupUrl);
check('admin sees private feedback', (await ad.page.textContent('body')).includes('add references'));

// ---- 9. guidelines PDF -----------------------------------------------------
const pdf = Buffer.from(
  '%PDF-1.4\n1 0 obj<</Type/Catalog/Pages 2 0 R>>endobj\n2 0 obj<</Type/Pages/Kids[3 0 R]/Count 1>>endobj\n' +
  '3 0 obj<</Type/Page/Parent 2 0 R/MediaBox[0 0 200 200]>>endobj\ntrailer<</Root 1 0 R>>\n%%EOF\n');
await t.page.goto('/guidelines');
await t.page.setInputFiles('input[name=file]', { name: 'guidelines.pdf', mimeType: 'application/pdf', buffer: pdf });
await t.page.click('button:has-text("guidelines")');
const uploadNotice = await t.page
  .waitForSelector('.alert.ok', { timeout: 20000 })
  .then((el) => el.textContent())
  .catch(() => '');
check('teacher uploaded the PDF', uploadNotice.includes('Uploaded'), uploadNotice);

// Fetched from inside the page: Playwright's APIRequestContext does not send
// the SameSite=Lax session cookie, so it would report a false 401.
await sixth.page.goto('/guidelines');
const pdfRes = await sixth.page.evaluate(async () => {
  const res = await fetch('/api/guidelines/file');
  const bytes = new Uint8Array(await res.arrayBuffer());
  return { status: res.status, type: res.headers.get('content-type'),
           head: String.fromCharCode(...bytes.slice(0, 5)) };
});
check('student can read the PDF', pdfRes.status === 200 && pdfRes.head === '%PDF-'
  && pdfRes.type === 'application/pdf', JSON.stringify(pdfRes));
const dl = await sixth.page.evaluate(async () =>
  (await fetch('/api/guidelines/file?download=1')).headers.get('content-disposition'));
check('download link sends an attachment', String(dl).startsWith('attachment'), String(dl));

const anonCtx = await browser.newContext({ baseURL: BASE });
const anonPage = await anonCtx.newPage();
await anonPage.goto('/login');
const anonRes = await anonPage.evaluate(async () => (await fetch('/api/guidelines/file')).status);
check('signed-out request is rejected', anonRes === 401, String(anonRes));

check('student sees no upload form', !(await sixth.page.locator('input[name=file]').count()));

// ---- 10. leaving frees the student -----------------------------------------
await b.page.goto(groupUrl);
b.page.on('dialog', d => d.accept());
await b.page.click('button:has-text("Leave group")');
await b.page.waitForTimeout(2500);
await go(b.page, '/my-group');
check('student can join again after leaving',
  (await b.page.textContent('body')).includes('Create a group'), b.page.url());

await browser.close();
console.log(results.join('\n'));
console.log('\n' + results.filter(r => r.startsWith('FAIL')).length + ' failures of ' + results.length);
