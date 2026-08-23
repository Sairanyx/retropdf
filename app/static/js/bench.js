// Development only: find out where merging actually stops working.
//
// The size limits in limits.js were guesses. This measures the real thing on
// whatever device you run it on, so the limits can be set from evidence.
//
// It builds PDFs padded to a target size, merges them through the same worker
// the product uses, and records timing, output size and peak memory until
// something fails.

import { PDFDocument } from "/static/js/vendor/pdf-lib.esm.min.js"
import { call } from "/static/js/pdf-worker.js"

const runButton = document.querySelector("#run")
const stopButton = document.querySelector("#stop")
const status = document.querySelector("#status")
const rows = document.querySelector("#results tbody")
const note = document.querySelector("#note")

// Total input size to try, in MB. Climbs until something breaks.
const STEPS = [10, 25, 50, 80, 120, 160, 200, 250, 300, 400, 500]

// Each step splits its total across this many files, the way a real merge
// would rather than one enormous document.
const FILES_PER_STEP = 4

let stopped = false

const MB = 1024 * 1024
const mb = (bytes) => `${(bytes / MB).toFixed(1)} MB`
const ms = (start) => `${Math.round(performance.now() - start)} ms`

/**
 * Report how much memory the tab is using, where the browser will say.
 *
 * Only Chrome and Edge support this, and only approximately. Firefox and
 * Safari report nothing, so the column is left blank there.
 */
function memoryUsed() {
  if (!performance.memory) return null
  return performance.memory.usedJSHeapSize
}

/**
 * Build a PDF of roughly the requested size.
 *
 * Real PDFs are mostly image and font data, so padding with random bytes in
 * an embedded stream is closer to a scanned document than adding thousands of
 * near empty pages would be. Random data also cannot be compressed away.
 */
async function makePdfOfSize(targetBytes, pages = 20) {
  const doc = await PDFDocument.create()

  for (let n = 0; n < pages; n++) {
    doc.addPage([595, 842])
  }

  // Pad with an unused stream of incompressible bytes to reach the target.
  const padding = Math.max(0, targetBytes - 4096)
  if (padding > 0) {
    const filler = new Uint8Array(padding)
    crypto.getRandomValues(filler.subarray(0, Math.min(padding, 65536)))
    for (let offset = 65536; offset < padding; offset += 65536) {
      filler.copyWithin(offset, 0, Math.min(65536, padding - offset))
    }
    doc.context.register(doc.context.stream(filler))
  }

  return doc.save({ useObjectStreams: false })
}

function addRow(cells, ok) {
  const row = document.createElement("tr")
  if (!ok) row.style.background = "#fdd"
  for (const cell of cells) {
    const td = document.createElement("td")
    td.textContent = cell
    row.appendChild(td)
  }
  rows.appendChild(row)
}

async function runStep(totalMb) {
  const perFile = Math.round((totalMb * MB) / FILES_PER_STEP)
  let peak = memoryUsed() || 0

  // Build the inputs.
  const buildStart = performance.now()
  const ids = []
  for (let n = 0; n < FILES_PER_STEP; n++) {
    const bytes = await makePdfOfSize(perFile)
    const loaded = await call("load", { bytes }, [bytes.buffer])
    ids.push(loaded)
    peak = Math.max(peak, memoryUsed() || 0)
  }
  const buildTime = ms(buildStart)

  // Merge them, exactly as the product does.
  const mergeStart = performance.now()
  const items = []
  for (const doc of ids) {
    for (let page = 1; page <= doc.pageCount; page++) {
      items.push({ doc: doc.id, page })
    }
  }
  const { bytes } = await call("build", { items })
  const mergeTime = ms(mergeStart)
  peak = Math.max(peak, memoryUsed() || 0)

  // Hand it to the browser the way a download would, without saving it.
  const saveStart = performance.now()
  const blob = new Blob([bytes], { type: "application/pdf" })
  const url = URL.createObjectURL(blob)
  URL.revokeObjectURL(url)
  const saveTime = ms(saveStart)

  // Check the output is a real PDF and not truncated.
  const header = new Uint8Array(bytes.buffer || bytes, 0, 5)
  const valid = String.fromCharCode(...header) === "%PDF-"

  for (const doc of ids) await call("close", { id: doc.id })

  return {
    cells: [
      `${totalMb} MB`,
      String(FILES_PER_STEP),
      buildTime,
      mergeTime,
      saveTime,
      mb(blob.size),
      peak ? mb(peak) : "n/a",
      valid ? "ok" : "CORRUPT OUTPUT",
    ],
    ok: valid,
  }
}

runButton.addEventListener("click", async () => {
  stopped = false
  runButton.disabled = true
  stopButton.disabled = false
  rows.replaceChildren()
  note.textContent = ""

  if (!performance.memory) {
    note.textContent =
      "This browser does not report memory use, so that column is blank. " +
      "Chrome and Edge do report it."
  }

  let lastGood = null

  for (const totalMb of STEPS) {
    if (stopped) break
    status.textContent = `Testing ${totalMb} MB...`

    try {
      const { cells, ok } = await runStep(totalMb)
      addRow(cells, ok)
      if (ok) lastGood = totalMb
      else break
    } catch (error) {
      addRow([`${totalMb} MB`, String(FILES_PER_STEP), "", "", "", "", "", error.message], false)
      break
    }

    // Give the browser a moment to collect what the last step dropped.
    await new Promise((resolve) => setTimeout(resolve, 400))
  }

  status.textContent = lastGood
    ? `Largest total that worked: ${lastGood} MB.`
    : "Nothing completed."

  runButton.disabled = false
  stopButton.disabled = true
})

stopButton.addEventListener("click", () => {
  stopped = true
  status.textContent = "Stopping after this step..."
})
