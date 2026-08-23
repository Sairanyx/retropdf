import * as pdfjs from "/static/js/vendor/pdf.min.mjs"
import { call } from "/static/js/pdf-worker.js"

// pdf.js parses on its own background thread and needs to know where that
// code lives. Without this it fails with an unhelpful error.
pdfjs.GlobalWorkerOptions.workerSrc = "/static/js/vendor/pdf.worker.min.mjs"

const picker = document.querySelector("#picker")
const result = document.querySelector("#result")
const pagesEl = document.querySelector("#pages")
const downloadBtn = document.querySelector("#download")

// Every page currently in the workspace, in output order. Each entry is
// { doc, page, rotate, key }, where `doc` is a worker document id and `key`
// identifies the entry for selection and thumbnail lookup.
let order = []

// Keys of the pages the user clicked.
const marked = new Set()

// Loaded files, keyed by worker document id, so names can be shown.
const files = new Map()

// Rendered thumbnails, keyed by entry key. Rendering is the slow part, so
// each page is drawn once and the canvas is then moved around.
const thumbnails = new Map()

function currentMode() {
  return document.querySelector('input[name="mode"]:checked').value
}

// What each mode sends to the worker, and what to call the result.
const modes = {
  merge: {
    hint: "Add more files, then download them as one PDF.",
    items: () => order.slice(),
    suffix: "-merged",
    empty: "Add at least one file.",
  },
  remove: {
    hint: "Click the pages you want to remove.",
    items: () => order.filter((entry) => !marked.has(entry.key)),
    suffix: "-edited",
    empty: "That would remove every page.",
  },
  extract: {
    hint: "Click the pages you want to keep.",
    items: () => order.filter((entry) => marked.has(entry.key)),
    suffix: "-extract",
    empty: "Choose at least one page to keep.",
  },
  reorder: {
    hint: "Use the arrows to move pages, then download.",
    items: () => order.slice(),
    suffix: "-reordered",
    empty: "There are no pages to save.",
  },
  rotate: {
    hint: "Turn pages with the buttons, then download.",
    items: () => order.slice(),
    suffix: "-rotated",
    empty: "There are no pages to save.",
  },
}

for (const radio of document.querySelectorAll('input[name="mode"]')) {
  radio.addEventListener("change", () => {
    marked.clear()
    drawPages()
    result.textContent = modes[currentMode()].hint
  })
}

picker.addEventListener("change", async () => {
  const chosen = Array.from(picker.files)
  if (chosen.length === 0) return

  // Merge adds to what is already there. The single file tools replace it.
  if (currentMode() !== "merge") reset()

  downloadBtn.disabled = true

  try {
    for (const file of chosen) {
      result.textContent = `Reading ${file.name}...`
      const bytes = await file.arrayBuffer()

      // pdf.js needs its own copy because the worker takes ownership of the
      // buffer it is given.
      const forRendering = bytes.slice(0)

      const loaded = await call("load", { bytes }, [bytes])
      files.set(loaded.id, file.name)

      for (let page = 1; page <= loaded.pageCount; page++) {
        order.push({
          doc: loaded.id,
          page,
          rotate: 0,
          key: `${loaded.id}:${page}`,
        })
      }

      drawPages()
      await renderThumbnails(loaded.id, forRendering)
    }

    downloadBtn.disabled = false
    result.textContent = `${order.length} pages from ${files.size} file(s). ${modes[currentMode()].hint}`
  } catch (error) {
    result.textContent = error.message
  }

  // Let the same file be chosen again later.
  picker.value = ""
})

function reset() {
  for (const id of files.keys()) call("close", { id })
  files.clear()
  thumbnails.clear()
  marked.clear()
  order = []
  pagesEl.replaceChildren()
}

async function renderThumbnails(docId, bytes) {
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

    thumbnails.set(`${docId}:${n}`, canvas)
    result.textContent = `Rendering ${n} of ${pdf.numPages}...`
    drawPages()
  }
}

// Rebuild the grid from `order`, wrapping each thumbnail in its controls.
function drawPages() {
  const mode = currentMode()
  pagesEl.replaceChildren()

  order.forEach((entry, position) => {
    const canvas = thumbnails.get(entry.key)

    const box = document.createElement("div")
    box.style.display = "inline-block"
    box.style.margin = "4px"
    box.style.padding = "4px"
    box.style.textAlign = "center"
    box.style.border = "1px solid #ccc"
    box.style.verticalAlign = "top"

    if (canvas) {
      if (marked.has(entry.key)) {
        box.style.borderColor = "#c8452a"
        canvas.style.opacity = mode === "extract" ? "1" : "0.4"
      } else {
        canvas.style.opacity = mode === "extract" ? "0.4" : "1"
      }
      canvas.style.transform = entry.rotate ? `rotate(${entry.rotate}deg)` : ""
      box.appendChild(canvas)
    } else {
      const placeholder = document.createElement("div")
      placeholder.textContent = "..."
      placeholder.style.width = "120px"
      placeholder.style.height = "160px"
      box.appendChild(placeholder)
    }

    const label = document.createElement("div")
    label.textContent = files.size > 1
      ? `${shortName(files.get(entry.doc))} p${entry.page}`
      : `page ${entry.page}`
    label.style.fontSize = "12px"
    box.appendChild(label)

    if (mode === "reorder" || mode === "merge") {
      const controls = document.createElement("div")
      controls.append(
        moveButton("left", position, position - 1, position === 0),
        moveButton("right", position, position + 1, position === order.length - 1),
      )
      box.appendChild(controls)
    } else if (mode === "rotate") {
      const controls = document.createElement("div")
      controls.append(turnButton(entry, -90), turnButton(entry, 90))
      box.appendChild(controls)
    } else {
      box.style.cursor = "pointer"
      box.addEventListener("click", () => {
        if (marked.has(entry.key)) marked.delete(entry.key)
        else marked.add(entry.key)
        drawPages()
        reportSelection()
      })
    }

    pagesEl.appendChild(box)
  })
}

function shortName(name = "file") {
  const stem = name.replace(/\.pdf$/i, "")
  return stem.length > 12 ? stem.slice(0, 11) + "…" : stem
}

function moveButton(direction, from, to, disabled) {
  const button = document.createElement("button")
  button.textContent = direction === "left" ? "<" : ">"
  button.title = direction === "left" ? "Move earlier" : "Move later"
  button.disabled = disabled
  button.addEventListener("click", () => {
    const moved = order.splice(from, 1)[0]
    order.splice(to, 0, moved)
    drawPages()
    result.textContent = "Order updated."
  })
  return button
}

function turnButton(entry, amount) {
  const button = document.createElement("button")
  button.textContent = amount < 0 ? "left" : "right"
  button.addEventListener("click", () => {
    entry.rotate = (entry.rotate + amount + 360) % 360
    drawPages()
    const turned = order.filter((item) => item.rotate !== 0).length
    result.textContent = turned
      ? `${turned} of ${order.length} pages rotated`
      : "No pages rotated"
  })
  return button
}

function reportSelection() {
  const mode = currentMode()
  if (mode === "extract") {
    result.textContent = `${marked.size} of ${order.length} pages selected to keep`
  } else {
    result.textContent = `${marked.size} of ${order.length} pages marked for removal`
  }
}

downloadBtn.addEventListener("click", async () => {
  if (order.length === 0) return

  const mode = modes[currentMode()]
  const items = mode.items()

  if (items.length === 0) {
    result.textContent = mode.empty
    return
  }

  try {
    result.textContent = "Building..."
    const { bytes } = await call("build", {
      items: items.map(({ doc, page, rotate }) => ({ doc, page, rotate })),
    })

    const blob = new Blob([bytes], { type: "application/pdf" })
    const url = URL.createObjectURL(blob)

    const first = files.values().next().value || "document.pdf"
    const link = document.createElement("a")
    link.href = url
    link.download = first.replace(/\.pdf$/i, "") + mode.suffix + ".pdf"
    link.click()

    URL.revokeObjectURL(url)
    result.textContent = `Saved ${items.length} pages.`
  } catch (error) {
    result.textContent = error.message
  }
})
