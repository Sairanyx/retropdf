// Checks every page at the sizes people actually hold.
//
// Two faults matter most on a phone and both are invisible on a desktop:
// a page that scrolls sideways, and a control too small to hit with a
// finger. Everything here measures the rendered page rather than reading
// the stylesheet, since what matters is where things actually land.
//
// Start the server first, then: node tests/responsive.e2e.mjs

import { chromium } from "playwright"

// Real devices, not round numbers. These are the widths people actually have.
const SCREENS = [
  { name: "iPhone SE",     w: 375, h: 667 },
  { name: "iPhone 15",     w: 393, h: 852 },
  { name: "Android large", w: 412, h: 915 },
  { name: "iPad portrait", w: 768, h: 1024 },
  { name: "laptop",        w: 1366, h: 768 },
]
const PAGES = ["/", "/merge-pdf", "/workspace"]

const browser = await chromium.launch()
try {
  for (const s of SCREENS) {
    console.log(`\n${s.name}  ${s.w}x${s.h}`)
    for (const path of PAGES) {
      const page = await browser.newPage({
        viewport: { width: s.w, height: s.h },
        // Tells the page it is a touch device, so hover rules stay off.
        hasTouch: s.w < 900,
        isMobile: s.w < 900,
      })
      const errors = []
      page.on("pageerror", (e) => errors.push(e.message))
      await page.goto("http://127.0.0.1:8000" + path, { waitUntil: "networkidle" })
      await page.waitForFunction(() => document.body.classList.contains("intro-done"), { timeout: 12000 }).catch(() => {})
      await page.waitForTimeout(900)

      const r = await page.evaluate(() => {
        // Anything wider than the window makes the whole page scroll sideways,
        // which is the single worst mobile fault.
        const overflowing = []
        for (const el of document.querySelectorAll("body *")) {
          const b = el.getBoundingClientRect()
          if (b.width === 0) continue
          if (b.right > window.innerWidth + 1 || b.left < -1) {
            overflowing.push(el.tagName + "." + String(el.className).split(" ")[0])
          }
        }
        // A finger needs about 44px. Anything smaller is a miss waiting to
        // happen, except a control deliberately hidden behind a bigger one:
        // the radio inside a switch is 1px so screen readers still find it,
        // while the switch around it is what you actually touch.
        const small = []
        for (const el of document.querySelectorAll("a, button, label, input, select")) {
          const b = el.getBoundingClientRect()
          if (b.width === 0 || b.height === 0) continue
          if (b.width <= 2 && b.height <= 2) continue
          // A link inside a sentence cannot be padded to 44px without
          // forcing the lines of the paragraph apart.
          if (el.closest("p") && el.tagName === "A") continue
          if (b.height < 44 || b.width < 44) {
            small.push(`${el.tagName}.${String(el.className).split(" ")[0]} ${Math.round(b.width)}x${Math.round(b.height)}`)
          }
        }
        return {
          scrollsSideways: document.documentElement.scrollWidth > window.innerWidth + 1,
          overflowing: [...new Set(overflowing)].slice(0, 4),
          smallTargets: [...new Set(small)].slice(0, 4),
          smallCount: small.length,
        }
      })

      const bad = r.scrollsSideways || r.smallCount > 0 || errors.length
      console.log(`  ${path.padEnd(12)} ${bad ? "PROBLEMS" : "ok"}`)
      if (r.scrollsSideways) console.log(`      scrolls sideways, from: ${r.overflowing.join(", ")}`)
      if (r.smallCount) console.log(`      ${r.smallCount} targets under 44px: ${r.smallTargets.join(", ")}`)
      if (errors.length) console.log(`      errors: ${errors.join("; ")}`)
      await page.close()
    }
  }
} finally { await browser.close() }
