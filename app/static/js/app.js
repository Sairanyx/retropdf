import * as pdfjs from "/static/js/vendor/pdf.min.mjs"
import { call } from "/static/js/pdf-worker.js"
// splitRanges is plain arithmetic with no PDF work, so it runs here rather
// than costing a round trip to the worker.
import { splitRanges, imageKind } from "/static/js/pdf-operations.js"

// pdf.js parses on its own background thread and needs to know where that
// code lives. Without this it fails with an unhelpful error.
pdfjs.GlobalWorkerOptions.workerSrc = "/static/js/vendor/pdf.worker.min.mjs"

const picker = document.querySelector("#picker")
const result = document.querySelector("#result")
const pagesEl = document.querySelector("#pages")
const downloadBtn = document.querySelector("#download")
// Present only on the pages that use them.
const splitOptions = document.querySelector("#split-options")
const imageOptions = document.querySelector("#image-options")
const exportOptions = document.querySelector("#export-options")

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

// Chosen images, for the images to PDF tool. Kept as bytes because they are
// not PDFs and never reach the worker as documents.
let chosenImages = []

// pdf.js documents kept for exporting pages as images, keyed by worker
// document id, so the bytes are only fetched back once per file.
const renderCache = new Map()

// The workspace has a tool switcher. A focused tool page does not, and
// states its tool in data-mode instead.
const workspace = document.querySelector("#workspace")
const switcher = document.querySelector('input[name="mode"]')

function currentMode() {
  const chosen = document.querySelector('input[name="mode"]:checked')
  return chosen ? chosen.value : workspace.dataset.mode
}

// What each mode sends to the worker, and what to call the result.
const modes = {
  merge: {
    controls: "move",
    hint: "Add more files, then download them as one PDF.",
    items: () => order.slice(),
    suffix: "-merged",
    empty: "Add at least one file.",
  },
  remove: {
    controls: "select",
    hint: "Click the pages you want to remove.",
    items: () => order.filter((entry) => !marked.has(entry.key)),
    suffix: "-edited",
    empty: "That would remove every page.",
  },
  extract: {
    controls: "select",
    hint: "Click the pages you want to keep.",
    items: () => order.filter((entry) => marked.has(entry.key)),
    suffix: "-extract",
    empty: "Choose at least one page to keep.",
  },
  reorder: {
    controls: "move",
    hint: "Use the arrows to move pages, then download.",
    items: () => order.slice(),
    suffix: "-reordered",
    empty: "There are no pages to save.",
  },
  rotate: {
    controls: "turn",
    hint: "Turn pages with the buttons, then download.",
    items: () => order.slice(),
    suffix: "-rotated",
    empty: "There are no pages to save.",
  },
  toimages: {
    controls: "none",
    hint: "Choose a size, then download a zip of PNG images.",
    items: () => order.slice(),
    suffix: "-images",
    empty: "There are no pages to export.",
  },
  frimages: {
    controls: "none",
    hint: "Choose JPG or PNG images to turn into one PDF.",
    items: () => [],
    suffix: "",
    empty: "Choose at least one image.",
  },
  split: {
    controls: "none",
    hint: "Choose where to cut, then download a zip of the parts.",
    items: () => order.slice(),
    suffix: "-split",
    empty: "There are no pages to split.",
  },
}

// Images to PDF takes pictures, every other tool takes PDFs.
function applyAccept() {
  picker.accept = currentMode() === "frimages"
    ? "image/jpeg,image/png"
    : "application/pdf"
}

applyAccept()

for (const radio of document.querySelectorAll('input[name="mode"]')) {
  radio.addEventListener("change", () => {
    const mode = currentMode()
    marked.clear()
    if (splitOptions) splitOptions.hidden = mode !== "split"
    if (imageOptions) imageOptions.hidden = mode !== "frimages"
    if (exportOptions) exportOptions.hidden = mode !== "toimages"

    applyAccept()
    reset()
    result.textContent = modes[mode].hint
  })
}

picker.addEventListener("change", async () => {
  const chosen = Array.from(picker.files)
  if (chosen.length === 0) return

  if (currentMode() === "frimages") {
    await addImages(chosen)
    picker.value = ""
    return
  }

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
  chosenImages = []
  renderCache.clear()
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
  const kind = modes[mode].controls
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
      if (kind !== "select") {
        canvas.style.opacity = "1"
      } else if (marked.has(entry.key)) {
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

    if (kind === "move") {
      const controls = document.createElement("div")
      controls.append(
        moveButton("left", position, position - 1, position === 0),
        moveButton("right", position, position + 1, position === order.length - 1),
      )
      box.appendChild(controls)
    } else if (kind === "turn") {
      const controls = document.createElement("div")
      controls.append(turnButton(entry, -90), turnButton(entry, 90))
      box.appendChild(controls)
    } else if (kind === "select") {
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
  } else if (mode === "remove") {
    result.textContent = `${marked.size} of ${order.length} pages marked for removal`
  } else {
    result.textContent = modes[mode].hint
  }
}

// Hand bytes to the browser as a download. Nothing is uploaded: the URL
// points at memory in this tab and is released straight afterwards.
function save(bytes, filename, type) {
  const blob = new Blob([bytes], { type })
  const url = URL.createObjectURL(blob)

  const link = document.createElement("a")
  link.href = url
  link.download = filename
  link.click()

  URL.revokeObjectURL(url)
}

async function downloadSplit() {
  const splitMode = document.querySelector('input[name="split"]:checked').value
  const after = Number(document.querySelector("#split-after").value)
  const size = Number(document.querySelector("#split-size").value)

  const ranges = splitRanges({ pageCount: order.length, mode: splitMode, after, size })
  const stem = (files.values().next().value || "document.pdf").replace(/\.pdf$/i, "")

  // Range positions refer to the workspace order, so any reordering or
  // rotation the user did is carried into the parts.
  const parts = ranges.map((positions, index) => ({
    name: `${stem}-${index + 1}.pdf`,
    items: positions.map((position) => {
      const { doc, page, rotate } = order[position - 1]
      return { doc, page, rotate }
    }),
  }))

  result.textContent = `Building ${parts.length} files...`
  const zip = await call("splitToZip", { parts, zipName: `${stem}-split.zip` })

  save(zip.bytes, zip.name, "application/zip")
  result.textContent = `Saved ${zip.fileCount} files as ${zip.name}`
}

downloadBtn.addEventListener("click", async () => {
  if (order.length === 0 && chosenImages.length === 0) return

  const special = {
    split: downloadSplit,
    toimages: downloadPdfToImages,
    frimages: downloadImagesToPdf,
  }[currentMode()]

  if (special) {
    try {
      await special()
    } catch (error) {
      result.textContent = error.message
    }
    return
  }

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

    const first = files.values().next().value || "document.pdf"
    const name = first.replace(/\.pdf$/i, "") + mode.suffix + ".pdf"
    save(bytes, name, "application/pdf")
    result.textContent = `Saved ${items.length} pages.`
  } catch (error) {
    result.textContent = error.message
  }
})

// --- images to PDF -----------------------------------------------------

async function addImages(chosen) {
  for (const file of chosen) {
    const bytes = new Uint8Array(await file.arrayBuffer())

    // Check what the file really is, since a name can lie about its contents.
    if (!imageKind(bytes)) {
      result.textContent = `${file.name} is not a JPG or PNG. Convert it first.`
      return
    }

    chosenImages.push({ name: file.name, bytes })
  }

  downloadBtn.disabled = false
  drawImages()
  result.textContent = `${chosenImages.length} image(s) ready.`
}

function drawImages() {
  pagesEl.replaceChildren()

  chosenImages.forEach((image, position) => {
    const box = document.createElement("div")
    box.style.display = "inline-block"
    box.style.margin = "4px"
    box.style.padding = "4px"
    box.style.border = "1px solid #ccc"
    box.style.textAlign = "center"
    box.style.verticalAlign = "top"

    // A blob URL points at memory in this tab. Nothing is uploaded.
    const preview = document.createElement("img")
    const url = URL.createObjectURL(new Blob([image.bytes]))
    preview.src = url
    preview.style.maxWidth = "120px"
    preview.style.maxHeight = "160px"
    preview.style.display = "block"
    preview.addEventListener("load", () => URL.revokeObjectURL(url))
    box.appendChild(preview)

    const label = document.createElement("div")
    label.textContent = shortName(image.name)
    label.style.fontSize = "12px"
    box.appendChild(label)

    const controls = document.createElement("div")
    controls.append(
      imageMoveButton(position, position - 1, "<", position === 0),
      imageMoveButton(position, position + 1, ">", position === chosenImages.length - 1),
    )
    box.appendChild(controls)

    pagesEl.appendChild(box)
  })
}

function imageMoveButton(from, to, label, disabled) {
  const button = document.createElement("button")
  button.textContent = label
  button.disabled = disabled
  button.addEventListener("click", () => {
    const moved = chosenImages.splice(from, 1)[0]
    chosenImages.splice(to, 0, moved)
    drawImages()
  })
  return button
}

async function downloadImagesToPdf() {
  const fit = document.querySelector('input[name="fit"]:checked').value

  result.textContent = "Building..."
  const { bytes, pageCount } = await call("imagesToPdf", { images: chosenImages, fit })

  save(bytes, "images.pdf", "application/pdf")
  result.textContent = `Saved a ${pageCount} page PDF.`
}

// --- PDF to images -----------------------------------------------------

async function downloadPdfToImages() {
  const scale = Number(document.querySelector("#export-scale").value)
  const stem = (files.values().next().value || "document.pdf").replace(/\.pdf$/i, "")

  // Rendering needs a canvas, which a plain worker does not have, so this
  // runs on the main thread. Each page is drawn then released before the
  // next, to keep only one full size canvas in memory at a time.
  const images = []
  for (const [position, entry] of order.entries()) {
    result.textContent = `Rendering ${position + 1} of ${order.length}...`
    const bytes = await renderPageToPng(entry, scale)
    images.push({
      name: `${stem}-${String(position + 1).padStart(3, "0")}.png`,
      bytes,
    })
  }

  const zip = await call("zipImages", { images, zipName: `${stem}-images.zip` })
  save(zip.bytes, zip.name, "application/zip")
  result.textContent = `Saved ${zip.fileCount} images as ${zip.name}`
}

async function renderPageToPng(entry, scale) {
  let pdf = renderCache.get(entry.doc)
  if (!pdf) {
    // Ask the worker for the original bytes so pdf.js can render from them.
    const { bytes } = await call("bytesOf", { id: entry.doc })
    const task = pdfjs.getDocument({ data: bytes, isEvalSupported: false })
    pdf = await task.promise
    renderCache.set(entry.doc, pdf)
  }

  const page = await pdf.getPage(entry.page)
  const viewport = page.getViewport({ scale, rotation: (page.rotate + entry.rotate) % 360 })

  const canvas = document.createElement("canvas")
  canvas.width = viewport.width
  canvas.height = viewport.height

  await page.render({ canvasContext: canvas.getContext("2d"), viewport }).promise

  const blob = await new Promise((resolve) => canvas.toBlob(resolve, "image/png"))
  return new Uint8Array(await blob.arrayBuffer())
}
