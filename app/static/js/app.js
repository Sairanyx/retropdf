import * as pdfjs from "/static/js/vendor/pdf.min.mjs"
import { call } from "/static/js/pdf-worker.js"

// pdf.js parses on its own background thread and needs to know where that
// code lives. Without this it fails with an unhelpful error.
pdfjs.GlobalWorkerOptions.workerSrc = "/static/js/vendor/pdf.worker.min.mjs"

const picker = document.querySelector("#picker")
const result = document.querySelector("#result")
const pagesEl = document.querySelector("#pages")
const downloadBtn = document.querySelector("#download")

// Page numbers the user clicked, counting from 1.
const marked = new Set()

// The current page order. Reordering rearranges this, the other tools leave
// it alone. Always holds every page of the document exactly once.
let order = []

// The document the worker is holding for us.
let docId = null
let pageCount = 0
let sourceName = "document.pdf"

function currentMode() {
  return document.querySelector('input[name="mode"]:checked').value
}

// What each mode sends to the worker, and what to call the result.
const modes = {
  remove: {
    hint: "Click the pages you want to remove.",
    pages: () => order.filter((n) => !marked.has(n)),
    suffix: "-edited",
    empty: "That would remove every page.",
  },
  extract: {
    hint: "Click the pages you want to keep.",
    pages: () => order.filter((n) => marked.has(n)),
    suffix: "-extract",
    empty: "Choose at least one page to keep.",
  },
  reorder: {
    hint: "Use the arrows to move pages, then download.",
    pages: () => order.slice(),
    suffix: "-reordered",
    empty: "There are no pages to save.",
  },
}

for (const radio of document.querySelectorAll('input[name="mode"]')) {
  radio.addEventListener("change", () => {
    marked.clear()
    if (docId !== null) drawPages()
    result.textContent = modes[currentMode()].hint
  })
}

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
    order = Array.from({ length: pageCount }, (unused, i) => i + 1)

    downloadBtn.disabled = false
    await renderThumbnails(forRendering)

    result.textContent = `${file.name}, ${pageCount} pages. ${modes[currentMode()].hint}`
  } catch (error) {
    result.textContent = error.message
  }
})

// Thumbnails are rendered once and kept, so reordering can move the existing
// canvases around instead of drawing them again.
const thumbnails = new Map()

async function renderThumbnails(bytes) {
  thumbnails.clear()

  const task = pdfjs.getDocument({ data: bytes, isEvalSupported: false })
  const pdf = await task.promise

  for (let n = 1; n <= pdf.numPages; n++) {
    const page = await pdf.getPage(n)
    const viewport = page.getViewport({ scale: 0.3 })

    const canvas = document.createElement("canvas")
    canvas.width = viewport.width
    canvas.height = viewport.height

    await page.render({
      canvasContext: canvas.getContext("2d"),
      viewport,
    }).promise

    thumbnails.set(n, canvas)
    result.textContent = `Rendering ${n} of ${pdf.numPages}...`
    drawPages()
  }
}

// Rebuild the grid from `order`, wrapping each thumbnail in its controls.
function drawPages() {
  const mode = currentMode()
  pagesEl.replaceChildren()

  order.forEach((n, position) => {
    const canvas = thumbnails.get(n)
    if (!canvas) return

    const box = document.createElement("div")
    box.style.display = "inline-block"
    box.style.margin = "4px"
    box.style.textAlign = "center"
    box.style.border = "1px solid #ccc"
    box.style.padding = "4px"

    if (marked.has(n)) {
      box.style.borderColor = "#c8452a"
      canvas.style.opacity = mode === "extract" ? "1" : "0.4"
    } else {
      canvas.style.opacity = mode === "extract" ? "0.4" : "1"
    }

    box.appendChild(canvas)

    const label = document.createElement("div")
    label.textContent = `page ${n}`
    label.style.fontSize = "12px"
    box.appendChild(label)

    if (mode === "reorder") {
      const controls = document.createElement("div")
      controls.append(
        moveButton("left", position, position - 1, position === 0),
        moveButton("right", position, position + 1, position === order.length - 1),
      )
      box.appendChild(controls)
    } else {
      canvas.style.cursor = "pointer"
      box.style.cursor = "pointer"
      box.addEventListener("click", () => {
        if (marked.has(n)) marked.delete(n)
        else marked.add(n)
        drawPages()
        reportSelection()
      })
    }

    pagesEl.appendChild(box)
  })
}

function moveButton(direction, from, to, disabled) {
  const button = document.createElement("button")
  button.textContent = direction === "left" ? "←" : "→"
  button.title = direction === "left" ? "Move earlier" : "Move later"
  button.disabled = disabled
  button.addEventListener("click", () => {
    const moved = order.splice(from, 1)[0]
    order.splice(to, 0, moved)
    drawPages()
    result.textContent = `New order: ${order.join(", ")}`
  })
  return button
}

function reportSelection() {
  const mode = currentMode()
  if (mode === "extract") {
    result.textContent = `${marked.size} of ${pageCount} pages selected to keep`
  } else {
    result.textContent = `${marked.size} of ${pageCount} pages marked for removal`
  }
}

downloadBtn.addEventListener("click", async () => {
  if (docId === null) return

  const mode = modes[currentMode()]
  const pages = mode.pages()

  if (pages.length === 0) {
    result.textContent = mode.empty
    return
  }

  try {
    result.textContent = "Building..."
    const { bytes } = await call("build", { id: docId, pages })

    const blob = new Blob([bytes], { type: "application/pdf" })
    const url = URL.createObjectURL(blob)

    const link = document.createElement("a")
    link.href = url
    link.download = sourceName.replace(/\.pdf$/i, "") + mode.suffix + ".pdf"
    link.click()

    URL.revokeObjectURL(url)
    result.textContent = `Saved ${pages.length} pages.`
  } catch (error) {
    result.textContent = error.message
  }
})
