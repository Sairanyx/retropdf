import { chromium } from "playwright"
const browser = await chromium.launch()
try {
  const page = await browser.newPage({ viewport: { width: 2560, height: 1330 } })
  await page.goto("http://127.0.0.1:8000/", { waitUntil: "networkidle" })
  await page.waitForFunction(() => document.body.classList.contains("intro-done"), { timeout: 12000 }).catch(() => {})
  await page.waitForTimeout(1500)
  for (let y = 0; y <= 4600; y += 150) { await page.evaluate(t => window.scrollTo(0, t), y); await page.waitForTimeout(50) }
  await page.evaluate(() => window.scrollTo(0, document.documentElement.scrollHeight))
  await page.waitForTimeout(1200)
  console.log(await page.evaluate(() => {
    const d = [...document.querySelectorAll(".route-dot")]
      .map(el => ({ x: parseFloat(el.style.left), y: parseFloat(el.style.top) }))
      .sort((a, b) => a.y - b.y)
    // The angle of each short segment, and how much it changes step to step.
    const ang = []
    for (let i = 1; i < d.length; i++)
      ang.push(Math.atan2(d[i].x - d[i-1].x, d[i].y - d[i-1].y) * 180 / Math.PI)
    const turns = []
    for (let i = 1; i < ang.length; i++)
      turns.push({ at: Math.round(d[i].y), turn: +(ang[i] - ang[i-1]).toFixed(1), angle: +ang[i].toFixed(1) })
    const worst = [...turns].sort((a, b) => Math.abs(b.turn) - Math.abs(a.turn)).slice(0, 6)
    return {
      dots: d.length,
      steepest: Math.max(...ang.map(Math.abs)).toFixed(1) + " degrees from vertical",
      sharpestTurns: worst,
    }
  }))
} finally { await browser.close() }
