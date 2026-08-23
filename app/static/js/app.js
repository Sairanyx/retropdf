import { PDFDocument } from "/static/js/vendor/pdf-lib.esm.min.js";
import * as pdfjs from "/static/js/vendor/pdf.min.mjs";

// pdf.js parses on its own background thread and needs to know where that
// code lives. Without this it fails with an unhelpful error.
pdfjs.GlobalWorkerOptions.workerSrc = "/static/js/vendor/pdf.worker.min.mjs";

const picker = document.querySelector("#picker");
const result = document.querySelector("#result");
const canvas = document.querySelector("#preview");

picker.addEventListener("change", async () => {
  const file = picker.files[0];
  if (!file) return;

  result.textContent = "Reading…";
  const bytes = await file.arrayBuffer();

  // pdf-lib: structure. How many pages?
  const doc = await PDFDocument.load(bytes);
  result.textContent = `${file.name} — ${doc.getPageCount()} pages`;

  // pdf.js: pixels. Draw page 1.
  // isEvalSupported: false closes the CVE-2024-4367 hole. Always set it.
  const task = pdfjs.getDocument({ data: bytes.slice(0), isEvalSupported: false });
  const pdf = await task.promise;
  const page = await pdf.getPage(1);

  const viewport = page.getViewport({ scale: 1 });
  canvas.width = viewport.width;
  canvas.height = viewport.height;

  await page.render({
    canvasContext: canvas.getContext("2d"),
    viewport,
  }).promise;
});
