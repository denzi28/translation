/**
 * Turns the renders from render.mjs into the WebP pieces in public/colonnade.
 *
 * The shaft tile is one row of the render repeated, so it tiles perfectly.
 * Every edge where a piece meets the shaft is then compared with that tile
 * and its last few rows are blended into it, so the joins cannot show. The
 * printed numbers are the mean difference at each join before blending, out
 * of 255; anything above 1 means the scene has changed in a way that puts
 * light or shadow across a join.
 */
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { fileURLToPath } from "node:url";
import sharp from "sharp";

const here = path.dirname(fileURLToPath(import.meta.url));
const OUT = path.resolve(here, "../../public/colonnade");
const RENDERS = path.join(os.tmpdir(), "colonnade-renders");
const WIDTH = 500;
const FEATHER = 10;

// Every render is an even number of pixels tall, so each goes through the
// same exact 2x downsample and the columns of pixels line up across pieces.
async function downsample(input) {
  const img = sharp(input);
  const { width, height } = await img.metadata();
  const { data, info } = await img
    .resize(WIDTH, Math.round((height * WIDTH) / width), { kernel: "lanczos3" })
    .ensureAlpha()
    .raw()
    .toBuffer({ resolveWithObject: true });
  return { data, w: info.width, h: info.height };
}
const row = (img, y) => img.data.subarray(y * img.w * 4, (y + 1) * img.w * 4);

function difference(a, b) {
  let sum = 0, n = 0;
  for (let i = 0; i < a.length; i += 4) {
    if (a[i + 3] < 250 || b[i + 3] < 250) continue;
    for (let c = 0; c < 3; c++) sum += Math.abs(a[i + c] - b[i + c]);
    n += 3;
  }
  return n ? sum / n : 0;
}

function feather(img, tile, fromTop) {
  for (let k = 0; k < FEATHER; k++) {
    const r = row(img, fromTop ? k : img.h - 1 - k);
    const t = k / FEATHER, toTile = 1 - t * t * (3 - 2 * t);
    for (let i = 0; i < r.length; i++) r[i] = Math.round(r[i] * (1 - toTile) + tile[i] * toTile);
  }
}

fs.mkdirSync(OUT, { recursive: true });
const webp = { quality: 88, alphaQuality: 100, smartSubsample: true, effort: 6 };
for (const mode of ["day", "night"]) {
  const src = await sharp(path.join(RENDERS, `tile-${mode}.png`)).ensureAlpha().raw().toBuffer({ resolveWithObject: true });
  const one = src.data.subarray(10 * src.info.width * 4, 11 * src.info.width * 4);
  const stack = Buffer.alloc(one.length * 8);
  for (let y = 0; y < 8; y++) stack.set(one, y * one.length);
  const tileImg = await downsample(await sharp(stack, { raw: { width: src.info.width, height: 8, channels: 4 } }).png().toBuffer());
  const tile = new Uint8Array(row(tileImg, 1));
  // The shipped tile is that one row repeated: the same pixels every join
  // below is blended into.
  const TILE_ROWS = 4, tileOut = Buffer.alloc(tile.length * TILE_ROWS);
  for (let y = 0; y < TILE_ROWS; y++) tileOut.set(tile, y * tile.length);
  await sharp(tileOut, { raw: { width: tileImg.w, height: TILE_ROWS, channels: 4 } })
    .webp({ lossless: true })
    .toFile(path.join(OUT, `shaft-${mode}.webp`));

  for (const [piece, edges] of [["cap", ["bottom"]], ["lantern", ["top", "bottom"]], ["base", ["top"]]]) {
    const img = await downsample(path.join(RENDERS, `${piece}-${mode}.png`));
    const joins = edges.map((edge) => {
      const d = difference(row(img, edge === "top" ? 0 : img.h - 1), tile);
      feather(img, tile, edge === "top");
      return `${edge} ${d.toFixed(2)}`;
    });
    await sharp(img.data, { raw: { width: img.w, height: img.h, channels: 4 } })
      .webp(webp)
      .toFile(path.join(OUT, `${piece}-${mode}.webp`));
    console.log(`${piece}-${mode}  ${img.w}x${img.h}  join: ${joins.join(", ")}`);
  }
}

// The temple front and the lantern are single images: downsample and encode.
// The map says where the frieze, medallion, lanterns and flame land, as
// percentages for the stylesheet.
const maps = JSON.parse(fs.readFileSync(path.join(RENDERS, "maps.json"), "utf8"));
for (const [scene, outWidth, quality] of [["portico", 1280, 84], ["lamp", 192, 92]]) {
  for (const mode of ["day", "night"]) {
    const file = path.join(OUT, `${scene}-${mode}.webp`);
    const img = sharp(path.join(RENDERS, `${scene}-${mode}.png`));
    const { width, height } = await img.metadata();
    await img
      .resize(outWidth, Math.round((height * outWidth) / width), { kernel: "lanczos3" })
      .webp({ quality, alphaQuality: 100, smartSubsample: true, effort: 6 })
      .toFile(file);
    const meta = await sharp(file).metadata();
    console.log(`${scene}-${mode}  ${meta.width}x${meta.height}  ${(fs.statSync(file).size / 1024).toFixed(1)}KB`);
  }
}
const pct = (v) => `${(v * 100).toFixed(2)}%`;
const p = maps.portico;
console.log("portico frieze", pct(p.frieze.left), pct(p.frieze.top), "to", pct(p.frieze.right), pct(p.frieze.bottom));
console.log("portico medallion", pct(p.medallion.x), pct(p.medallion.y), "radius", pct(p.medallion.r), "of width");
console.log("portico lanterns", p.lamps.map(([x, y]) => `${pct(x)} ${pct(y)}`).join(", "), "door", p.door.map(pct).join(" "));
console.log("lamp flame", maps.lamp.glass.map(pct).join(" "));
