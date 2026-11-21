// What every browser suite shares: which browser, and which server.
//
//   BROWSER=firefox node tests/tools.e2e.mjs     chromium (default), firefox, webkit
//   BASE=https://retropdf.com node tests/...     a deployed site instead of localhost

import { chromium, firefox, webkit } from "playwright"

const engines = { chromium, firefox, webkit }
const name = process.env.BROWSER || "chromium"

if (!engines[name]) {
  console.error(`Unknown BROWSER "${name}". Use chromium, firefox or webkit.`)
  process.exit(2)
}

export const engine = engines[name]
export const BASE = (process.env.BASE || "http://127.0.0.1:8000").replace(/\/$/, "")

console.log(`${name} against ${BASE}`)
