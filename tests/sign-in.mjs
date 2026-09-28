/**
 * How the tests sign in now that students use Google. Staff go through the
 * teacher and admin buttons on the sign-in page, as people do. Students go
 * through /api/auth/test-login, which stands in for Google and then runs the
 * same code a real Google sign-in does; it exists only when the server runs
 * with ENABLE_TEST_LOGIN=1, never on Vercel.
 */
const STAFF = { admin323123: 'Admin', 'devrim.gunay': 'Teacher' };

export async function signIn(page, identifier, password, base = '') {
  const door = STAFF[identifier];
  if (door) {
    await page.goto(`${base}/login`);
    await page.click(`.staff-door[aria-label="${door} sign-in"]`);
    await page.fill('.staff-dialog input[name=password]', password);
    await Promise.all([
      page.waitForURL(/dashboard/, { timeout: 30000 }),
      page.click('.staff-dialog button[type=submit]'),
    ]);
  } else {
    await page.goto(`${base}/api/auth/test-login?email=${encodeURIComponent(identifier)}`);
    await page.waitForURL(/dashboard/, { timeout: 30000 });
  }
}

/** A student's first sign-in: Google, then their name and student number. */
export async function registerStudent(page, { name, number, email, googleName = '' }, base = '') {
  const q = new URLSearchParams({ email, name: googleName });
  await page.goto(`${base}/api/auth/test-login?${q}`);
  await page.waitForURL(/register/, { timeout: 30000 });
  await page.fill('input[name=full_name]', name);
  await page.fill('input[name=student_number]', number);
  await Promise.all([page.waitForURL(/dashboard/, { timeout: 30000 }), page.click('button[type=submit]')]);
}
