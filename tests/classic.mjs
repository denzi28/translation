/**
 * The classical theme (Ionic columns, lanterns, Greek key frieze, classical
 * type) while it is on preview: admins see it, teachers and students see the
 * current design and download none of its images or fonts. For the admin,
 * the columns stand in the margins without touching the content, carry the
 * header, fit any window height, rise with the page at a fraction of its speed
 * (held still under reduced motion), and light their lanterns in the dark
 * theme.
 *
 *   node tests/classic.mjs          # BASE_URL=… to target a deployment
 */
import { chromium } from 'playwright';

const BASE = process.env.BASE_URL ?? 'http://127.0.0.1:3000';
const RUN = Date.now().toString(36);
let bad = 0;
const check = (name, ok, extra = '') => {
  if (!ok) { bad++; console.log(`FAIL ${name} :: ${extra}`); } else console.log(`PASS ${name}`);
};

const browser = await chromium.launch();

async function signedIn(identifier, password, viewport, theme = 'light') {
  const ctx = await browser.newContext({ baseURL: BASE, viewport, reducedMotion: 'reduce' });
  await ctx.addInitScript((t) => localStorage.setItem('classroom-theme', t), theme);
  const page = await ctx.newPage();
  const requests = [];
  page.on('request', (r) => requests.push(r.url()));
  await page.goto('/login');
  await page.fill('input[name=identifier]', identifier);
  await page.fill('input[name=password]', password);
  await Promise.all([page.waitForURL(/dashboard/), page.click('button[type=submit]')]);
  await page.waitForLoadState('networkidle');
  await page.waitForTimeout(400);
  return { ctx, page, requests };
}

const geometry = (page) => page.evaluate(() => {
  const box = (sel, root = document) => {
    const el = root.querySelector(sel);
    if (!el) return null;
    const r = el.getBoundingClientRect();
    return { top: r.top, bottom: r.bottom, left: r.left, right: r.right, width: r.width, height: r.height };
  };
  const main = document.querySelector('main.page');
  const pad = parseFloat(getComputedStyle(main).paddingLeft);
  const content = main.getBoundingClientRect();
  const columns = [...document.querySelectorAll('.column')].map((col) => ({
    ...col.getBoundingClientRect().toJSON(),
    parts: [...col.querySelector('.col-day').children].map((p) => { const r = p.getBoundingClientRect(); return { top: r.top, bottom: r.bottom }; }),
  }));
  const nav = document.querySelector('.nav');
  return {
    topbarBottom: box('.topbar').bottom,
    contentLeft: content.left + pad,
    contentRight: content.right - pad,
    columns,
    colonnadeShown: getComputedStyle(document.querySelector('.colonnade') ?? document.body).display !== 'none'
      && !!document.querySelector('.colonnade'),
    navOverflow: nav ? nav.scrollWidth - nav.clientWidth : 0,
    pageOverflow: document.documentElement.scrollWidth - window.innerWidth,
    h1Font: getComputedStyle(document.querySelector('h1')).fontFamily,
    viewportHeight: window.innerHeight,
  };
});

// ---- admins see the columns -------------------------------------------------
for (const [w, h] of [[1340, 800], [1440, 900], [1920, 1080], [2560, 1440], [1920, 640]]) {
  const { ctx, page } = await signedIn('admin323123', 'admin323321', { width: w, height: h });
  const g = await geometry(page);
  const label = `${w}x${h}`;
  check(`${label}: two columns stand in the margins`, g.colonnadeShown && g.columns.length === 2);
  const frieze = 15;
  for (const [i, col] of g.columns.entries()) {
    const side = i === 0 ? 'left' : 'right';
    check(`${label}: the ${side} capital sits under the frieze`,
      Math.abs(col.top - (g.topbarBottom + frieze)) <= 1, `${col.top} vs ${g.topbarBottom + frieze}`);
    check(`${label}: the ${side} base stands on the bottom of the window`,
      Math.abs(col.parts[4].bottom - g.viewportHeight) <= 1, `${col.parts[4].bottom} vs ${g.viewportHeight}`);
    const gaps = col.parts.slice(1).map((p, k) => Math.abs(p.top - col.parts[k].bottom));
    check(`${label}: the ${side} column's pieces meet without a gap`, Math.max(...gaps) < 0.51, gaps.join(','));
    check(`${label}: the ${side} lantern section fits above the base`,
      col.parts[3].bottom - col.parts[3].top >= 0, JSON.stringify(col.parts));
    const clear = side === 'left' ? g.contentLeft - col.right : col.left - g.contentRight;
    check(`${label}: the ${side} column keeps clear of the content`, clear >= 0, `${clear}px`);
    check(`${label}: the ${side} column stays on screen`, col.left >= 0 && col.right <= w, `${col.left}..${col.right}`);
  }
  check(`${label}: every header link is in view`, g.navOverflow <= 0, `${g.navOverflow}px hidden`);
  check(`${label}: no sideways scroll`, g.pageOverflow <= 0, `${g.pageOverflow}px`);
  check(`${label}: headings use the classical face`, /Cormorant/i.test(g.h1Font), g.h1Font);
  await ctx.close();
}

// ---- the columns rise with the page, slower than it -----------------------
for (const motion of ['no-preference', 'reduce']) {
  const ctx = await browser.newContext({ baseURL: BASE, viewport: { width: 1600, height: 900 }, reducedMotion: motion });
  const page = await ctx.newPage();
  await page.goto('/login');
  await page.fill('input[name=identifier]', 'admin323123');
  await page.fill('input[name=password]', 'admin323321');
  await Promise.all([page.waitForURL(/dashboard/), page.click('button[type=submit]')]);
  await page.waitForLoadState('networkidle');
  // A long page whatever the database holds; the columns re-measure on their own.
  await page.evaluate(() => {
    const tall = document.createElement('div');
    tall.style.height = '4000px';
    document.querySelector('main.page').append(tall);
  });
  await page.waitForTimeout(400);
  const read = () => page.evaluate(() => {
    const col = document.querySelector('.column-left');
    const parts = [...col.querySelector('.col-day').children];
    return {
      top: col.getBoundingClientRect().top,
      base: parts.at(-1).getBoundingClientRect().bottom,
      lanterns: col.querySelectorAll('.col-day .col-lantern').length,
      max: document.documentElement.scrollHeight - innerHeight,
      overscroll: getComputedStyle(document.documentElement).overscrollBehaviorY,
    };
  });
  const scroll = async (y) => {
    await page.evaluate((y) => window.scrollTo({ top: y, behavior: 'instant' }), y);
    await page.waitForTimeout(250);
    return read();
  };
  const start = await scroll(0);
  const mid = await scroll(1000);
  const end = await scroll(1e6);
  if (motion === 'no-preference') {
    check('parallax: the capital starts under the frieze', Math.abs(start.top - 78) <= 1, start.top);
    check('parallax: the columns rise at 0.55 of the scroll',
      Math.abs(start.top - mid.top - 550) <= 1.5, `${start.top - mid.top}px for 1000px`);
    check('parallax: the base reaches the bottom of the window at the end of the page',
      Math.abs(end.base - 900) <= 1.5, `${end.base}`);
    check('parallax: a long page passes more than one lantern', start.lanterns >= 2, start.lanterns);
    check('the window does not bounce past the ends of the page', start.overscroll === 'none', start.overscroll);
  } else {
    check('reduced motion: the columns stay still while scrolling', Math.abs(start.top - mid.top) <= 0.5 && Math.abs(end.top - start.top) <= 0.5,
      `${start.top} ${mid.top} ${end.top}`);
    check('reduced motion: the whole column fits the window', Math.abs(start.base - 900) <= 1.5, start.base);
  }
  await ctx.close();
}

// ---- the images all load --------------------------------------------------
{
  const { ctx, page } = await signedIn('admin323123', 'admin323321', { width: 1440, height: 900 });
  const statuses = await page.evaluate(async () => {
    const names = ['cap', 'shaft', 'lantern', 'base'].flatMap((p) => [`${p}-day`, `${p}-night`]);
    return Promise.all(names.map(async (n) => [n, (await fetch(`/colonnade/${n}.webp`)).status]));
  });
  check('every column image is served', statuses.every(([, s]) => s === 200), JSON.stringify(statuses));
  await ctx.close();
}

// ---- the lanterns light at night ------------------------------------------
{
  const { ctx, page } = await signedIn('admin323123', 'admin323321', { width: 1440, height: 900 }, 'dark');
  await page.waitForTimeout(2200);
  const night = await page.evaluate(() => ({
    night: getComputedStyle(document.querySelector('.col-night')).opacity,
    day: getComputedStyle(document.querySelector('.col-day')).visibility,
    glow: getComputedStyle(document.querySelector('.lantern-glow')).opacity,
  }));
  check('dark theme shows the night columns', night.night === '1', JSON.stringify(night));
  check('dark theme drops the day columns underneath', night.day === 'hidden', JSON.stringify(night));
  check('the lanterns glow in the dark theme', Number(night.glow) > 0.5, JSON.stringify(night));
  const trim = await page.evaluate(() => ({
    frieze: getComputedStyle(document.querySelector('.topbar'), '::before').opacity,
    gilt: getComputedStyle(document.querySelector('.topbar'), '::after').backgroundImage.includes('876b41'),
    sheen: getComputedStyle(document.documentElement).getPropertyValue('--card-sheen').trim(),
    lozenge: getComputedStyle(document.querySelector('footer.foot'), '::after').borderTopColor,
  }));
  check('dark theme: the frieze is gilt', trim.gilt, JSON.stringify(trim));
  check('dark theme: lamplight falls on the frieze', Number(trim.frieze) > 0.5, JSON.stringify(trim));
  check('dark theme: card edges catch warm light', trim.sheen.replace(/\s/g, '').startsWith('rgba(255,214,160'), trim.sheen);
  check('dark theme: the footer lozenge is bronze', trim.lozenge === 'rgb(176, 141, 85)', trim.lozenge);

  await page.click('.theme-toggle');
  await page.waitForTimeout(1500);
  const day = await page.evaluate(() => ({
    night: getComputedStyle(document.querySelector('.col-night')).opacity,
    day: getComputedStyle(document.querySelector('.col-day')).visibility,
    glow: getComputedStyle(document.querySelector('.lantern-glow')).opacity,
  }));
  const lightFrieze = await page.evaluate(() => getComputedStyle(document.querySelector('.topbar'), '::before').opacity);
  check('switching to light takes the lamplight off the frieze', Number(lightFrieze) < 0.05, lightFrieze);
  check('switching to light puts the lanterns out', Number(day.glow) < 0.05 && Number(day.night) < 0.05 && day.day === 'visible', JSON.stringify(day));
  await ctx.close();
}

// ---- phones get the palette and the type, not the columns -------------------
{
  const { ctx, page } = await signedIn('admin323123', 'admin323321', { width: 390, height: 844 });
  const g = await geometry(page);
  check('phone: no columns', !g.colonnadeShown);
  check('phone: headings use the classical face', /Cormorant/i.test(g.h1Font), g.h1Font);
  check('phone: no sideways scroll', g.pageOverflow <= 0, `${g.pageOverflow}px`);
  const bg = await page.evaluate(() => getComputedStyle(document.body).backgroundColor);
  check('phone: limestone background', bg === 'rgb(235, 228, 214)', bg);
  await ctx.close();
}

// ---- everyone else keeps the current design --------------------------------
{
  const reg = await browser.newContext({ baseURL: BASE });
  const p = await reg.newPage();
  await p.goto('/register');
  await p.fill('input[name=full_name]', 'Classic Check');
  await p.fill('input[name=student_number]', `c${RUN}`);
  await p.fill('input[name=email]', `classic.${RUN}@ogr.iuc.edu.tr`);
  await p.fill('input[name=password]', 'classic-pass-1');
  await p.fill('input[name=confirm]', 'classic-pass-1');
  await Promise.all([p.waitForURL(/dashboard/), p.click('button[type=submit]')]);
  await reg.close();
}
for (const [who, id, pw] of [
  ['teacher', 'devrim.gunay', 'devrim.gunay.123'],
  ['student', `classic.${RUN}@ogr.iuc.edu.tr`, 'classic-pass-1'],
]) {
  const { ctx, page, requests } = await signedIn(id, pw, { width: 1920, height: 1080 });
  await page.goto('/groups');
  await page.waitForLoadState('networkidle');
  const state = await page.evaluate(() => ({
    colonnade: !!document.querySelector('.colonnade'),
    classic: !!document.querySelector('.shell.classic'),
    bg: getComputedStyle(document.body).backgroundColor,
    h1: getComputedStyle(document.querySelector('h1')).fontFamily,
  }));
  check(`${who}: no columns`, !state.colonnade && !state.classic);
  check(`${who}: current background`, state.bg === 'rgb(244, 246, 249)', state.bg);
  check(`${who}: current heading face`, !/Cormorant|Cinzel/i.test(state.h1), state.h1);
  const fetched = requests.filter((u) => u.includes('/colonnade/') || /\.woff2/.test(u));
  check(`${who}: downloads none of the theme's images or fonts`, fetched.length === 0, fetched.join(', '));
  await ctx.close();
}

await browser.close();
console.log(`\n${bad} failures`);
process.exit(bad ? 1 : 0);
