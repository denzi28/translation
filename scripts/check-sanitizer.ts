/** Quick manual check of the post sanitizer: `npx tsx scripts/check-sanitizer.ts` */
import { htmlExcerpt, sanitizePostHtml } from "../src/lib/sanitize";

const hostile =
  '<p>ok</p><script>alert(1)</script><img src=x onerror=alert(1)>' +
  '<a href="javascript:alert(1)">x</a><b style="font-weight:bold">b</b>' +
  '<iframe src="http://evil"></iframe><span style="font-family:Georgia">g</span>' +
  '<h2 style="text-align:center">C</h2><ul><li>a</li></ul><font face="Arial">f</font>';

console.log("SANITIZED:", sanitizePostHtml(hostile));
console.log("EXCERPT  :", htmlExcerpt(hostile));
