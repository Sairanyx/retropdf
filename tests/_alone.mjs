import { chromium } from "playwright"
const browser = await chromium.launch()
try {
  const page = await browser.newPage({ viewport: { width: 2560, height: 1330 } })
  await page.goto("http://127.0.0.1:8000/", { waitUntil: "networkidle" })
  await page.waitForFunction(() => document.body.classList.contains("intro-done"), { timeout: 12000 }).catch(() => {})
  await page.waitForTimeout(1600)
  for (const [name, sel] of [["Tools", 'a[data-watch="tools"]'], ["Info", 'a[data-watch="info"]']]) {
    await page.click(sel)
    await page.waitForTimeout(1800)
    console.log(name, await page.evaluate(() => {
      const seen = []
      for (const s of document.querySelectorAll("section")) {
        const b = s.getBoundingClientRect()
        if (b.top < window.innerHeight && b.bottom > 0) {
          seen.push((s.id || s.className.split(" ")[0]) + " " + Math.round(b.top) + ".." + Math.round(b.bottom))
        }
      }
      return { visibleSections: seen }
    }))
  }
} finally { await browser.close() }
