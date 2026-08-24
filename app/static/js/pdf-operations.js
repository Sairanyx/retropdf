// The PDF operations themselves, with no reference to workers, messages or
// the browser. Keeping them here means they can be tested directly in Node,
// and the worker becomes a thin message handling wrapper.

import { PDFDocument, degrees } from "/static/js/vendor/pdf-lib.esm.min.js"
import { zipSync } from "/static/js/vendor/fflate.esm.js"

// Documents that have been loaded, kept by id so callers can refer to them
// later without sending the bytes again.
const documents = new Map()
let nextId = 1

export async function load({ bytes }) {
  let doc
  try {
    doc = await PDFDocument.load(bytes)
  } catch (error) {
    throw new Error("That file could not be read as a PDF.")
  }

  if (doc.getPageCount() === 0) throw new Error("That PDF has no pages.")

  const id = nextId++
  documents.set(id, doc)
  return { id, pageCount: doc.getPageCount() }
}

/**
 * Build one document from a list of pages taken from any loaded document.
 *
 * Each item is { doc, page, rotate }, where `doc` is an id from load(),
 * `page` counts from 1, and `rotate` is optional extra degrees. Because an
 * item names its own document, this single operation covers merge, remove,
 * extract, reorder and rotate, in any combination and one pass.
 */
export async function build({ items }) {
  if (!Array.isArray(items) || items.length === 0) {
    throw new Error("No pages were selected.")
  }

  for (const item of items) {
    const source = documents.get(item.doc)
    if (!source) throw new Error("One of those files is no longer loaded.")

    const total = source.getPageCount()
    if (!Number.isInteger(item.page) || item.page < 1 || item.page > total) {
      throw new Error(`Page ${item.page} does not exist in a ${total} page file.`)
    }
  }

  const output = await PDFDocument.create()

  // Copy in runs from the same document. copyPages is far cheaper called once
  // with many pages than once per page, because each call rebuilds shared
  // resources such as fonts.
  let index = 0
  while (index < items.length) {
    const docIdForRun = items[index].doc
    const run = []
    while (index < items.length && items[index].doc === docIdForRun) {
      run.push(items[index])
      index++
    }

    const source = documents.get(docIdForRun)
    // pdf-lib counts from 0, the interface counts from 1.
    const copied = await output.copyPages(source, run.map((item) => item.page - 1))

    copied.forEach((page, position) => {
      const extra = run[position].rotate || 0
      if (extra) {
        // PDF only allows 0, 90, 180 and 270, so wrap into that range.
        const turned = (page.getRotation().angle + extra) % 360
        page.setRotation(degrees((turned + 360) % 360))
      }
      output.addPage(page)
    })
  }

  const bytes = await output.save()
  return { bytes }
}

// A4 at 72 points per inch, the unit PDF pages are measured in.
const A4 = { width: 595.28, height: 841.89 }

/**
 * Build a PDF from JPEG and PNG images, one image per page.
 *
 * `images` is a list of { name, bytes }. `fit` is "image" to make each page
 * exactly the size of its image, or "a4" to place every image on an A4 page,
 * scaled to fit and centred.
 *
 * Only JPEG and PNG can be embedded. Anything else, including the HEIC that
 * iPhones produce by default, has to be converted first.
 */
export async function imagesToPdf({ images, fit = "a4" }) {
  if (!Array.isArray(images) || images.length === 0) {
    throw new Error("Select at least one image.")
  }

  const doc = await PDFDocument.create()

  for (const image of images) {
    const kind = imageKind(image.bytes)
    if (!kind) {
      throw new Error(
        `${image.name || "That file"} is not a JPG or PNG. Convert it first.`,
      )
    }

    let embedded
    try {
      embedded = kind === "jpg"
        ? await doc.embedJpg(image.bytes)
        : await doc.embedPng(image.bytes)
    } catch (error) {
      throw new Error(`${image.name || "That image"} could not be read.`)
    }

    if (fit === "image") {
      const page = doc.addPage([embedded.width, embedded.height])
      page.drawImage(embedded, { x: 0, y: 0, width: embedded.width, height: embedded.height })
      continue
    }

    // Scale to fit inside A4 without distorting, then centre it.
    const page = doc.addPage([A4.width, A4.height])
    const scale = Math.min(A4.width / embedded.width, A4.height / embedded.height)
    const width = embedded.width * scale
    const height = embedded.height * scale

    page.drawImage(embedded, {
      x: (A4.width - width) / 2,
      y: (A4.height - height) / 2,
      width,
      height,
    })
  }

  const bytes = await doc.save()
  return { bytes, pageCount: doc.getPageCount() }
}

/**
 * Identify an image by its magic bytes rather than its file extension, since
 * a name can lie about what a file actually contains.
 */
export function imageKind(bytes) {
  const view = new Uint8Array(bytes)
  if (view.length < 8) return null

  // JPEG starts FF D8 FF.
  if (view[0] === 0xff && view[1] === 0xd8 && view[2] === 0xff) return "jpg"

  // PNG starts with an 8 byte signature.
  const png = [0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]
  if (png.every((byte, i) => view[i] === byte)) return "png"

  return null
}

/**
 * Cut one document into several.
 *
 * `parts` is a list of { name, items }, each describing one output file in
 * the same shape build() takes. Returns a single ZIP, because browsers block
 * a page that tries to start several downloads at once.
 */
export async function splitToZip({ parts, zipName = "split.zip" }) {
  if (!Array.isArray(parts) || parts.length === 0) {
    throw new Error("Nothing to split.")
  }

  const entries = {}
  const used = new Set()

  for (const part of parts) {
    const { bytes } = await build({ items: part.items })

    // Two parts must never share a name or one would silently overwrite the
    // other inside the archive.
    let name = part.name
    let attempt = 2
    while (used.has(name)) {
      name = part.name.replace(/\.pdf$/i, "") + `-${attempt}.pdf`
      attempt++
    }
    used.add(name)

    entries[name] = bytes
  }

  // level 0 stores without compressing. PDF content is already compressed, so
  // squeezing it again costs time and saves almost nothing.
  const zipped = zipSync(entries, { level: 0 })
  return { bytes: zipped, name: zipName, fileCount: parts.length }
}

/**
 * Work out the page ranges for a split, without doing the split.
 *
 * `mode` is "at" to cut once after `after`, "every" to cut into chunks of
 * `size` pages, or "single" for one page per file. Returns a list of 1 based
 * page number arrays.
 */
export function splitRanges({ pageCount, mode, after = 1, size = 1 }) {
  if (!Number.isInteger(pageCount) || pageCount < 1) {
    throw new Error("That document has no pages.")
  }

  if (mode === "at") {
    if (!Number.isInteger(after) || after < 1 || after >= pageCount) {
      throw new Error(
        `Pick a page between 1 and ${pageCount - 1} to cut after.`,
      )
    }
    return [
      range(1, after),
      range(after + 1, pageCount),
    ]
  }

  if (mode === "every") {
    if (!Number.isInteger(size) || size < 1) {
      throw new Error("Each part must have at least one page.")
    }
    const parts = []
    for (let start = 1; start <= pageCount; start += size) {
      parts.push(range(start, Math.min(start + size - 1, pageCount)))
    }
    return parts
  }

  if (mode === "single") {
    return range(1, pageCount).map((n) => [n])
  }

  throw new Error(`Unknown split mode: ${mode}`)
}

function range(first, last) {
  const out = []
  for (let n = first; n <= last; n++) out.push(n)
  return out
}

/**
 * Pack already rendered images into a zip.
 *
 * Rendering happens on the main thread because a plain worker has no canvas,
 * so this takes the finished bytes rather than doing the drawing itself.
 */
export function zipImages({ images, zipName = "pages.zip" }) {
  if (!Array.isArray(images) || images.length === 0) {
    throw new Error("There are no images to save.")
  }

  const entries = {}
  for (const image of images) entries[image.name] = image.bytes

  // PNG and JPEG are already compressed, so storing is faster and no larger.
  return { bytes: zipSync(entries, { level: 0 }), name: zipName, fileCount: images.length }
}

/**
 * Return a loaded document as bytes again.
 *
 * Rendering needs a canvas, which a plain worker does not have, so the main
 * thread asks for the bytes back rather than the pages being drawn here.
 */
export async function bytesOf({ id }) {
  const doc = documents.get(id)
  if (!doc) throw new Error("That file is no longer loaded.")
  return { bytes: await doc.save() }
}

// Free a document once the caller has moved on.
export async function close({ id }) {
  documents.delete(id)
  return {}
}

// Testing helper: forget every loaded document so tests start clean.
export function reset() {
  documents.clear()
  nextId = 1
}
