import { PDFDocument } from "/static/js/vendor/pdf-lib.esm.min.js";
import * as pdfjs from "/static/js/vendor/pdf.min.mjs";

// pdf.js parses on its own background thread and needs to know where that
// code lives. Without this it fails with an unhelpful error.
pdfjs.GlobalWorkerOptions.workerSrc = "/static/js/vendor/pdf.worker.min.mjs";

const picker = document.querySelector("#picker");
const result = document.querySelector("#result");
const pagesEl = document.querySelector("#pages");

picker.addEventListener("change", async () => {
  const file = picker.files[0];
  if (!file) return;

  result.textContent = "Reading…";
  const bytes = await file.arrayBuffer();

  // pdf-lib: structure. How many pages?
  const doc = await PDFDocument.load(bytes);
  result.textContent = `${file.name} — ${doc.getPageCount()} pages`;

  // pdf.js draws each page into its own small canvas
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

    pagesEl.appendChild(canvas)

    await page.render({
      canvasContext: canvas.getContext("2d"),
      viewport,
    }).promise

    result.textContent = `${file.name}: rendered ${n} of ${pdf.numPages}`
  }

})
