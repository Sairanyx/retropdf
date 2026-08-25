// The awkward files, driven through a real browser.
//
// tools.e2e.mjs covers the happy path. This covers what people actually
// hand a PDF tool: files that are locked, broken, enormous, or named in a
// script the developer never tried. None of these should lose data or leave
// the page stuck, and every one of them should say something useful.
//
// Start the server first, then: node tests/edge.e2e.mjs

import { chromium } from "playwright"
import { PDFDocument } from "@cantoo/pdf-lib"
import { mkdtemp, writeFile, rm } from "node:fs/promises"
import { tmpdir } from "node:os"
import { join } from "node:path"

const BASE = "http://127.0.0.1:8000"
const work = await mkdtemp(join(tmpdir(), "retroedge-"))

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

async function makePdf(pages, label) {
  const doc = await PDFDocument.create()
  for (let n = 1; n <= pages; n++) {
    doc.addPage([300, 400]).drawText(label + n, { x: 40, y: 340, size: 24 })
  }
  const path = join(work, label + ".pdf")
  await writeFile(path, await doc.save())
  return path
}

async function open(browser, path) {
  const page = await browser.newPage({
    viewport: { width: 1400, height: 900 },
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
  await page.waitForTimeout(600)
  return { page, errors }
}

const readout = (page) =>
  page.evaluate(() => document.querySelector("#result").textContent.trim())

const browser = await chromium.launch()

try {
  // --- a file that is not a PDF at all -----------------------------------
  {
    console.log("\na text file renamed .pdf")
    const path = join(work, "fake.pdf")
    await writeFile(path, "This is not a PDF, whatever the name says.")
    const { page, errors } = await open(browser, "/merge-pdf")
    await page.setInputFiles("#picker", path)
    await page.waitForTimeout(2500)
    const said = await readout(page)
    check("it is refused", /not a PDF/i.test(said), said)
    check("nothing is loaded", await page.evaluate(
      () => document.querySelectorAll("[data-position]").length === 0))
    check("the page still works", errors.length === 0, errors.join("; "))
    await page.close()
  }

  // --- a truncated PDF ----------------------------------------------------
  {
    console.log("\na PDF cut in half")
    const whole = await makePdf(4, "whole")
    const { readFile } = await import("node:fs/promises")
    const bytes = await readFile(whole)
    const path = join(work, "truncated.pdf")
    await writeFile(path, bytes.subarray(0, Math.floor(bytes.length / 2)))

    const { page, errors } = await open(browser, "/merge-pdf")
    await page.setInputFiles("#picker", path)
    await page.waitForTimeout(4000)
    const said = await readout(page)
    check("it says something rather than nothing", said.length > 0, said)
    check("the page is not stuck working", await page.evaluate(
      () => !document.body.classList.contains("working")))
    check("no unhandled error", errors.length === 0, errors.join("; "))
    await page.close()
  }

  // --- a password protected PDF ------------------------------------------
  {
    console.log("\na password protected PDF")
    // pdf-lib cannot write encryption, so this is a real one built by hand:
    // a minimal document carrying an /Encrypt dictionary.
    const path = join(work, "locked.pdf")
    const body = [
      "%PDF-1.4",
      "1 0 obj<</Type/Catalog/Pages 2 0 R>>endobj",
      "2 0 obj<</Type/Pages/Kids[3 0 R]/Count 1>>endobj",
      "3 0 obj<</Type/Page/Parent 2 0 R/MediaBox[0 0 300 400]>>endobj",
      "4 0 obj<</Filter/Standard/V 1/R 2/O<00>/U<00>/P -1>>endobj",
      "trailer<</Size 5/Root 1 0 R/Encrypt 4 0 R>>",
      "%%EOF",
    ].join("\n")
    await writeFile(path, body)

    const { page, errors } = await open(browser, "/merge-pdf")
    await page.setInputFiles("#picker", path)
    await page.waitForTimeout(4000)
    const said = await readout(page)
    check("it says something rather than nothing", said.length > 0, said)
    check("the page is not stuck working", await page.evaluate(
      () => !document.body.classList.contains("working")))
    check("no unhandled error", errors.length === 0, errors.join("; "))
    await page.close()
  }

  // --- a single page document --------------------------------------------
  {
    console.log("\na one page PDF in a tool that cuts")
    const one = await makePdf(1, "single")
    const { page, errors } = await open(browser, "/split-pdf")
    await page.setInputFiles("#picker", one)
    await page.waitForTimeout(3000)
    // Splitting one page has nowhere to cut, so this should explain itself
    // rather than producing an empty zip.
    await page.click("#download").catch(() => {})
    await page.waitForTimeout(2500)
    const said = await readout(page)
    check("it says something rather than nothing", said.length > 0, said)
    check("no unhandled error", errors.length === 0, errors.join("; "))
    await page.close()
  }

  // --- a name in another script ------------------------------------------
  {
    console.log("\na file named in Greek and Arabic")
    const doc = await PDFDocument.create()
    doc.addPage([300, 400])
    const path = join(work, "συμβόλαιο-ملف.pdf")
    await writeFile(path, await doc.save())

    const { page, errors } = await open(browser, "/merge-pdf")
    await page.setInputFiles("#picker", path)
    await page.waitForFunction(
      () => !document.querySelector("#download").disabled,
      { timeout: 20000 },
    )
    await page.waitForTimeout(800)
    check("the file opens", await page.evaluate(
      () => document.querySelectorAll("[data-position]").length === 1))

    const wait = page.waitForEvent("download", { timeout: 20000 })
    await page.click("#download")
    const download = await wait
    const name = download.suggestedFilename()
    check("the download is named sensibly", name.endsWith(".pdf") && name.length > 4, name)
    check("no unhandled error", errors.length === 0, errors.join("; "))
    await page.close()
  }

  // --- more files than the limit allows -----------------------------------
  {
    console.log("\nmore files than the limit")
    const many = []
    for (let n = 0; n < 55; n++) many.push(await makePdf(1, "m" + n))

    const { page, errors } = await open(browser, "/merge-pdf")
    await page.setInputFiles("#picker", many)
    await page.waitForTimeout(3000)
    const said = await readout(page)
    check("it explains the limit", /limit|most files/i.test(said), said)
    check("the page is not stuck working", await page.evaluate(
      () => !document.body.classList.contains("working")))
    check("no unhandled error", errors.length === 0, errors.join("; "))
    await page.close()
  }

  // --- an empty selection --------------------------------------------------
  {
    console.log("\ndownloading with nothing open")
    const { page, errors } = await open(browser, "/merge-pdf")
    const disabled = await page.evaluate(
      () => document.querySelector("#download").disabled)
    check("download is switched off", disabled === true)
    check("no unhandled error", errors.length === 0, errors.join("; "))
    await page.close()
  }
} finally {
  await browser.close()
  await rm(work, { recursive: true, force: true })
}

console.log("\n" + passed + " passed, " + failed + " failed")
process.exit(failed ? 1 : 0)
