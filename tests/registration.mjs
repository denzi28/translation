/**
 * Registration rules: only university addresses may sign up, and a rejected
 * attempt gives the form back with everything except the passwords intact.
 *
 *   npm i -D playwright && npx playwright install chromium
 *   node tests/registration.mjs
 */
import { chromium } from 'playwright';

const BASE = process.env.BASE_URL ?? 'http://127.0.0.1:3000';
const RUN = Date.now().toString(36).slice(-6);

let bad = 0;
const check = (name, ok, extra = '') => {
  if (!ok) { bad++; console.log(`FAIL ${name} :: ${extra}`); } else console.log(`PASS ${name}`);
};

const browser = await chromium.launch();

async function attempt({ name, number, email, password, confirm }) {
  const ctx = await browser.newContext({ baseURL: BASE });
  const page = await ctx.newPage();
  await page.goto('/register');
  await page.fill('input[name=full_name]', name);
  await page.fill('input[name=student_number]', number);
  await page.fill('input[name=email]', email);
  await page.fill('input[name=password]', password);
  await page.fill('input[name=confirm]', confirm ?? password);
  await page.click('button[type=submit]');
  // Wait for an outcome rather than a fixed pause: a successful sign-up
  // redirects, a refused one renders an error.
  await Promise.race([
    page.waitForURL('**/dashboard', { timeout: 30000 }).catch(() => {}),
    page.waitForSelector('.alert.error', { timeout: 30000 }).catch(() => {}),
  ]);
  await page.waitForTimeout(400);
  const state = {
    url: page.url(),
    error: await page.locator('.alert.error').first().textContent().catch(() => ''),
    values: {
      name: await page.inputValue('input[name=full_name]').catch(() => null),
      number: await page.inputValue('input[name=student_number]').catch(() => null),
      email: await page.inputValue('input[name=email]').catch(() => null),
      password: await page.inputValue('input[name=password]').catch(() => null),
      confirm: await page.inputValue('input[name=confirm]').catch(() => null),
    },
  };
  await ctx.close();
  return state;
}

// ---- a personal address is refused, with a reminder ------------------------
const gmail = await attempt({
  name: 'Personal Mail', number: `${RUN}01`, email: `someone.${RUN}@gmail.com`, password: 'password123',
});
check('a gmail address cannot register', gmail.error.includes('university email address'), gmail.error);
check('the error names the required domain', gmail.error.includes('iuc.edu.tr'), gmail.error);
check('the error mentions personal addresses', /Gmail|personal address/i.test(gmail.error), gmail.error);
check('it stays on the register page', gmail.url.includes('/register'), gmail.url);

// ---- the rejected form keeps everything but the passwords ------------------
check('full name kept after a refusal', gmail.values.name === 'Personal Mail', gmail.values.name);
check('student number kept after a refusal', gmail.values.number === `${RUN}01`, gmail.values.number);
check('email kept after a refusal', gmail.values.email === `someone.${RUN}@gmail.com`, gmail.values.email);
check('password box cleared', gmail.values.password === '', JSON.stringify(gmail.values.password));
check('confirm box cleared', gmail.values.confirm === '', JSON.stringify(gmail.values.confirm));

// ---- a mismatched password clears only the passwords -----------------------
const mismatch = await attempt({
  name: 'Mismatch Test', number: `${RUN}02`, email: `mismatch.${RUN}@ogr.iuc.edu.tr`,
  password: 'password123', confirm: 'password124',
});
check('a mismatched password is refused', mismatch.error.includes('do not match'), mismatch.error);
check('mismatch keeps the full name', mismatch.values.name === 'Mismatch Test', mismatch.values.name);
check('mismatch keeps the student number', mismatch.values.number === `${RUN}02`, mismatch.values.number);
check('mismatch keeps the email', mismatch.values.email === `mismatch.${RUN}@ogr.iuc.edu.tr`, mismatch.values.email);
check('mismatch clears both password boxes',
  mismatch.values.password === '' && mismatch.values.confirm === '',
  JSON.stringify([mismatch.values.password, mismatch.values.confirm]));

// ---- an address that only looks like the university one --------------------
const spoof = await attempt({
  name: 'Spoof Domain', number: `${RUN}03`, email: `x.${RUN}@iuc.edu.tr.example.com`, password: 'password123',
});
check('a domain that merely contains iuc.edu.tr is refused',
  spoof.error.includes('university email address'), spoof.error);

// ---- real university addresses are accepted --------------------------------
const student = await attempt({
  name: 'Ogrenci Test', number: `${RUN}04`, email: `ogrenci.${RUN}@ogr.iuc.edu.tr`, password: 'password123',
});
check('an @ogr.iuc.edu.tr address registers', student.url.includes('/dashboard'),
  `${student.url} ${student.error}`);

const staffish = await attempt({
  name: 'Bare Domain', number: `${RUN}05`, email: `bare.${RUN}@iuc.edu.tr`, password: 'password123',
});
check('a bare @iuc.edu.tr address registers', staffish.url.includes('/dashboard'),
  `${staffish.url} ${staffish.error}`);

// ---- a failed sign-in keeps the identifier too ------------------------------
{
  const ctx = await browser.newContext({ baseURL: BASE });
  const page = await ctx.newPage();
  await page.goto('/login');
  await page.fill('input[name=identifier]', `ogrenci.${RUN}@ogr.iuc.edu.tr`);
  await page.fill('input[name=password]', 'wrong-password');
  await page.click('button[type=submit]');
  await page.waitForTimeout(2500);
  check('a failed sign-in keeps the email typed',
    (await page.inputValue('input[name=identifier]')) === `ogrenci.${RUN}@ogr.iuc.edu.tr`,
    await page.inputValue('input[name=identifier]'));
  check('a failed sign-in clears the password',
    (await page.inputValue('input[name=password]')) === '');
  await ctx.close();
}

await browser.close();
console.log(`\n${bad} failures`);
process.exit(bad ? 1 : 0);
