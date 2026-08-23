// Runs on a background thread. It has no access to the page: no document, no
// canvas, no buttons. It receives messages, runs the requested operation, and
// sends the result back.
//
// Keeping this off the main thread is what stops a large PDF from freezing
// the tab while it is being processed. The operations themselves live in
// pdf-operations.js so they can be tested without a browser.

import * as operations from "/static/js/pdf-operations.js"

self.addEventListener("message", async (event) => {
  const { requestId, op, payload } = event.data
  const run = operations[op]

  if (typeof run !== "function") {
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
