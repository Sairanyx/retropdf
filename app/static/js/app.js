import { PDFDocument } from "/static/js/vendor/pdf-lib.esm.min.js"
import * as pdfjs from "/static/js/vendor/pdf.min.mjs"

// pdf.js parses on its own background thread and needs to know where that
// code lives. Without this it fails with an unhelpful error.
pdfjs.GlobalWorkerOptions.workerSrc = "/static/js/vendor/pdf.worker.min.mjs"

const picker = document.querySelector("#picker")
const result = document.querySelector("#result")
const pagesEl = document.querySelector("#pages")
const downloadBtn = document.querySelector("#download")

// Page numbers the user marked for removal, counting from 1.
const marked = new Set()

// Bytes of the chosen file, kept so the output can be rebuilt from them.
let sourceBytes = null
let sourceName = "document.pdf"

picker.addEventListener("change", async () => {
  const file = picker.files[0]
  if (!file) return

  result.textContent = "Reading..."
  const bytes = await file.arrayBuffer()

  marked.clear()
  sourceBytes = bytes.slice(0)
  sourceName = file.name
  downloadBtn.disabled = false

  // pdf-lib reads the structure, so it can tell us the page count.
  const doc = await PDFDocument.load(bytes)
  result.textContent = `${file.name}, ${doc.getPageCount()} pages`

  // pdf.js draws each page into its own small canvas.
  pagesEl.replaceChildren()

  const task = pdfjs.getDocument({ data: bytes.slice(0), isEvalSupported: false })
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
      result.textContent = `${marked.size} of ${pdf.numPages} pages marked for removal`
    })

    await page.render({
      canvasContext: canvas.getContext("2d"),
      viewport,
    }).promise

    result.textContent = `${file.name}: rendered ${n} of ${pdf.numPages}`
  }

  result.textContent = `${file.name}, ${pdf.numPages} pages. Click pages to remove them.`
})

downloadBtn.addEventListener("click", async () => {
  if (!sourceBytes) return

  const source = await PDFDocument.load(sourceBytes.slice(0))
  const output = await PDFDocument.create()

  // pdf-lib counts pages from 0, the interface counts from 1.
  const keep = []
  for (let n = 1; n <= source.getPageCount(); n++) {
    if (!marked.has(n)) keep.push(n - 1)
  }

  if (keep.length === 0) {
    result.textContent = "That would remove every page."
    return
  }

  const copied = await output.copyPages(source, keep)
  for (const page of copied) output.addPage(page)

  const bytes = await output.save()
  const blob = new Blob([bytes], { type: "application/pdf" })
  const url = URL.createObjectURL(blob)

  const link = document.createElement("a")
  link.href = url
  link.download = sourceName.replace(/\.pdf$/i, "") + "-edited.pdf"
  link.click()

  URL.revokeObjectURL(url)
  result.textContent = `Saved ${keep.length} pages, removed ${marked.size}`
})
