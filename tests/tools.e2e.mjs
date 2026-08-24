// Drives every tool through a real browser with real files.
//
// The unit tests cover the PDF operations directly, in Node. This covers
// what they cannot: the worker round trip, the transferable buffers, the
// rendering, the download. A corrupt merge output once got through because
// that layer had never been exercised, which is what this is for.
//
// Start the server first, then: node tests/tools.e2e.mjs

import { chromium } from "playwright"
import { PDFDocument, rgb } from "@cantoo/pdf-lib"
import { mkdtemp, writeFile, readFile, rm } from "node:fs/promises"
import { tmpdir } from "node:os"
import { join } from "node:path"

const BASE = "http://127.0.0.1:8000"
const work = await mkdtemp(join(tmpdir(), "retropdf-"))

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

/** A PDF whose pages can be told apart. */
async function makePdf(pages, label) {
  const doc = await PDFDocument.create()
  for (let n = 1; n <= pages; n++) {
    const page = doc.addPage([300, 400])
    page.drawText(label + n, { x: 40, y: 340, size: 36 })
    page.drawRectangle({
      x: 20,
      y: 20,
      width: 40,
      height: 40,
      color: rgb(0.8, 0.2, 0.1),
    })
  }
  const path = join(work, label + ".pdf")
  await writeFile(path, await doc.save())
  return path
}

/** The smallest PNG worth calling an image. */
async function makePng() {
  const png = Buffer.from(
    "iVBORw0KGgoAAAANSUhEUgAAAAIAAAACCAYAAABytg0kAAAAFElEQVR4nGP8z" +
      "8Dwn4GBgYERRIAAAwAJ/wL+CV7BuwAAAABJRU5ErkJggg==",
    "base64",
  )
  const path = join(work, "image.png")
  await writeFile(path, png)
  return path
}

/** Open a tool page and wait for it to settle. */
async function open(browser, path) {
  const page = await browser.newPage({
    viewport: { width: 1600, height: 1000 },
    acceptDownloads: true,
  })
  const errors = []
  page.on("pageerror", (e) => errors.push(e.message))
  await page.goto(BASE + path, { waitUntil: "networkidle" })
  await page
    .waitForFunction(() => document.body.classList.contains("intro-done"), {
      timeout: 12000,
    })
    .catch(() => {})
  await page.waitForTimeout(700)
  return { page, errors }
}

/** Load files and wait until there is something to download. */
async function load(page, files) {
  await page.setInputFiles("#picker", files)
  await page.waitForFunction(
    () => !document.querySelector("#download").disabled,
    { timeout: 30000 },
  )
  // Thumbnails are drawn one at a time after the pages are counted.
  await page.waitForTimeout(1200)
}

/** Click download and keep whatever the browser saved. */
async function save(page, name) {
  const wait = page.waitForEvent("download", { timeout: 30000 })
  await page.click("#download")
  const download = await wait
  const path = join(work, name)
  await download.saveAs(path)
  return { path, suggested: download.suggestedFilename() }
}

async function pagesIn(path) {
  const doc = await PDFDocument.load(await readFile(path))
  return doc.getPageCount()
}

function isZip(bytes) {
  return bytes[0] === 0x50 && bytes[1] === 0x4b
}

const browser = await chromium.launch()

try {
  const three = await makePdf(3, "a")
  const two = await makePdf(2, "b")
  const png = await makePng()

  {
    console.log("\nmerge")
    const { page, errors } = await open(browser, "/merge-pdf")
    await load(page, [three, two])
    const { path, suggested } = await save(page, "merged.pdf")
    const n = await pagesIn(path)
    check("both files are in the output", n === 5, "got " + n + " pages, wanted 5")
    check("saved as a PDF", suggested.endsWith(".pdf"), suggested)
    check("no page errors", errors.length === 0, errors.join("; "))
    await page.close()
  }

  {
    console.log("\ndelete pages")
    const { page, errors } = await open(browser, "/remove-pdf-pages")
    await load(page, [three])
    await page.click("[data-position]")
    await page.waitForTimeout(300)
    const { path } = await save(page, "removed.pdf")
    const n = await pagesIn(path)
    check("the chosen page is gone", n === 2, "got " + n + " pages, wanted 2")
    check("no page errors", errors.length === 0, errors.join("; "))
    await page.close()
  }

  {
    console.log("\nextract pages")
    const { page, errors } = await open(browser, "/extract-pdf-pages")
    await load(page, [three])
    await page.click("[data-position]")
    await page.waitForTimeout(300)
    const { path } = await save(page, "extracted.pdf")
    const n = await pagesIn(path)
    check("only the chosen page is saved", n === 1, "got " + n + " pages, wanted 1")
    check("no page errors", errors.length === 0, errors.join("; "))
    await page.close()
  }

  {
    console.log("\nreorder")
    const { page, errors } = await open(browser, "/reorder-pdf")
    await load(page, [three])
    const before = await page.evaluate(() =>
      [...document.querySelectorAll("[data-position] .num")].map((n) =>
        n.textContent.trim(),
      ),
    )
    await page.locator("[data-position]").first().locator(".mini").nth(1).click()
    await page.waitForTimeout(600)
    const after = await page.evaluate(() =>
      [...document.querySelectorAll("[data-position] .num")].map((n) =>
        n.textContent.trim(),
      ),
    )
    check(
      "the order changes on screen",
      before.join() !== after.join(),
      before + " -> " + after,
    )
    const { path } = await save(page, "reordered.pdf")
    const n = await pagesIn(path)
    check("no page is lost", n === 3, "got " + n + " pages, wanted 3")
    check("no page errors", errors.length === 0, errors.join("; "))
    await page.close()
  }

  {
    console.log("\nrotate")
    const { page, errors } = await open(browser, "/rotate-pdf")
    await load(page, [three])
    await page.locator("[data-position]").first().locator(".mini").nth(1).click()
    await page.waitForTimeout(400)
    const { path } = await save(page, "rotated.pdf")
    const doc = await PDFDocument.load(await readFile(path))
    check("no page is lost", doc.getPageCount() === 3)
    const angle = doc.getPage(0).getRotation().angle
    check("the first page is turned", angle !== 0, "angle " + angle)
    check("no page errors", errors.length === 0, errors.join("; "))
    await page.close()
  }

  {
    console.log("\nsplit")
    const { page, errors } = await open(browser, "/split-pdf")
    await load(page, [three])
    const { path, suggested } = await save(page, "split.zip")
    const bytes = await readFile(path)
    check("a zip comes back", isZip(bytes), "first bytes " + bytes[0] + "," + bytes[1])
    check("saved as a zip", suggested.endsWith(".zip"), suggested)
    check("the zip has content", bytes.length > 500, bytes.length + " bytes")
    check("no page errors", errors.length === 0, errors.join("; "))
    await page.close()
  }

  {
    console.log("\nimages to PDF")
    const { page, errors } = await open(browser, "/jpg-to-pdf")
    await load(page, [png])
    const { path } = await save(page, "fromimages.pdf")
    const n = await pagesIn(path)
    check("one page per image", n === 1, "got " + n + " pages, wanted 1")
    check("no page errors", errors.length === 0, errors.join("; "))
    await page.close()
  }

  {
    console.log("\nPDF to images")
    const { page, errors } = await open(browser, "/pdf-to-jpg")
    await load(page, [three])
    const { path, suggested } = await save(page, "toimages.zip")
    const bytes = await readFile(path)
    check("a zip comes back", isZip(bytes))
    check("saved as a zip", suggested.endsWith(".zip"), suggested)
    check("the zip has content", bytes.length > 500, bytes.length + " bytes")
    check("no page errors", errors.length === 0, errors.join("; "))
    await page.close()
  }

  {
    console.log("\nworkspace")
    const { page, errors } = await open(browser, "/workspace")
    await load(page, [three])
    // Switching tool with a file open is what the workspace is for.
    await page.evaluate(() => {
      const radio = document.querySelector('input[name="mode"][value="extract"]')
      radio.checked = true
      radio.dispatchEvent(new Event("change", { bubbles: true }))
    })
    await page.waitForTimeout(600)
    check(
      "switching tools starts clean",
      await page.evaluate(
        () => document.querySelectorAll("[data-position]").length === 0,
      ),
    )
    await load(page, [three])
    await page.click("[data-position]")
    await page.waitForTimeout(300)
    const { path } = await save(page, "workspace.pdf")
    const n = await pagesIn(path)
    check("the chosen page is saved", n === 1, "got " + n + " pages, wanted 1")
    check("no page errors", errors.length === 0, errors.join("; "))
    await page.close()
  }
} finally {
  await browser.close()
  await rm(work, { recursive: true, force: true })
}

console.log("\n" + passed + " passed, " + failed + " failed")
process.exit(failed ? 1 : 0)
