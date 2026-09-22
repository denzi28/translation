/**
 * Renders the Ionic column in scene.js to PNG, piece by piece, in both
 * lighting setups, then `process.mjs` turns the PNGs into the WebP files the
 * site serves from public/colonnade.
 *
 *   npm i --no-save three@0.170.0 sharp playwright
 *   node scripts/colonnade/render.mjs && node scripts/colonnade/process.mjs
 *
 * WebGL runs on the CPU (SwiftShader), so no graphics card is needed. Each
 * piece is drawn at twice the size it ships at and downsampled.
 */
import fs from "node:fs";
import http from "node:http";
import os from "node:os";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { chromium } from "playwright";

const here = path.dirname(fileURLToPath(import.meta.url));
const repo = path.resolve(here, "../..");
export const RENDERS = path.join(os.tmpdir(), "colonnade-renders");
const PX_PER_UNIT = 435;

const types = { ".js": "text/javascript", ".html": "text/html" };
const server = http
  .createServer((req, res) => {
    const url = decodeURIComponent(req.url.split("?")[0]);
    const file = url.startsWith("/node_modules/") ? path.join(repo, url) : path.join(here, url);
    fs.readFile(file, (err, data) => {
      if (err) { res.writeHead(404); res.end(); return; }
      res.writeHead(200, { "content-type": types[path.extname(file)] ?? "application/octet-stream" });
      res.end(data);
    });
  })
  .listen(0);
const port = server.address().port;

const browser = await chromium.launch({
  args: ["--use-angle=swiftshader", "--enable-unsafe-swiftshader", "--ignore-gpu-blocklist"],
});
fs.mkdirSync(RENDERS, { recursive: true });
for (const mode of ["day", "night"]) {
  for (const piece of ["cap", "tile", "lantern", "base"]) {
    const page = await browser.newPage();
    page.on("pageerror", (e) => console.error(e.message));
    await page.goto(`http://127.0.0.1:${port}/scene.html?piece=${piece}&mode=${mode}&ppu=${PX_PER_UNIT}`);
    await page.waitForFunction(() => window.__done, null, { timeout: 300_000 });
    const { w, h, data } = await page.evaluate(() => window.__done);
    fs.writeFileSync(path.join(RENDERS, `${piece}-${mode}.png`), Buffer.from(data.split(",")[1], "base64"));
    console.log(`${piece}-${mode}  ${w}x${h}`);
    await page.close();
  }
}
await browser.close();
server.close();
