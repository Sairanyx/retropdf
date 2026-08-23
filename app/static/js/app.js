import * as pdfjs from "/static/js/vendor/pdf.min.mjs"
import { call } from "/static/js/pdf-worker.js"

// pdf.js parses on its own background thread and needs to know where that
// code lives. Without this it fails with an unhelpful error.
pdfjs.GlobalWorkerOptions.workerSrc = "/static/js/vendor/pdf.worker.min.mjs"

const picker = document.querySelector("#picker")
const result = document.querySelector("#result")
const pagesEl = document.querySelector("#pages")
const downloadBtn = document.querySelector("#download")

// Page numbers the user marked for removal, counting from 1.
const marked = new Set()

// The document the worker is holding for us.
let docId = null
let pageCount = 0
let sourceName = "document.pdf"

picker.addEventListener("change", async () => {
  const file = picker.files[0]
  if (!file) return

  result.textContent = "Reading..."
  downloadBtn.disabled = true
  marked.clear()
  pagesEl.replaceChildren()

  const bytes = await file.arrayBuffer()
  sourceName = file.name

  try {
    // Tell the worker to forget the previous document before loading another.
    if (docId !== null) await call("close", { id: docId })

    // pdf.js needs its own copy because the worker takes ownership of the
    // buffer it is given.
    const forRendering = bytes.slice(0)

    const loaded = await call("load", { bytes }, [bytes])
    docId = loaded.id
    pageCount = loaded.pageCount

    downloadBtn.disabled = false
    await renderThumbnails(forRendering)

    result.textContent = `${file.name}, ${pageCount} pages. Click pages to remove them.`
  } catch (error) {
    result.textContent = error.message
  }
})

async function renderThumbnails(bytes) {
  const task = pdfjs.getDocument({ data: bytes, isEvalSupported: false })
  const pdf = await task.promise

  for (let n = 1; n <= pdf.numPages; n++) {
    const page = await pdf.getPage(n)
    const viewport = page.getViewport({ scale: 0.3 })

    const canvas = document.createElement("canvas")
    canvas.width = viewport.width
    canvas.height = viewport.height
    canvas.style.border = "1px solid #ccc"
    canvas.style.margin = "4px"
    canvas.style.cursor = "pointer"

    pagesEl.appendChild(canvas)

    canvas.addEventListener("click", () => {
      if (marked.has(n)) {
        marked.delete(n)
        canvas.style.opacity = "1"
        canvas.style.borderColor = "#ccc"
      } else {
        marked.add(n)
        canvas.style.opacity = "0.4"
        canvas.style.borderColor = "#c8452a"
      }
      result.textContent = `${marked.size} of ${pageCount} pages marked for removal`
    })

    await page.render({
      canvasContext: canvas.getContext("2d"),
      viewport,
    }).promise

    result.textContent = `Rendering ${n} of ${pdf.numPages}...`
  }
}

downloadBtn.addEventListener("click", async () => {
  if (docId === null) return

  const keep = []
  for (let n = 1; n <= pageCount; n++) {
    if (!marked.has(n)) keep.push(n)
  }

  try {
    result.textContent = "Building..."
    const { bytes } = await call("build", { id: docId, pages: keep })

    const blob = new Blob([bytes], { type: "application/pdf" })
    const url = URL.createObjectURL(blob)

    const link = document.createElement("a")
    link.href = url
    link.download = sourceName.replace(/\.pdf$/i, "") + "-edited.pdf"
    link.click()

    URL.revokeObjectURL(url)
    result.textContent = `Saved ${keep.length} pages, removed ${marked.size}`
  } catch (error) {
    result.textContent = error.message
  }
})
