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

async function audit(page, label, width, expectedTabs) {
  await page.waitForLoadState("networkidle").catch(() => {});
  await page.waitForTimeout(250);

  const report = await page.evaluate(
    ({ minTap }) => {
      const tabs = [...document.querySelectorAll(".tabbar a")].map((a) => ({
        label: a.textContent.trim(),
        right: Math.round(a.getBoundingClientRect().right),
      }));
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

      // Adjacent top-level blocks that touch read as one overlapping slab.
      const blocks = [...(document.querySelector("main.page")?.children ?? [])];
      const touching = [];
      for (let i = 1; i < blocks.length; i++) {
        const above = blocks[i - 1].getBoundingClientRect();
        const below = blocks[i].getBoundingClientRect();
        if (above.height === 0 || below.height === 0) continue;
        const gap = Math.round(below.top - above.bottom);
        if (gap < 8) {
          touching.push(`${blocks[i - 1].className || blocks[i - 1].tagName} / ${blocks[i].className || blocks[i].tagName} = ${gap}px`);
        }
      }

      const bar = document.querySelector(".tabbar");
      return {
        tabs,
        touching,
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

  // The bug this guards against: one long unbreakable token (an email, an
  // invite code) raises the page's minimum content width, the browser widens
  // the layout viewport past the screen, and anything fixed to the viewport —
  // the tab bar — hangs off the right edge. Comparing against innerWidth alone
  // misses it, because innerWidth is what expanded.
  if (report.innerWidth !== width) {
    fail(`${where} layout viewport`, `innerWidth=${report.innerWidth}, expected ${width}`);
  } else {
    pass(`${where} layout viewport`);
  }

  if (report.scrollWidth > report.innerWidth + 1) {
    fail(`${where} fits the viewport`, `${report.scrollWidth}px > ${report.innerWidth}px (${report.overflowing.join(", ")})`);
  } else if (report.overflowing.length) {
    fail(`${where} fits the viewport`, report.overflowing.join(", "));
  } else {
    pass(`${where} fits the viewport`);
  }

  if (report.touching.length) {
    fail(`${where} blocks are separated`, report.touching.join(", "));
  } else {
    pass(`${where} blocks are separated`);
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

  if (shouldShowTabs && expectedTabs) {
    const labels = report.tabs.map((t) => t.label);
    const missing = expectedTabs.filter((t) => !labels.includes(t));
    const clipped = report.tabs.filter((t) => t.right > report.innerWidth + 1).map((t) => t.label);
    if (missing.length || clipped.length) {
      fail(
        `${where} every tab reachable`,
        [missing.length ? `missing ${missing.join(", ")}` : "", clipped.length ? `off screen: ${clipped.join(", ")}` : ""]
          .filter(Boolean)
          .join("; "),
      );
    } else {
      pass(`${where} every tab reachable`);
    }
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

  const STUDENT_TABS = ["Home", "Groups", "My group", "Guidelines"];
  const ADMIN_TABS = ["Home", "Groups", "Grades", "Guidelines", "Admin"];

  const student = await signIn(context, "ada@uni.edu", "password123");
  await student.goto(`${BASE}/dashboard`);
  await audit(student, "dashboard", width, STUDENT_TABS);
  await student.goto(`${BASE}/groups`);
  await audit(student, "groups", width, STUDENT_TABS);

  const groupHref = await student.locator('a[href^="/groups/"]').first().getAttribute("href");
  await student.goto(`${BASE}${groupHref}`);
  await audit(student, "group", width, STUDENT_TABS);

  const postHref = await student.locator('a[href^="/posts/"]').first().getAttribute("href");
  if (postHref) {
    await student.goto(`${BASE}${postHref}`);
    await audit(student, "post", width, STUDENT_TABS);
    await student.goto(`${BASE}${postHref}/edit`);
    await audit(student, "editor", width, STUDENT_TABS);
  }
  await student.goto(`${BASE}/guidelines`);
  await audit(student, "guidelines", width, STUDENT_TABS);
  await context.close();

  const adminCtx = await browser.newContext({
    viewport: { width, height: 860 },
    deviceScaleFactor: 2,
    isMobile: mobile,
    hasTouch: mobile,
  });
  const admin = await signIn(adminCtx, "admin323123", "admin323321");
  await admin.goto(`${BASE}/admin`);
  await audit(admin, "admin", width, ADMIN_TABS);
  await admin.goto(`${BASE}/evaluations`);
  await audit(admin, "evaluations", width, ADMIN_TABS);
  await adminCtx.close();
}

await browser.close();

const failures = results.filter((line) => line.startsWith("FAIL"));
console.log(failures.length ? failures.join("\n") : results.join("\n"));
console.log(`\n${failures.length} failures of ${results.length}`);
process.exit(failures.length ? 1 : 0);
