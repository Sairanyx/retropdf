// Renders the share card, using the real fonts and palette rather than an
// approximation. Run when the wording or the look changes.
import { chromium } from "playwright"
import { readFileSync, writeFileSync } from "node:fs"

const font = readFileSync("app/static/fonts/handjet-latin-wght-normal.woff2").toString("base64")

const page_html = (title, sub) => `
<style>
  @font-face {
    font-family: Handjet;
    src: url(data:font/woff2;base64,${font}) format("woff2");
    font-weight: 100 900;
  }
  * { margin: 0; box-sizing: border-box }
  body {
    width: 1200px; height: 630px;
    background: #c9c7c4;
    font-family: Handjet, monospace;
    color: #201f1d;
    display: flex; flex-direction: column; justify-content: center;
    padding: 90px;
    position: relative;
  }
  /* The same raised plate the site is built from. */
  .mark {
    position: absolute; top: 70px; left: 90px;
    display: flex; align-items: center; gap: 18px;
    background: #cdcbc8; border-radius: 18px;
    padding: 20px 32px;
    box-shadow: -3px -3px 10px rgba(255,255,255,0.85), 6px 6px 16px rgba(88,84,78,0.32);
    font-size: 40px;
  }
  h1 { font-size: 92px; line-height: 1.06; font-weight: 500; max-width: 940px }
  p  { font-size: 40px; color: #4a4844; margin-top: 28px; max-width: 900px }
  .proof { display: flex; gap: 34px; margin-top: 46px; font-size: 30px; color: #4a4844 }
  .proof span { display: flex; align-items: center; gap: 12px }
  .led {
    width: 13px; height: 13px; border-radius: 50%;
    background: #c8452a; box-shadow: 0 0 9px #c8452a;
  }
</style>
<div class="mark">
  <svg width="34" height="40" viewBox="0 0 22 26" fill="none">
    <path d="M2 1h11l7 7v16a1 1 0 0 1-1 1H2a1 1 0 0 1-1-1V2a1 1 0 0 1 1-1Z" stroke="#201f1d" stroke-width="1.6"/>
    <path d="M13 1v7h7" stroke="#201f1d" stroke-width="1.6"/>
    <rect x="5" y="14" width="12" height="5" rx="1" fill="#c8452a"/>
  </svg>
  RetroPDF
</div>
<h1>${title}</h1>
<p>${sub}</p>
<div class="proof">
  <span><i class="led"></i>Nothing is uploaded</span>
  <span><i class="led"></i>No account</span>
  <span><i class="led"></i>No limits</span>
</div>
`

const browser = await chromium.launch()
const page = await browser.newPage({ viewport: { width: 1200, height: 630 }, deviceScaleFactor: 1 })
await page.setContent(page_html(
  "PDF tools that never upload your files.",
  "Merge, split, rotate and convert, all inside your own browser.",
))
await page.evaluate(() => document.fonts.ready)
await page.waitForTimeout(700)
writeFileSync("app/static/share.png", await page.screenshot())
await browser.close()
console.log("wrote app/static/share.png")
