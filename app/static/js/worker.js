// Runs on a background thread. It has no access to the page: no document, no
// canvas, no buttons. It receives messages, does the slow PDF work, and sends
// results back.
//
// Keeping this off the main thread is what stops a large PDF from freezing
// the tab while it is being processed.

import { PDFDocument, degrees } from "/static/js/vendor/pdf-lib.esm.min.js"

// Documents the main thread has loaded, kept by id so it can refer to them
// later without sending the bytes again.
const documents = new Map()
let nextId = 1

// Each operation takes the message payload and returns whatever should be
// sent back. Throwing here becomes an error reply on the main thread.
const operations = {
  async load({ bytes }) {
    const doc = await PDFDocument.load(bytes)
    const id = nextId++
    documents.set(id, doc)
    return { id, pageCount: doc.getPageCount() }
  },

  // Build a new document from the given 1 based page numbers, in that order.
  //
  // `rotations` optionally maps a page number to extra degrees to turn it,
  // added on top of whatever rotation the page already carries. Doing this
  // inside build means one call can remove, reorder and rotate at once.
  async build({ id, pages, rotations = {} }) {
    const source = documents.get(id)
    if (!source) throw new Error("That document is no longer loaded.")

    if (pages.length === 0) throw new Error("No pages were selected.")

    const total = source.getPageCount()
    for (const n of pages) {
      if (!Number.isInteger(n) || n < 1 || n > total) {
        throw new Error(`Page ${n} does not exist in a ${total} page document.`)
      }
    }

    const output = await PDFDocument.create()
    // pdf-lib counts from 0, the interface counts from 1.
    const copied = await output.copyPages(source, pages.map((n) => n - 1))

    copied.forEach((page, index) => {
      const extra = rotations[pages[index]] || 0
      if (extra) {
        // PDF only allows 0, 90, 180 and 270, so wrap into that range.
        const turned = (page.getRotation().angle + extra) % 360
        page.setRotation(degrees((turned + 360) % 360))
      }
      output.addPage(page)
    })

    const bytes = await output.save()
    return { bytes }
  },

  // Free a document once the user has moved on.
  async close({ id }) {
    documents.delete(id)
    return {}
  },
}

self.addEventListener("message", async (event) => {
  const { requestId, op, payload } = event.data
  const run = operations[op]

  if (!run) {
    self.postMessage({ requestId, error: `Unknown operation: ${op}` })
    return
  }

  try {
    const result = await run(payload)

    // Hand ownership of any returned bytes back rather than copying them.
    const transfer = result.bytes ? [result.bytes.buffer] : []
    self.postMessage({ requestId, result }, transfer)
  } catch (error) {
    self.postMessage({ requestId, error: error.message })
  }
})
