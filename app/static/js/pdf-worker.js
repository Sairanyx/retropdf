// A thin wrapper around the PDF worker.
//
// Talking to a worker means posting a message and waiting for an unrelated
// reply to arrive later. This module tags every request with an id and keeps
// track of what is waiting, so callers can write:
//
//   const { pageCount } = await call("load", { bytes }, [bytes])
//
// and treat it like any other async function.

const worker = new Worker("/static/js/worker.js", { type: "module" })

// Requests that have been sent but not yet answered, keyed by request id.
const pending = new Map()
let nextRequestId = 1

worker.addEventListener("message", (event) => {
  const { requestId, result, error } = event.data
  const waiting = pending.get(requestId)
  if (!waiting) return

  pending.delete(requestId)
  if (error) waiting.reject(new Error(error))
  else waiting.resolve(result)
})

worker.addEventListener("error", (event) => {
  for (const waiting of pending.values()) {
    waiting.reject(new Error(event.message || "The PDF worker failed."))
  }
  pending.clear()
})

/**
 * Send one operation to the worker and wait for its reply.
 *
 * `transfer` lists ArrayBuffers whose ownership moves to the worker instead of
 * being copied. Transferring a large PDF avoids briefly holding it twice, but
 * the buffer becomes unusable here afterwards, so pass a copy if it is still
 * needed on this side.
 */
export function call(op, payload = {}, transfer = []) {
  const requestId = nextRequestId++

  return new Promise((resolve, reject) => {
    pending.set(requestId, { resolve, reject })
    worker.postMessage({ requestId, op, payload }, transfer)
  })
}
