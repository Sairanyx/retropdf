// Registers the loader hook that maps "/static/..." imports onto app/static.
// Node loads this via --import before the tests run.

import { register } from "node:module"
import { pathToFileURL } from "node:url"

register("./resolve-static.mjs", pathToFileURL(import.meta.filename))
