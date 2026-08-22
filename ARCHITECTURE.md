# Architecture

How RedPDF is built, and why. Read this before making structural changes.

## The one decision everything follows from

**PDF processing happens in the user's browser. Files are never uploaded.**

The server sends HTML, CSS, and JavaScript. It never receives a PDF. This is
not a privacy preference bolted on afterwards — it determines the stack, the
scaling story, and the marketing claim.

Consequences:

- **Privacy is provable, not promised.** A user can open DevTools, watch an
  empty Network tab, or disconnect from the internet and keep working. No
  competitor running server-side can say this.
- **Load is flat.** 10,000 merges an hour costs the same as 10, because the
  server only ever handed out a static page. A free-tier Oracle VM is enough.
- **Security is structural.** A malicious PDF can only attack the tab it was
  opened in, by the person who chose to open it, inside the browser sandbox.
  Server-side tools parse untrusted files on infrastructure holding other
  users' data.

The trade: very large files (roughly 200MB+) may exceed what a phone can hold
in memory. We fail with a clear message rather than silently uploading. See
"Limits" below.

## Request flow

```
Browser                          Server (FastAPI + Caddy)
   |                                      |
   |  GET /remove-pdf-pages               |
   |------------------------------------->|
   |                                      |  render template, set <title>/<h1>
   |  200 OK: HTML + CSS + JS             |
   |<-------------------------------------|
   |                                      |
   |  (user picks a file)                 |   NOTHING CROSSES THIS LINE AGAIN
   |                                      |
   |  FileReader -> ArrayBuffer           |
   |  postMessage(buffer) -> Web Worker   |
   |  pdf.js renders thumbnails           |
   |  pdf-lib rewrites the document       |
   |  Blob -> <a download>                |
   |                                      |
```

The server's entire job is choosing which title, heading, and initial mode the
page ships with. It has no API for PDF operations, because there is nothing for
it to do.

## Stack

| Layer | Choice | Why |
|---|---|---|
| PDF manipulation | `@cantoo/pdf-lib` | The original `pdf-lib` has had no release since Nov 2021. This fork is actively maintained and adds encrypted-PDF support. Same API. |
| PDF rendering | `pdfjs-dist` (Mozilla) | Only way to draw page thumbnails. pdf-lib cannot render. |
| Threading | Web Worker | A 50MB PDF on the main thread freezes the tab. Not slows — freezes. |
| Frontend | Vanilla JS modules | No framework earns its weight here. Revisit only with evidence. |
| Server | FastAPI | Serves HTML per route. Deliberately thin. |
| Proxy / TLS | Caddy | Automatic HTTPS, simple config. |
| Hosting | Oracle free tier | Sufficient because the server does no work. |

Both libraries are **vendored into the repo**, not loaded from a CDN. A CDN
request is a third-party contact, which would undermine both the privacy claim
and the CSP below.

## Two surfaces, one engine

Eight focused tool pages for people who arrived from a search and want one
thing. One workspace for people who want everything at once.

```
/                      home — a list of tools
/merge-pdf             ┐
/split-pdf             │
/reorder-pdf           │  focused pages:
/remove-pdf-pages      │  one job, one button, mode fixed
/extract-pdf-pages     │  no tool switcher, no chaining
/rotate-pdf            │
/jpg-to-pdf            │
/pdf-to-jpg            ┘
/workspace             everything at once, chaining, multi-file
```

**The focused pages are the default and the priority.** Someone who googled
"delete a page from a pdf" must be able to finish without learning anything.
The workspace is one quiet link, never in the way.

Both surfaces render the same page-grid component. A focused page is the grid
with the mode locked; the workspace is the grid with the constraints removed.
This is why eight tools is a weekend of work rather than a month: build the
grid well and the rest are thin wrappers.

### What differs between them

| | Focused pages | Workspace |
|---|---|---|
| Tools visible | One | All |
| Operations | One, then download | Chained, download once |
| Files | One (merge takes several) | Several |
| Audience | Everyone, especially first-timers | Repeat users |
| Ships | v1 | After v1 |

## Interaction rules

These exist because the product must work for people who are not comfortable
with computers. They are requirements, not preferences.

1. **Plain language.** "Choose a PDF", not "Upload". "Download", not "Export".
   Never "extract" without explaining it.
2. **Big targets.** Primary buttons at least 48px tall. Thumbnails large enough
   to recognise the page.
3. **One primary action on screen at a time.** Two equally-weighted buttons
   cause hesitation.
4. **Say what will happen.** "Remove 2 pages and download 10 pages" beats
   "Apply".
5. **Undo instead of confirm.** Confirmation dialogs get dismissed reflexively.
6. **Drag is never the only way.** Every drag interaction has button
   equivalents (move left / move right / remove). Drag is hard for older users
   and unavailable on some devices.
7. **Nothing hidden.** No hover-to-reveal, no right-click menus, no
   keyboard-only paths.

## Performance

Techniques, in order of impact:

1. **Web Worker for all PDF work.** The main thread handles file selection and
   progress display only.
2. **Transfer ArrayBuffers, do not copy them.** `postMessage(buf, [buf])`
   transfers ownership. For a 100MB file this is the difference between 100MB
   and 200MB of memory.
3. **Process sequentially.** Load one document, copy its pages, release it.
   Peak memory tracks the largest single file, not the total.
4. **Render thumbnails lazily.** Only visible pages, via IntersectionObserver.
   A 200-page document should not render 200 canvases up front.
5. **Animate only `transform` and `opacity`.** Anything else forces layout.

Worth knowing: merge cost scales with **object count, not file size**. PDFs
store content as a graph of objects with a cross-reference table; merging means
renumbering every object, rewriting every reference, and rebuilding the table.
A 5MB file with 50,000 small objects is slower than a 50MB scan. This is why
"it's only 10MB, why is it slow?" happens.

WebAssembly was considered and rejected. Benchmarks show it wins on small
inputs but *loses* on large ones and uses more memory — the opposite of what
this workload needs. Revisit only for genuinely compute-bound work such as
compression or OCR.

## Security

### Content-Security-Policy

```
default-src     'self';
connect-src     'none';
script-src      'self';
frame-ancestors 'none';
```

`connect-src 'none'` is the important one. It instructs the browser to block
every outbound request — fetch, XHR, WebSocket, beacon. The privacy claim stops
being a promise and becomes something the browser enforces and the user can
verify in one header.

This also means: no analytics, no fonts from Google, no CDN, no error
reporting. Everything is served from our own origin or it does not load.

### pdf.js hardening

pdf.js has a history worth respecting. **CVE-2024-4367** allowed arbitrary
JavaScript execution from a malicious PDF because `font_loader.js` passed
attacker-controlled input to `eval()`, and `isEvalSupported` defaulted to true.

Required:

- Pin a current `pdfjs-dist` (the fix landed in 4.2.67; we are well past it)
- Set `isEvalSupported: false` explicitly
- Keep the CSP above — a policy forbidding `eval` made the vulnerability
  unreachable even on unpatched versions

Defence in depth: the CSP would have neutralised this class of bug before
anyone found it.

### Limits

Client-side does not mean unlimited. Check before starting work, and fail with
a useful message rather than crashing the tab:

- Warn above ~100MB for a single file
- Refuse above ~250MB with a suggestion (use a desktop browser, or split first)
- Cap file count per operation

## Repository layout

```
app/
  __init__.py
  main.py            FastAPI: one route per tool page
  templates/         HTML, one shared workspace template
  static/
    css/
    js/
      vendor/        pdf-lib and pdf.js, committed, not from a CDN
      grid.js        the page-grid component — shared by every tool
      worker.js      all PDF work happens in here
      tools/         per-tool logic (merge, remove, rotate, ...)
tests/
deploy/              Dockerfile, compose, Caddyfile
scripts/             the original Python scripts. Reference only; not shipped.
```

## Things deliberately not built

- **Compress** — real compression means re-encoding images. Client-side results
  will disappoint next to server tools. A tool that underdelivers is worse than
  a missing one.
- **OCR** — Tesseract.js is a ~15MB download and slow.
- **PDF to Word/Excel** — genuinely needs a server.
- **Password protect** — pdf-lib cannot encrypt.
- **Server-side fallback for large files** — would break the absolute privacy
  claim. If usage data later shows real demand, add it as an explicit opt-in
  with a clear warning, never as a silent fallback.
