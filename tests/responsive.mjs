/**
 * Layout guard. Walks the signed-in pages at four widths and fails on the
 * things that actually break a phone: content wider than the viewport, the
 * tab bar showing on desktop (or missing on a phone), and tap targets that
 * are too small to hit.
 *
 *   npm i -D playwright && npx playwright install chromium
 *   node tests/responsive.mjs            # BASE_URL=… to target a deployment
 */
import { chromium } from "playwright";

const BASE = process.env.BASE_URL ?? "http://127.0.0.1:3000";
const WIDTHS = [320, 390, 768, 1280];
const MIN_TAP = 32;

const results = [];
const fail = (name, detail) => results.push(`FAIL  ${name} :: ${detail}`);
const pass = (name) => results.push(`PASS  ${name}`);

const browser = await chromium.launch();

async function signIn(context, identifier, password) {
  const page = await context.newPage();
  await page.goto(`${BASE}/login`);
  await page.fill("input[name=identifier]", identifier);
  await page.fill("input[name=password]", password);
  await page.click("button[type=submit]");
  await page.waitForURL("**/dashboard", { timeout: 20000 });
  return page;
}

async function audit(page, label, width) {
  await page.waitForLoadState("networkidle").catch(() => {});
  await page.waitForTimeout(250);

  const report = await page.evaluate(
    ({ minTap }) => {
      const overflowing = [...document.querySelectorAll("body *")]
        .filter((el) => {
          const rect = el.getBoundingClientRect();
          if (rect.width === 0 || rect.height === 0) return false;
          return rect.right > window.innerWidth + 1 || rect.left < -1;
        })
        .map((el) => `${el.tagName.toLowerCase()}.${String(el.className || "").split(" ")[0]}`);

      const smallTargets = [...document.querySelectorAll("button, a[href], select, input:not([type=hidden])")]
        .filter((el) => {
          const rect = el.getBoundingClientRect();
          if (rect.width === 0 || rect.height === 0) return false;
          // Links inside flowing prose are not tap targets in their own right.
          if (el.tagName === "A" && el.closest("p, li, .prose, .tiny, .small")) return false;
          return rect.height < minTap;
        })
        .map((el) => `${el.tagName.toLowerCase()}"${(el.textContent || "").trim().slice(0, 18)}"`);

      const bar = document.querySelector(".tabbar");
      return {
        scrollWidth: document.documentElement.scrollWidth,
        innerWidth: window.innerWidth,
        overflowing: [...new Set(overflowing)].slice(0, 6),
        smallTargets: [...new Set(smallTargets)].slice(0, 6),
        tabbarVisible: bar ? getComputedStyle(bar).display !== "none" : false,
      };
    },
    { minTap: MIN_TAP },
  );

  const where = `${label} @${width}`;
  if (report.scrollWidth > report.innerWidth + 1) {
    fail(`${where} fits the viewport`, `${report.scrollWidth}px > ${report.innerWidth}px (${report.overflowing.join(", ")})`);
  } else if (report.overflowing.length) {
    fail(`${where} fits the viewport`, report.overflowing.join(", "));
  } else {
    pass(`${where} fits the viewport`);
  }

  if (report.smallTargets.length) {
    fail(`${where} tap targets`, report.smallTargets.join(", "));
  } else {
    pass(`${where} tap targets`);
  }

  const shouldShowTabs = width < 900;
  if (report.tabbarVisible !== shouldShowTabs) {
    fail(`${where} tab bar`, `visible=${report.tabbarVisible}, expected ${shouldShowTabs}`);
  } else {
    pass(`${where} tab bar`);
  }
}

for (const width of WIDTHS) {
  const mobile = width < 900;
  const context = await browser.newContext({
    viewport: { width, height: 860 },
    deviceScaleFactor: 2,
    isMobile: mobile,
    hasTouch: mobile,
  });

  const student = await signIn(context, "ada@uni.edu", "password123");
  await student.goto(`${BASE}/dashboard`);
  await audit(student, "dashboard", width);
  await student.goto(`${BASE}/groups`);
  await audit(student, "groups", width);

  const groupHref = await student.locator('a[href^="/groups/"]').first().getAttribute("href");
  await student.goto(`${BASE}${groupHref}`);
  await audit(student, "group", width);

  const postHref = await student.locator('a[href^="/posts/"]').first().getAttribute("href");
  if (postHref) {
    await student.goto(`${BASE}${postHref}`);
    await audit(student, "post", width);
    await student.goto(`${BASE}${postHref}/edit`);
    await audit(student, "editor", width);
  }
  await student.goto(`${BASE}/guidelines`);
  await audit(student, "guidelines", width);
  await context.close();

  const adminCtx = await browser.newContext({
    viewport: { width, height: 860 },
    deviceScaleFactor: 2,
    isMobile: mobile,
    hasTouch: mobile,
  });
  const admin = await signIn(adminCtx, "admin323123", "admin323321");
  await admin.goto(`${BASE}/admin`);
  await audit(admin, "admin", width);
  await admin.goto(`${BASE}/evaluations`);
  await audit(admin, "evaluations", width);
  await adminCtx.close();
}

await browser.close();

const failures = results.filter((line) => line.startsWith("FAIL"));
console.log(failures.length ? failures.join("\n") : results.join("\n"));
console.log(`\n${failures.length} failures of ${results.length}`);
process.exit(failures.length ? 1 : 0);
