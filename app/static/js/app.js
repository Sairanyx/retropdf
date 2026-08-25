import * as pdfjs from "/static/js/vendor/pdf.min.mjs"
import { call } from "/static/js/pdf-worker.js"
// splitRanges is plain arithmetic with no PDF work, so it runs here rather
// than costing a round trip to the worker.
import { splitRanges, imageKind } from "/static/js/pdf-operations.js"
import { checkSelection, looksLikePdf, LIMITS, MAX_FILES, formatSize, deviceName } from "/static/js/limits.js"
import { acceptDroppedFiles, makeReorderable } from "/static/js/dragdrop.js"

// pdf.js parses on its own background thread and needs to know where that
// code lives. Without this it fails with an unhelpful error.
pdfjs.GlobalWorkerOptions.workerSrc = "/static/js/vendor/pdf.worker.min.mjs"

const picker = document.querySelector("#picker")
const result = document.querySelector("#result")
const pagesEl = document.querySelector("#pages")
const downloadBtn = document.querySelector("#download")
const startOver = document.querySelector("#start-over")

// Anyone who has asked their system for less movement gets none: pages
// change place instantly rather than sliding.
const wantsLessMotion =
  window.matchMedia("(prefers-reduced-motion: reduce)").matches
/**
 * Light the download button once there is something to save.
 *
 * The same lamp the navigation uses: dark when there is nothing to do, lit
 * when there is. Only Download carries one. The Select button is already the
 * accent colour, so a lamp in that colour on top of it says nothing.
 *
 * Driven from the button's own disabled state rather than toggled at each
 * call site, so the lamp cannot drift out of step with what the page holds.
 */
function paintLamps() {
  downloadBtn?.classList.toggle("on", !downloadBtn.disabled)
  // Nothing open, nothing to clear.
  if (startOver) {
    startOver.hidden = order.length === 0 && chosenImages.length === 0
  }
}

/**
 * Say whether the page is busy.
 *
 * Shows in two places at once: the pointer becomes an hourglass, which is
 * where the eye already is, and the status line grows a blinking indicator,
 * which stays visible when the pointer is somewhere else entirely.
 *
 * Counted rather than set to a flag, since reading several files starts and
 * finishes several times over and the last one finishing must not clear an
 * indicator another is still relying on.
 */
let busy = 0
function working(yes) {
  busy = Math.max(0, busy + (yes ? 1 : -1))
  document.body.classList.toggle("working", busy > 0)
  result.classList.toggle("busy", busy > 0)
}
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

// The opened pdf.js documents, by worker document id, so a page can be drawn
// again at a larger size without reading the file a second time.
const rendered = new Map()

// Chosen images, for the images to PDF tool. Kept as bytes because they are
// not PDFs and never reach the worker as documents.
let chosenImages = []

// Bytes of everything currently loaded, to keep one operation within what
// a browser tab can hold.
let loadedBytes = 0

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
    hint: "Pick the pages you want to remove.",
    items: () => order.filter((entry) => !marked.has(entry.key)),
    suffix: "-edited",
    empty: "That would remove every page.",
  },
  extract: {
    controls: "select",
    hint: "Pick the pages you want to keep.",
    items: () => order.filter((entry) => marked.has(entry.key)),
    suffix: "-extract",
    empty: "Pick at least one page to keep.",
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
    hint: "Pick a size, then download a zip of PNG images.",
    items: () => order.slice(),
    suffix: "-images",
    empty: "There are no pages to export.",
  },
  frimages: {
    controls: "none",
    hint: "Select JPG or PNG images to turn into one PDF.",
    items: () => [],
    suffix: "",
    empty: "Select at least one image.",
  },
  split: {
    controls: "none",
    hint: "Pick where to cut, then download a zip of the parts.",
    items: () => order.slice(),
    suffix: "-split",
    empty: "There are no pages to split.",
  },
}

// Images to PDF takes pictures, every other tool takes PDFs. The picker is
// hidden behind a styled label, so the label has to say what will open.
const pickerLabel = document.querySelector('label[for="picker"]')

function applyAccept() {
  const wantsImages = currentMode() === "frimages"
  picker.accept = wantsImages ? "image/jpeg,image/png" : "application/pdf"

  if (pickerLabel) {
    const led = pickerLabel.querySelector(".led")
    pickerLabel.textContent = wantsImages ? "Select images " : "Select files "
    if (led) pickerLabel.appendChild(led)
  }
}

applyAccept()
showLimit()

// Say up front what this device can handle, rather than only mentioning it
// when someone has already chosen a file that is too big.
function showLimit() {
  const note = document.querySelector("#limit-note")
  if (!note) return

  // Named after whatever the reader is actually using, so the figure reads
  // as something measured about their machine rather than a rule we invented.
  // It falls back to "device" whenever the browser will not say plainly.
  //
  // The figures come first: the old wording opened with "On this device you
  // can work with up to", which buried the one thing being asked for in the
  // middle of a sentence.
  note.textContent =
    `On this ${deviceName()}: ${formatSize(LIMITS.maxFile)} per file, ` +
    `${formatSize(LIMITS.maxTotal)} at once.` +
    (LIMITS.mobile ? " A computer takes more." : "")
}

/**
 * Show only the options belonging to the current tool.
 *
 * A focused tool page renders just its own panel, so most of these are
 * absent there. The workspace has all three and swaps between them.
 */
function showOptionsForMode() {
  const mode = currentMode()
  if (splitOptions) splitOptions.hidden = mode !== "split"
  if (imageOptions) imageOptions.hidden = mode !== "frimages"
  if (exportOptions) exportOptions.hidden = mode !== "toimages"
}

// Run once on load as well as on every change, or the workspace opens with
// every panel showing at once.
showOptionsForMode()

for (const radio of document.querySelectorAll('input[name="mode"]')) {
  radio.addEventListener("change", () => {
    marked.clear()
    showOptionsForMode()
    applyAccept()
    reset()
    result.textContent = modes[currentMode()].hint
  })
}

picker.addEventListener("change", async () => {
  await openFiles(Array.from(picker.files))
  // Let the same file be chosen again later.
  picker.value = ""
})

/**
 * A count with its noun, in the singular when there is one of something.
 *
 * Saves writing "1 page(s)", which is programmer shorthand that reads as an
 * unfinished sentence to everyone else.
 */
function countOf(n, noun) {
  return `${n} ${noun}${n === 1 ? "" : "s"}`
}

/**
 * Whether there is room for another file, in plain words.
 *
 * Merge is the one tool that adds to what is already open, so it is the one
 * where somebody can run out of room mid job. Saying "add more files" when
 * there is no room left for any is worse than saying nothing.
 */
function roomLeft() {
  const spare = LIMITS.maxTotal - loadedBytes

  if (files.size >= MAX_FILES) {
    return `That is the most files at once (${MAX_FILES}). Download these first.`
  }
  if (spare <= 0) {
    return "No room left on this device. Download these first."
  }
  if (spare < LIMITS.maxTotal * 0.15) {
    return `You can add about ${formatSize(spare)} more, then download as one PDF.`
  }
  return "You can add more files, then download them as one PDF."
}

/**
 * What to say about files that turned out not to be PDFs.
 *
 * Named individually up to a point, since knowing which one failed is the
 * useful part, and counted beyond that so the line stays readable.
 */
function refusalOf(names, one = "a PDF", many = "PDFs") {
  if (names.length === 1) return `${names[0]} is not ${one}.`
  if (names.length <= 3) return `${names.join(", ")} are not ${many}.`
  return `${names.length} of the files are not ${many}.`
}

/** Open a list of files, however the user gave them to us. */
async function openFiles(chosen) {
  if (chosen.length === 0) return

  const check = checkSelection(chosen, currentMode() === "merge" ? loadedBytes : 0)
  if (!check.ok) {
    result.textContent = check.reason
    return
  }
  if (check.warning) result.textContent = check.warning

  if (currentMode() === "frimages") {
    await addImages(chosen)
    return
  }

  // Merge adds to what is already there. The single file tools replace it.
  if (currentMode() !== "merge") reset()

  downloadBtn.disabled = true
  paintLamps()
  working(true)

  // Files the name lied about. Reported at the end rather than as each one
  // is met, or the summary line that follows the loop simply overwrites the
  // complaint and the reader is told nothing happened when nothing did.
  const refused = []

  try {
    for (const file of chosen) {
      result.textContent = `Opening ${file.name}`
      const bytes = await file.arrayBuffer()

      // The name can say anything, so check what the file actually is.
      if (!looksLikePdf(bytes)) {
        refused.push(file.name)
        continue
      }

      loadedBytes += bytes.byteLength

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

    // Nothing opened, so say why rather than reporting nought pages as
    // though the job had been done.
    if (order.length === 0) {
      result.textContent = refused.length
        ? refusalOf(refused)
        : "Nothing could be opened. Select a PDF to begin."
      paintLamps()
      return
    }

    downloadBtn.disabled = false
    // The size as well as the count, since the limit is quoted in megabytes
    // and someone near it has no way to tell how close they are otherwise.
    result.textContent =
      `${countOf(order.length, "page")}, ${formatSize(loadedBytes)}. ` +
      (refused.length
        ? refusalOf(refused)
        : currentMode() === "merge"
          ? roomLeft()
          : modes[currentMode()].hint)
    paintLamps()
  } catch (error) {
    result.textContent = error.message
  } finally {
    // In a finally, so a file that fails to open does not leave the whole
    // page stuck showing an hourglass.
    working(false)
  }
}

// Clearing everything and going back to an empty page. Picking the wrong
// file otherwise leaves reloading as the only way out.
startOver?.addEventListener("click", () => {
  reset()
  // The starting hint, not the mode's working hint: "Add more files" makes
  // no sense on a page that has just been emptied.
  result.textContent = "Select a file to begin."

  // Emptying the panel makes the page much shorter, and the browser deals
  // with that by dropping the scroll position, sometimes to the top.
  //
  // Where you were is where you should stay, so the position is put back.
  // Scrolling somewhere sensible instead was worse: pressing a button and
  // being moved is jarring however good the destination, and the reader was
  // usually looking at the panel already.
  //
  // Only nudged back if the browser has actually moved you, and only as far
  // as the shorter page now allows.
  const wasAt = window.scrollY
  requestAnimationFrame(() => {
    if (Math.abs(window.scrollY - wasAt) < 2) return
    const bottom = document.documentElement.scrollHeight - window.innerHeight
    window.scrollTo({ top: Math.min(wasAt, Math.max(0, bottom)), behavior: "auto" })
  })
})

// Dropping files anywhere on the page opens them, the same as choosing them.
acceptDroppedFiles(
  document.body,
  (dropped) => openFiles(dropped),
  (over) => {
    document.body.classList.toggle("drag-over", over)
    if (over) result.textContent = "Drop them here."
  },
)

// Dragging thumbnails reorders them, alongside the arrow buttons.
makeReorderable(pagesEl, (from, to) => {
  if (modes[currentMode()].controls !== "move") return
  const moved = order.splice(from, 1)[0]
  order.splice(to, 0, moved)
  drawPages()
  result.textContent = "Order updated."
})

function reset() {
  loadedBytes = 0
  chosenImages = []
  renderCache.clear()
  for (const id of files.keys()) call("close", { id })
  files.clear()
  thumbnails.clear()
  // cleanup(), not destroy(): a pdf.js document exposes the first and not
  // the second, and calling the wrong one threw inside reset, which left
  // everything after it in this function unreached.
  for (const pdf of rendered.values()) pdf.cleanup?.()
  rendered.clear()
  marked.clear()
  order = []
  pagesEl.replaceChildren()
  downloadBtn.disabled = true
  paintLamps()
}

async function renderThumbnails(docId, bytes) {
  const task = pdfjs.getDocument({ data: bytes, isEvalSupported: false })
  const pdf = await task.promise

  // Kept so a page can be drawn again at full size when someone looks
  // closer. The thumbnail is rendered at a fraction of the real size, so
  // scaling that up shows a blurred copy rather than the page.
  rendered.set(docId, pdf)

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
    result.textContent = `Drawing page ${n} of ${pdf.numPages}`
    drawPages()
  }
}

/**
 * Put a rendered page in a fixed size box.
 *
 * Pages are not all the same shape, and letting each thumbnail keep its own
 * height made the row ragged: a landscape page sat shorter than a portrait
 * one, so the name and the arrows underneath it rode up. The box is a fixed
 * size and the page is centred inside it.
 */
function inThumb(inner) {
  const thumb = document.createElement("div")
  thumb.className = "thumb"
  thumb.appendChild(inner)
  return thumb
}

// Rebuild the grid from `order`, wrapping each thumbnail in its controls.
function drawPages() {
  const mode = currentMode()
  const kind = modes[mode].controls
  pagesEl.replaceChildren()

  order.forEach((entry, position) => {
    const canvas = thumbnails.get(entry.key)

    const box = document.createElement("div")
    box.dataset.position = String(position)
    // Identifies this page across a rebuild, so a move can be animated from
    // where the page was to where it now is.
    box.dataset.key = entry.key

    // Dragging moves pages, so a drag must not be read as a text selection.
    if (kind === "move") box.style.touchAction = "none"

    if (canvas) {
      if (kind !== "select") {
        canvas.style.opacity = "1"
      } else if (marked.has(entry.key)) {
        box.classList.add("marked")
        canvas.style.opacity = mode === "extract" ? "1" : "0.4"
      } else {
        canvas.style.opacity = mode === "extract" ? "0.4" : "1"
      }
      canvas.style.transform = entry.rotate ? `rotate(${entry.rotate}deg)` : ""
      box.appendChild(inThumb(canvas))
    } else {
      const placeholder = document.createElement("div")
      placeholder.className = "placeholder"
      box.appendChild(inThumb(placeholder))
    }

    const label = document.createElement("div")
    label.className = "num"
    label.textContent = files.size > 1
      ? `${shortName(files.get(entry.doc))} p${entry.page}`
      : String(entry.page).padStart(2, "0")
    box.appendChild(label)

    if (kind === "move") {
      const controls = document.createElement("div")
      controls.className = "page-controls"
      controls.append(
        moveButton("left", position, position - 1, position === 0),
        moveButton("right", position, position + 1, position === order.length - 1),
      )
      box.appendChild(controls)
    } else if (kind === "turn") {
      const controls = document.createElement("div")
      controls.className = "page-controls"
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

    // A button rather than a click on the page itself: on the delete and
    // extract tools clicking already means "choose this one", and one
    // gesture cannot carry two meanings.
    box.appendChild(zoomButton(entry, label.textContent))

    pagesEl.appendChild(box)
  })
}

/** The button that opens a page large enough to read. */
function zoomButton(entry, caption) {
  const button = document.createElement("button")
  button.type = "button"
  button.className = "zoom"
  button.dataset.tip = "Look closer"
  button.setAttribute("aria-label", `Look closer at ${caption}`)
  button.textContent = "+"
  button.addEventListener("click", (event) => {
    event.stopPropagation()
    openViewer(entry, caption)
  })
  return button
}

/**
 * Show one page big, over the rest of the site.
 *
 * A thumbnail is small enough that two pages of similar text look alike, so
 * there has to be a way to check which is which. The page is already
 * rendered, so this copies that canvas rather than reading the file again.
 */
async function openViewer(entry, caption) {
  const backdrop = document.createElement("div")
  backdrop.className = "viewer"
  backdrop.setAttribute("role", "dialog")
  backdrop.setAttribute("aria-modal", "true")
  backdrop.setAttribute("aria-label", caption)

  const big = document.createElement("canvas")
  if (entry.rotate) big.style.transform = `rotate(${entry.rotate}deg)`

  const name = document.createElement("p")
  name.className = "viewer-name"
  name.textContent = caption

  const close = document.createElement("button")
  close.type = "button"
  close.className = "chip"
  close.textContent = "Close"

  const panel = document.createElement("div")
  panel.className = "viewer-panel"
  panel.append(big, name, close)
  backdrop.append(panel)

  const shut = () => {
    backdrop.remove()
    document.removeEventListener("keydown", onKey)
  }
  const onKey = (event) => {
    if (event.key === "Escape") shut()
  }

  close.addEventListener("click", shut)
  // The darkened area closes it, the page itself does not.
  backdrop.addEventListener("click", (event) => {
    if (event.target === backdrop) shut()
  })
  document.addEventListener("keydown", onKey)

  document.body.append(backdrop)
  close.focus()

  // Drawn after the panel is on screen, so the viewer opens at once and the
  // page arrives a moment later rather than everything waiting on the render.
  const pdf = rendered.get(entry.doc)
  if (!pdf) return

  const source = thumbnails.get(entry.key)
  if (source) {
    // The thumbnail first, stretched, so there is something to look at
    // immediately. The real render replaces it below.
    big.width = source.width
    big.height = source.height
    big.getContext("2d").drawImage(source, 0, 0)
  }

  const page = await pdf.getPage(entry.page)

  // Sized to the window rather than to a fixed scale, so the page fills the
  // space available on a large screen and still fits on a small one.
  const natural = page.getViewport({ scale: 1 })
  const room = Math.min(window.innerWidth * 0.85, 900)
  const scale = Math.min(room / natural.width, (window.innerHeight * 0.72) / natural.height)
  const viewport = page.getViewport({ scale: Math.max(scale, 0.5) })

  // The viewer may have been closed while the page was rendering.
  if (!backdrop.isConnected) return

  big.width = viewport.width
  big.height = viewport.height
  await page.render({ canvasContext: big.getContext("2d"), viewport }).promise
}

function shortName(name = "file") {
  const stem = name.replace(/\.pdf$/i, "")
  return stem.length > 12 ? stem.slice(0, 11) + "…" : stem
}

/**
 * Redraw the pages, sliding each one from where it was.
 *
 * The grid is rebuilt from scratch on every change, so a page that moves
 * simply appears somewhere else and you cannot tell whether the click did
 * anything. This records where every page sat, rebuilds, then animates each
 * one from its old place to its new one.
 *
 * The technique is to apply the inverse of the movement as a transform and
 * then remove it, so the browser animates the difference. Nothing is
 * measured twice and no positions are calculated by hand.
 */
function drawPagesMoving() {
  const before = new Map()
  for (const box of pagesEl.children) {
    before.set(box.dataset.key, box.getBoundingClientRect())
  }

  drawPages()

  if (wantsLessMotion) return

  for (const box of pagesEl.children) {
    const was = before.get(box.dataset.key)
    if (!was) continue

    const now = box.getBoundingClientRect()
    const dx = was.left - now.left
    const dy = was.top - now.top
    if (!dx && !dy) continue

    box.animate(
      [{ transform: `translate(${dx}px, ${dy}px)` }, { transform: "none" }],
      { duration: 320, easing: "cubic-bezier(0.2, 0.8, 0.3, 1)" },
    )
  }
}

function moveButton(direction, from, to, disabled) {
  const button = document.createElement("button")
  button.className = "mini"
  button.textContent = direction === "left" ? "<" : ">"
  button.dataset.tip = direction === "left" ? "Move earlier" : "Move later"
  button.disabled = disabled
  button.addEventListener("click", () => {
    const moved = order.splice(from, 1)[0]
    order.splice(to, 0, moved)
    drawPagesMoving()
    result.textContent = "Order updated."
  })
  return button
}

function turnButton(entry, amount) {
  const button = document.createElement("button")
  button.className = "mini"
  button.dataset.tip = amount < 0 ? "Turn left" : "Turn right"
  button.textContent = amount < 0 ? "↶" : "↷"
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
    result.textContent = `Keeping ${marked.size} of ${order.length}`
  } else if (mode === "remove") {
    result.textContent = `Removing ${marked.size} of ${order.length}`
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

  result.textContent = `Building ${countOf(parts.length, "file")}`
  const zip = await call("splitToZip", { parts, zipName: `${stem}-split.zip` })

  save(zip.bytes, zip.name, "application/zip")
  result.textContent = `Saved ${countOf(zip.fileCount, "file")} as ${zip.name}`
}

downloadBtn.addEventListener("click", async () => {
  if (order.length === 0 && chosenImages.length === 0) return

  const special = {
    split: downloadSplit,
    toimages: downloadPdfToImages,
    frimages: downloadImagesToPdf,
  }[currentMode()]

  if (special) {
    working(true)
    try {
      await special()
    } catch (error) {
      result.textContent = error.message
    } finally {
      working(false)
    }
    return
  }

  const mode = modes[currentMode()]
  const items = mode.items()

  if (items.length === 0) {
    result.textContent = mode.empty
    return
  }

  working(true)
  try {
    result.textContent = "Building"
    const { bytes } = await call("build", {
      items: items.map(({ doc, page, rotate }) => ({ doc, page, rotate })),
    })

    const first = files.values().next().value || "document.pdf"
    const name = first.replace(/\.pdf$/i, "") + mode.suffix + ".pdf"
    save(bytes, name, "application/pdf")
    result.textContent = `Saved ${countOf(items.length, "page")}.`
  } catch (error) {
    result.textContent = error.message
  } finally {
    working(false)
  }
})

// --- images to PDF -----------------------------------------------------

async function addImages(chosen) {
  // Files that are not images. Collected rather than abandoning the batch on
  // the first one: nine good photographs and one stray text file should give
  // you nine photographs, not nothing.
  const refused = []

  for (const file of chosen) {
    const bytes = new Uint8Array(await file.arrayBuffer())

    // Check what the file really is, since a name can lie about its contents.
    if (!imageKind(bytes)) {
      refused.push(file.name)
      continue
    }

    chosenImages.push({ name: file.name, bytes })
  }

  if (chosenImages.length === 0) {
    result.textContent = refused.length
      ? refusalOf(refused, "a JPG or PNG", "JPGs or PNGs")
      : "Nothing could be opened. Select an image to begin."
    paintLamps()
    return
  }

  downloadBtn.disabled = false
  drawImages()
  paintLamps()
  const imageBytes = chosenImages.reduce((sum, i) => sum + i.bytes.byteLength, 0)
  result.textContent =
    `${countOf(chosenImages.length, "image")}, ${formatSize(imageBytes)}.` +
    (refused.length ? " " + refusalOf(refused, "a JPG or PNG", "JPGs or PNGs") : "")
}

function drawImages() {
  pagesEl.replaceChildren()

  chosenImages.forEach((image, position) => {
    const box = document.createElement("div")
    box.dataset.position = String(position)

    // A blob URL points at memory in this tab. Nothing is uploaded.
    const preview = document.createElement("img")
    const url = URL.createObjectURL(new Blob([image.bytes]))
    preview.src = url
    preview.addEventListener("load", () => URL.revokeObjectURL(url))
    box.appendChild(inThumb(preview))

    const label = document.createElement("div")
    label.className = "num"
    label.textContent = shortName(image.name)
    box.appendChild(label)

    const controls = document.createElement("div")
    controls.className = "page-controls"
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
  button.className = "mini"
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
