import { PDFDocument } from "/static/js/vendor/pdf-lib.esm.min.js";

const picker = document.querySelector("#picker");
const result = document.querySelector("#result");

picker.addEventListener("change", async () => {
  const file = picker.files[0];
  if (!file) return;

  result.textContent = "Reading…";

  const bytes = await file.arrayBuffer();
  const pdf = await PDFDocument.load(bytes);

  result.textContent = `${file.name} — ${pdf.getPageCount()} pages`;
});
