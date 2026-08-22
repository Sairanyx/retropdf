from pathlib import Path
from pypdf import PdfReader, PdfWriter

# ============================================================
# EDIT ONLY THIS SECTION
# ============================================================

# Folder where your PDF file is stored.
# Leave as "output" to edit a file that merge_pdfs.py produced.
# For a file somewhere else, put the full folder path here instead:
# Example (Windows): r"C:\Users\Eduard\Documents\PDFs"
# Example (Linux/Mac): "/home/eduard/Documents/PDFs"
PDF_FOLDER = "output"

# The PDF you want to remove pages from.
INPUT_FILENAME = "Passport_Stefan_Masnita.pdf"

# Pages to remove, counting from 1 (the way your PDF reader shows them).
# Single pages:  3
# Ranges:        "5-8"      (removes 5, 6, 7 and 8)
# Open ranges:   "12-"      (removes page 12 to the end)
# Mix freely, for example: [3, "5-8", 12]
PAGES_TO_REMOVE = [
    14,
]

# Name of the resulting file (written into the output folder).
OUTPUT_FILENAME = "Passport_Stefan_Masnita_edited.pdf"

# ============================================================
# YOU DO NOT NEED TO EDIT ANYTHING BELOW THIS LINE
# ============================================================


def parse_pages(entries, page_count: int) -> set[int]:
    """Turn PAGES_TO_REMOVE into a set of 1-based page numbers."""
    pages: set[int] = set()

    for entry in entries:
        if isinstance(entry, int):
            first = last = entry
        else:
            text = str(entry).strip()
            if not text:
                continue
            if "-" in text:
                start_text, _, end_text = text.partition("-")
                start_text = start_text.strip()
                end_text = end_text.strip()
                if not start_text:
                    raise ValueError(f"Page range is missing a start: {entry!r}")
                try:
                    first = int(start_text)
                    last = page_count if not end_text else int(end_text)
                except ValueError:
                    raise ValueError(f"Could not understand page entry: {entry!r}")
            else:
                try:
                    first = last = int(text)
                except ValueError:
                    raise ValueError(f"Could not understand page entry: {entry!r}")

        if first > last:
            raise ValueError(f"Page range goes backwards: {entry!r}")
        if first < 1:
            raise ValueError(f"Page numbers start at 1, got: {entry!r}")
        if last > page_count:
            raise ValueError(
                f"Page entry {entry!r} goes past the end of the document "
                f"({page_count} page(s))."
            )

        pages.update(range(first, last + 1))

    return pages


def remove_pages() -> None:
    """Write INPUT_FILENAME to output/OUTPUT_FILENAME without PAGES_TO_REMOVE."""
    project_folder = Path(__file__).resolve().parent
    # A relative PDF_FOLDER (like "output") is read next to this script, not
    # next to whatever folder you happened to run the command from.
    input_folder = project_folder / Path(PDF_FOLDER).expanduser()
    input_file = input_folder / INPUT_FILENAME
    output_folder = project_folder / "output"
    output_file = output_folder / OUTPUT_FILENAME

    if not input_folder.exists():
        raise FileNotFoundError(
            f"PDF folder does not exist:\n{input_folder}\n\n"
            "Edit PDF_FOLDER near the top of remove_pages.py."
        )

    if not input_file.is_file():
        raise FileNotFoundError(
            f"PDF file could not be found:\n{input_file}\n\n"
            "Edit INPUT_FILENAME near the top of remove_pages.py."
        )

    if not PAGES_TO_REMOVE:
        raise ValueError("PAGES_TO_REMOVE is empty. Add at least one page number.")

    reader = PdfReader(str(input_file))
    page_count = len(reader.pages)
    remove = parse_pages(PAGES_TO_REMOVE, page_count)

    kept = [number for number in range(1, page_count + 1) if number not in remove]
    if not kept:
        raise ValueError(
            "That would remove every page. Leave at least one page in the document."
        )

    if output_file.resolve() == input_file.resolve():
        raise ValueError(
            "OUTPUT_FILENAME would overwrite the input file. Pick a different name."
        )

    output_folder.mkdir(parents=True, exist_ok=True)

    writer = PdfWriter()
    try:
        for number in kept:
            writer.add_page(reader.pages[number - 1])

        with output_file.open("wb") as file:
            writer.write(file)
    finally:
        writer.close()

    removed_text = ", ".join(str(number) for number in sorted(remove))
    print(f"Input:   {input_file} ({page_count} page(s))")
    print(f"Removed: {removed_text}")
    print("\nDone!")
    print(f"Kept {len(kept)} page(s).")
    print(f"Output: {output_file}")


if __name__ == "__main__":
    try:
        remove_pages()
    except Exception as error:
        print("\nERROR:")
        print(error)
        raise SystemExit(1)
