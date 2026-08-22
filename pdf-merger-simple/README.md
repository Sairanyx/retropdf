# Simple PDF Merger

A deliberately small, beginner-friendly Python project for merging PDF files in a specific order.

## 1. Install Python

Install Python 3.10 or newer if you do not already have it.

Check it with:

```bash
python --version
```

On some computers the command is:

```bash
py --version
```

## 2. Install the one dependency

Open a terminal in this project folder and run:

```bash
python -m pip install -r requirements.txt
```

On Windows, if `python` does not work, use:

```bash
py -m pip install -r requirements.txt
```

## 3. Edit `merge_pdfs.py`

You only need to edit the section at the top.

Set the folder containing your PDFs:

```python
PDF_FOLDER = r"C:\Users\Eduard\Documents\PDFs"
```

Then list the filenames in the order you want:

```python
PDF_FILES = [
    "cover.pdf",
    "chapter-1.pdf",
    "chapter-2.pdf",
]
```

You can also change:

```python
OUTPUT_FILENAME = "merged.pdf"
```

## 4. Run it

```bash
python merge_pdfs.py
```

Or on Windows:

```bash
py merge_pdfs.py
```

## 5. Find the result

The project creates this automatically:

```text
output/
    merged.pdf
```

## Project structure

```text
pdf-merger-simple/
├── merge_pdfs.py
├── requirements.txt
├── README.md
└── output/          # created automatically when you run the script
```

## Example

If your source folder contains:

```text
C:\Users\Eduard\Documents\MyPDFs\
    page1.pdf
    page2.pdf
    appendix.pdf
```

Use:

```python
PDF_FOLDER = r"C:\Users\Eduard\Documents\MyPDFs"

PDF_FILES = [
    "page1.pdf",
    "page2.pdf",
    "appendix.pdf",
]
```

The resulting PDF will contain those three files in exactly that order.
