# Roadmap

Build order and what "done" means at each stage. Read `ARCHITECTURE.md` first.

## Scope

**v1 — eight focused tools.** Each is one page, one job, one button. Mode is
fixed per page; no tool switching, no chaining.

| Path | Tool | Notes |
|---|---|---|
| `/merge-pdf` | Merge | Several files in, one out. Order by drag or buttons. |
| `/split-pdf` | Split | Cut at a page, or every N pages. Outputs a ZIP. |
| `/reorder-pdf` | Reorder | Drag pages, or move with buttons. |
| `/remove-pdf-pages` | Remove pages | Click to mark, download the rest. |
| `/extract-pdf-pages` | Extract pages | Click to keep, save as a new file. |
| `/rotate-pdf` | Rotate | 90/180/270, per page or all. |
| `/jpg-to-pdf` | Images to PDF | JPG/PNG in, one PDF out. |
| `/pdf-to-jpg` | PDF to images | One PDF in, a ZIP of images out. |

**v2 — the workspace.** `/workspace`: all tools at once, chained operations,
multiple documents, one download at the end. For repeat users. Never the
default, never in the way of the simple pages.

Insert-a-file-at-a-position lives in the workspace, not on a focused page — it
is inherently a two-document operation.

## Build order

The page grid is the foundation. Everything else is a wrapper around it, which
is why the order below front-loads the risk.

### 1. Page grid — the real work

The shared component every tool depends on.

- Read a file into an ArrayBuffer, transfer it to a Web Worker
- Render thumbnails with pdf.js (`isEvalSupported: false`)
- Lazy render via IntersectionObserver — visible pages only
- Select / multi-select
- Reorder by drag **and** by buttons
- Progress readout while rendering

**Done when:** a 200-page PDF renders without freezing the tab, thumbnails
appear progressively, and every interaction works without a mouse drag.

### 2. Merge and Remove

Two tools that prove the grid, and the two you already understand from the
Python scripts.

**Done when:** both produce correct PDFs, DevTools shows zero network requests
during the operation, and errors are readable by a non-technical user.

### 3. The remaining six

Reorder, extract, split, rotate, images-to-PDF, PDF-to-images. Each is a thin
wrapper once the grid exists. Split and PDF-to-images need ZIP output.

**Done when:** all eight tools work end to end.

### 4. Routes, SEO, and the home page

- FastAPI route per tool with correct `<title>`, `<h1>`, meta description
- Home page listing the tools, plus one quiet workspace link
- `sitemap.xml`, `robots.txt`, Open Graph tags
- A privacy page explaining *why* client-side is safer, not just that it is

### 5. Hardening

- File size checks with useful failure messages (warn ~100MB, refuse ~250MB)
- CSP headers including `connect-src 'none'`
- Verify no third-party requests anywhere, fonts included
- Keyboard navigation and visible focus states throughout
- Test on a real phone, not just a narrow desktop window

### 6. Deploy

- Dockerfile and compose
- Caddy with automatic HTTPS
- Oracle VM, DNS, domain
- Verify the CSP is actually present in production responses

### 7. Workspace (v2)

Only after the eight tools are live. Mostly assembly at that point.

## Testing

The PDF logic is JavaScript, so tests run in Node against the same worker code
the browser uses.

Worth covering:

- Each operation produces the expected page count and order
- Page-selection parsing (`"1, 3, 5-8, 12-"`) including the error cases
- Corrupt file, encrypted file, zero-page file all fail with clear messages
- Round trip: merge then split returns the original page count

Python tests cover only that each route returns 200 with the right title.

## If time runs short

Ship fewer tools, not a worse grid. Six solid tools beat eight shaky ones, and
the grid is what everything depends on.

Cut in this order: workspace, then PDF-to-images, then images-to-PDF, then
rotate. Never cut the size limits or the CSP.
