from pathlib import Path
from pypdf import PdfWriter

# ============================================================
# EDIT ONLY THIS SECTION
# ============================================================

# Folder where your PDF files are stored.
# Example (Windows): r"C:\Users\Eduard\Documents\PDFs"
# Example (Linux/Mac): "/home/eduard/Documents/PDFs"
PDF_FOLDER = r"C:\Users\eddie\OneDrive\Documents\Dad\new"

# Put the PDF filenames here in the exact order you want them merged.
PDF_FILES = [
    "0_7.pdf",
    
]

# Name of the merged file.
OUTPUT_FILENAME = "Merged.pdf"

# ============================================================
# YOU DO NOT NEED TO EDIT ANYTHING BELOW THIS LINE
# ============================================================


def merge_pdfs() -> None:
    """Merge the PDFs listed above into output/OUTPUT_FILENAME."""
    project_folder = Path(__file__).resolve().parent
    input_folder = Path(PDF_FOLDER).expanduser()
    output_folder = project_folder / "output"
    output_file = output_folder / OUTPUT_FILENAME

    if not input_folder.exists():
        raise FileNotFoundError(
            f"PDF folder does not exist:\n{input_folder}\n\n"
            "Edit PDF_FOLDER near the top of merge_pdfs.py."
        )

    if not PDF_FILES:
        raise ValueError("PDF_FILES is empty. Add at least one PDF filename.")

    pdf_paths = [input_folder / filename for filename in PDF_FILES]
    missing_files = [path for path in pdf_paths if not path.is_file()]

    if missing_files:
        missing_text = "\n".join(f" - {path.name}" for path in missing_files)
        raise FileNotFoundError(
            "These PDF files could not be found in the folder:\n"
            f"{missing_text}\n\nFolder checked:\n{input_folder}"
        )

    output_folder.mkdir(parents=True, exist_ok=True)

    writer = PdfWriter()
    try:
        for pdf_path in pdf_paths:
            print(f"Adding: {pdf_path.name}")
            writer.append(str(pdf_path))

        with output_file.open("wb") as file:
            writer.write(file)
    finally:
        writer.close()

    print("\nDone!")
    print(f"Merged {len(pdf_paths)} PDF(s).")
    print(f"Output: {output_file}")


if __name__ == "__main__":
    try:
        merge_pdfs()
    except Exception as error:
        print("\nERROR:")
        print(error)
        raise SystemExit(1)
