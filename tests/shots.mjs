// Take screenshots of a page at several scroll positions.
//
// A development tool, not part of the site. It exists so the result of a
// visual change can actually be looked at rather than guessed at, which is
// the difference between fixing something once and fixing it six times.
//
// Usage:
//   node tests/shots.mjs                    the home page
//   node tests/shots.mjs /workspace         another page
//   node tests/shots.mjs / 8                more steps down the page

import { chromium } from "playwright"
import { mkdir, rm } from "node:fs/promises"

const path = process.argv[2] || "/"
const steps = Number(process.argv[3] || 5)
const outDir = "shots"

const base = "http://127.0.0.1:8000"

await rm(outDir, { recursive: true, force: true })
await mkdir(outDir, { recursive: true })

const browser = await chromium.launch()
const page = await browser.newPage({
  viewport: { width: 1600, height: 900 },
  // A real device pixel ratio, so text renders the way it does on screen
  // rather than at half resolution.
  deviceScaleFactor: 1,
})

await page.goto(base + path, { waitUntil: "networkidle" })

// Let the opening sequence finish before anything is captured, or every
// shot is of a page still arriving.
await page.waitForFunction(
  () => document.body.classList.contains("intro-done"),
  { timeout: 8000 },
).catch(() => {})
await page.waitForTimeout(800)

const height = await page.evaluate(() => document.documentElement.scrollHeight)
const viewport = 900
const scrollable = Math.max(0, height - viewport)

console.log(`page ${path}`)
console.log(`  height ${height}px, scrollable ${scrollable}px`)

for (let i = 0; i < steps; i++) {
  const y = Math.round((scrollable * i) / Math.max(1, steps - 1))

  await page.evaluate((to) => window.scrollTo(0, to), y)
  // Long enough for scroll-driven animation to settle.
  await page.waitForTimeout(500)

  const file = `${outDir}/${String(i).padStart(2, "0")}-y${y}.png`
  await page.screenshot({ path: file })
  console.log(`  ${file}`)
}

await browser.close()
