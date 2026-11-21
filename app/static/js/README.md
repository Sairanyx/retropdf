# app/static/js/

The browser code. Plain ES modules, no build step. All PDF work happens
here, on the user's device.

**The tools**

| File | What it does |
|---|---|
| `app.js` | The tool page: opening files, thumbnails, choosing pages, downloading |
| `pdf-operations.js` | The PDF work itself (merge, split, rotate, images). Tested in Node |
| `worker.js` | Runs `pdf-operations.js` on a background thread so the page never freezes |
| `pdf-worker.js` | `call("merge", ...)` style wrapper for talking to the worker |
| `limits.js` | File size limits worked out from the device's memory |
| `dragdrop.js` | Dropping files on the page, and dragging pages into order |
| `words.js` | Looks up words in the page's language |
| `support.js` | Tells a browser too old for the tools to update. Old style JS on purpose |

**The page around them**

| File | What it does |
|---|---|
| `pending.js`, `intro.js` | The opening animation and the typed headings |
| `progress.js` | The trail the logo leaves while scrolling |
| `reveal.js` | Sections appearing as you scroll, and the lit menu lamp |
| `nav.js` | Smooth page changes and in-page jumps |
| `controls.js` | The number steppers |
| `picker.js` | Closing the language picker, placing the desktop app button |
| `wanted.js` | Remembering that you asked for a desktop app |
| `bench.js` | Development only memory test |

**vendor/** holds pdf-lib, pdf.js (the *legacy* build, for older browsers)
and fflate, copied from `node_modules` rather than loaded from a CDN, which
would be a third party request.
