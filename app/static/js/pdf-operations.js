// The PDF operations themselves, with no reference to workers, messages or
// the browser. Keeping them here means they can be tested directly in Node,
// and the worker becomes a thin message handling wrapper.

import { PDFDocument, degrees } from "/static/js/vendor/pdf-lib.esm.min.js"

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
