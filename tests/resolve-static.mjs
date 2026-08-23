// The browser code imports absolute paths such as "/static/js/vendor/...".
// Node cannot resolve those on its own, so this loader hook maps them.
//
// Project modules map onto app/static. The vendored libraries map onto
// node_modules instead: they are the same version, but the copies under
// node_modules carry the .mjs and package metadata Node needs to treat them
// as modules. The browser has no such constraint and loads the vendored
// files directly.

import { pathToFileURL } from "node:url"
import { dirname, join } from "node:path"
import { fileURLToPath } from "node:url"

const here = dirname(fileURLToPath(import.meta.url))
const root = join(here, "..")
const staticDir = join(root, "app", "static")

const vendorAliases = {
  "/static/js/vendor/pdf-lib.esm.min.js":
    join(root, "node_modules", "@cantoo", "pdf-lib", "dist", "pdf-lib.esm.js"),
  "/static/js/vendor/pdf.min.mjs":
    join(root, "node_modules", "pdfjs-dist", "build", "pdf.mjs"),
}

export function resolve(specifier, context, nextResolve) {
  const alias = vendorAliases[specifier]
  if (alias) {
    return { url: pathToFileURL(alias).href, shortCircuit: true }
  }

  if (specifier.startsWith("/static/")) {
    const filePath = join(staticDir, specifier.slice("/static/".length))
    return { url: pathToFileURL(filePath).href, shortCircuit: true }
  }

  return nextResolve(specifier, context)
}
