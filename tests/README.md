# tests/

| Command | What it covers |
|---|---|
| `python -m pytest tests/` | Routes, headers, caching, error pages, counter, languages, deploy config |
| `npm test` | The PDF operations and size limits, in Node (`*.test.mjs`) |
| `node tests/tools.e2e.mjs` | Every tool, end to end, in a real browser |
| `node tests/edge.e2e.mjs` | Broken, locked and oversized files, old browsers |
| `node tests/privacy.e2e.mjs` | Records every request: nothing may leave the page |
| `node tests/responsive.e2e.mjs` | Layout and touch targets on phone, tablet and laptop sizes |

The browser tests need the server running. They take two settings
(`browser.mjs`):

```bash
BROWSER=firefox node tests/tools.e2e.mjs          # chromium, firefox, webkit
BASE=https://example.com node tests/tools.e2e.mjs # a deployed site
```

Tools, not tests:

- `shots.mjs` takes screenshots of a page while scrolling.
- `make-share-card.mjs` rebuilds `app/static/share.png`, the image shown
  when a link is shared. Run it after changing that wording.
- `resolve-static*.mjs` let Node load the browser code's `/static/...` imports.
