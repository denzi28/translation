/**
 * Signing up and signing in. Students come in only through Google and only
 * with a university address; the first time, they add their name and student
 * number, and a refused attempt keeps what they typed. After that Google alone
 * signs them in. Staff sign in from the teacher and admin buttons with a
 * password only.
 *
 * Google is stood in for by /api/auth/test-login (see tests/sign-in.mjs), so
 * run the server with ENABLE_TEST_LOGIN=1.
 *
 *   node tests/registration.mjs          # BASE_URL=… to target a local server
 */
import { chromium } from 'playwright';

const BASE = process.env.BASE_URL ?? 'http://127.0.0.1:3000';
const RUN = Date.now().toString(36).slice(-6);

let bad = 0;
const check = (name, ok, extra = '') => {
  if (!ok) { bad++; console.log(`FAIL ${name} :: ${extra}`); } else console.log(`PASS ${name}`);
};

const browser = await chromium.launch();
const fresh = async () => {
  const ctx = await browser.newContext({ baseURL: BASE });
  return { ctx, page: await ctx.newPage() };
};
const google = (page, email, name = '') =>
  page.goto(`/api/auth/test-login?${new URLSearchParams({ email, name })}`);
const error = (page) => page.locator('.alert.error').first().textContent().catch(() => '');

// ---- the sign-in page offers Google and the staff doors, nothing else -------
{
  const { ctx, page } = await fresh();
  await page.goto('/login');
  check('students get a Google button', (await page.locator('a.google-btn[href="/api/auth/google"]').count()) === 1);
  check('there is no email and password form any more',
    (await page.locator('input[name=identifier], .auth-card input[name=password]').count()) === 0);
  check('there are teacher and admin buttons',
    (await page.locator('.staff-door[aria-label="Teacher sign-in"]').count()) === 1 &&
      (await page.locator('.staff-door[aria-label="Admin sign-in"]').count()) === 1);
  check('the staff usernames are no longer printed on the page', !(await page.content()).includes('devrim.gunay'));
  await page.goto('/register');
  check('the profile step cannot be reached without Google', page.url().includes('/login'), page.url());
  await ctx.close();
}

// ---- only university addresses ----------------------------------------------
for (const [label, email] of [
  ['a Gmail account', `someone.${RUN}@gmail.com`],
  ['a look-alike domain', `someone.${RUN}@ogr.iuc.edu.tr.example.com`],
]) {
  const { ctx, page } = await fresh();
  await google(page, email);
  await page.waitForURL(/login/);
  const message = await error(page);
  check(`${label} is refused`, page.url().includes('error=domain'), page.url());
  check(`${label}: the message names the university address`, message.includes('@ogr.iuc.edu.tr'), message);
  check(`${label}: the message rules out personal accounts`, /Gmail|personal/i.test(message), message);
  await ctx.close();
}

// ---- first sign-in: name and student number ------------------------------------
const email = `ogrenci.${RUN}@ogr.iuc.edu.tr`;
const { ctx, page } = await fresh();
await google(page, email, 'Ayşe Yılmaz');
await page.waitForURL(/register/);
check('a new student is asked for their details', page.url().includes('/register'), page.url());
check('the page says which Google account they used', (await page.locator('.auth-card').textContent()).includes(email));
check('the name Google gave is filled in', (await page.inputValue('input[name=full_name]')) === 'Ayşe Yılmaz');

await page.fill('input[name=full_name]', 'Ayşe Yılmaz');
await page.fill('input[name=student_number]', '1');
await page.click('button[type=submit]');
await page.waitForSelector('.alert.error');
check('a malformed student number is refused', (await error(page)).includes('Student number'), await error(page));
check('the name survives the refusal', (await page.inputValue('input[name=full_name]')) === 'Ayşe Yılmaz');
check('the number survives the refusal', (await page.inputValue('input[name=student_number]')) === '1');

await page.fill('input[name=student_number]', `${RUN}77`);
await Promise.all([page.waitForURL(/dashboard/, { timeout: 30000 }), page.click('button[type=submit]')]);
check('with a name and number the account is created', page.url().includes('/dashboard'), page.url());
check('the account shows the name and number', (await page.textContent('.whoami')).includes(`Ayşe Yılmaz (${RUN}77)`));
await Promise.all([page.waitForURL(/login/), page.click('text=Sign out')]);

await google(page, email);
await page.waitForURL(/dashboard/);
check('next time Google alone signs them in', page.url().includes('/dashboard'), page.url());
await ctx.close();

// A second student cannot take the same number.
{
  const other = await fresh();
  await google(other.page, `other.${RUN}@ogr.iuc.edu.tr`);
  await other.page.waitForURL(/register/);
  await other.page.fill('input[name=full_name]', 'Someone Else');
  await other.page.fill('input[name=student_number]', `${RUN}77`);
  await other.page.click('button[type=submit]');
  await other.page.waitForSelector('.alert.error');
  check('a student number already in use is refused', (await error(other.page)).includes('already registered'), await error(other.page));
  await other.ctx.close();
}

// A name typed twice is saved once.
{
  const twice = await fresh();
  await google(twice.page, `twice.${RUN}@ogr.iuc.edu.tr`, 'Beyza Diker');
  await twice.page.waitForURL(/register/);
  await twice.page.fill('input[name=full_name]', 'beyza diker diker');
  await twice.page.fill('input[name=student_number]', `${RUN}88`);
  await Promise.all([twice.page.waitForURL(/dashboard/, { timeout: 30000 }), twice.page.click('button[type=submit]')]);
  const shown = await twice.page.textContent('.whoami');
  check('a repeated word in a name is saved once', shown.includes(`beyza diker (${RUN}88)`) && !shown.includes('diker diker'), shown);
  await twice.ctx.close();
}

// ---- staff: the button picks the role, the password the account --------------
{
  const s = await fresh();
  await s.page.goto('/login');
  await s.page.click('.staff-door[aria-label="Admin sign-in"]');
  check('the admin button asks for a password', await s.page.locator('.staff-dialog[open] input[name=password]').isVisible());
  await s.page.fill('.staff-dialog input[name=password]', 'not-the-password');
  await s.page.click('.staff-dialog button[type=submit]');
  await s.page.waitForSelector('.staff-dialog .alert.error');
  check('a wrong password is refused', (await error(s.page)).includes('Incorrect password'), await error(s.page));
  await s.page.fill('.staff-dialog input[name=password]', 'admin323321');
  await Promise.all([s.page.waitForURL(/dashboard/, { timeout: 30000 }), s.page.click('.staff-dialog button[type=submit]')]);
  check('the right password opens the admin account', (await s.page.textContent('.whoami')).includes('Admin'));
  await Promise.all([s.page.waitForURL(/login/), s.page.click('text=Sign out')]);

  await s.page.click('.staff-door[aria-label="Teacher sign-in"]');
  await s.page.fill('.staff-dialog input[name=password]', 'admin323321');
  await s.page.click('.staff-dialog button[type=submit]');
  await s.page.waitForSelector('.staff-dialog .alert.error');
  check('the admin password does not open the teacher account', (await error(s.page)).includes('Incorrect password'));
  await s.page.fill('.staff-dialog input[name=password]', 'devrim.gunay.123');
  await Promise.all([s.page.waitForURL(/dashboard/, { timeout: 30000 }), s.page.click('.staff-dialog button[type=submit]')]);
  check('the teacher password opens the teacher account', (await s.page.textContent('.whoami')).includes('Teacher'));
  await s.ctx.close();
}

await browser.close();
console.log(`\n${bad} failures`);
process.exit(bad ? 1 : 0);
