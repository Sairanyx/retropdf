// Tests for the checks that run before a file is opened.
//
// These limits exist to protect the user's own device, since all the work
// happens there. Refusing clearly beats a tab that freezes and dies.

import test from "node:test"
import assert from "node:assert/strict"

import {
  checkFile,
  checkSelection,
  looksLikePdf,
  formatSize,
  computeLimits,
  MAX_FILES,
} from "/static/js/limits.js"

const file = (name, size) => ({ name, size })
const MB = 1024 * 1024

// Fixed limits, so the tests do not depend on the machine running them.
// A budget of 2 GB is typical of a desktop Chrome tab.
const desktop = computeLimits(false, 2048 * MB)
const phone = computeLimits(true, 400 * MB)

test("a normal file is accepted without comment", () => {
  const result = checkFile(file("contract.pdf", 2 * MB), desktop)
  assert.equal(result.ok, true)
  assert.equal(result.warning, undefined)
})

test("an empty file is refused", () => {
  const result = checkFile(file("empty.pdf", 0), desktop)
  assert.equal(result.ok, false)
  assert.match(result.reason, /empty/)
})

test("a large file is accepted but warned about", () => {
  const result = checkFile(file("scan.pdf", desktop.warnAt + 1), desktop)
  assert.equal(result.ok, true)
  assert.match(result.warning, /take a while/)
})

test("an oversized file is refused and told what to do instead", () => {
  const result = checkFile(file("huge.pdf", desktop.maxFile + 1), desktop)
  assert.equal(result.ok, false)
  assert.match(result.reason, /The limit for one file on this device is/)
  assert.match(result.reason, /split it into smaller files/)
})

test("the refusal names the file and its size", () => {
  const result = checkFile(file("huge.pdf", 300 * MB), desktop)
  assert.match(result.reason, /huge\.pdf/)
  assert.match(result.reason, /300 MB/)
})

test("too many files at once is refused", () => {
  const many = Array.from({ length: MAX_FILES + 1 }, (unused, i) =>
    file(`f${i}.pdf`, 1024))
  const result = checkSelection(many, 0, desktop)
  assert.equal(result.ok, false)
  assert.match(result.reason, /The limit is 50 at a time/)
})

test("many small files together are fine", () => {
  const some = Array.from({ length: 20 }, (unused, i) => file(`f${i}.pdf`, 1024 * 1024))
  assert.equal(checkSelection(some, 0, desktop).ok, true)
})

test("files that are individually fine but too big together are refused", () => {
  // Each is under MAX_BYTES, but together they pass MAX_TOTAL_BYTES.
  const each = Math.round(desktop.maxFile * 0.9)
  const count = Math.ceil(desktop.maxTotal / each) + 1
  const big = Array.from({ length: count }, (unused, i) => file(`f${i}.pdf`, each))
  for (const one of big) assert.equal(checkFile(one, desktop).ok, true)

  const result = checkSelection(big, 0, desktop)
  assert.equal(result.ok, false)
  assert.match(result.reason, /The limit on this device is/)
})

test("what is already loaded counts towards the total", () => {
  const one = [file("more.pdf", Math.round(desktop.maxTotal * 0.5))]
  assert.equal(checkSelection(one, 0, desktop).ok, true)
  assert.equal(checkSelection(one, desktop.maxTotal, desktop).ok, false)
})

test("looksLikePdf accepts real PDF bytes", () => {
  const bytes = new TextEncoder().encode("%PDF-1.7\nrest of the file").buffer
  assert.equal(looksLikePdf(bytes), true)
})

test("looksLikePdf rejects a file that only claims to be one", () => {
  const bytes = new TextEncoder().encode("PK\u0003\u0004 this is a zip").buffer
  assert.equal(looksLikePdf(bytes), false)
})

test("looksLikePdf rejects a file too short to check", () => {
  assert.equal(looksLikePdf(new Uint8Array([0x25, 0x50]).buffer), false)
})

test("sizes are written the way people read them", () => {
  assert.equal(formatSize(5 * 1024 * 1024), "5 MB")
  assert.equal(formatSize(200 * 1024), "200 KB")
  assert.equal(formatSize(100), "1 KB")
})


// --- device aware limits ------------------------------------------------

test("a phone gets a much smaller allowance than a desktop", () => {
  assert.ok(phone.maxTotal < desktop.maxTotal)
})

test("a phone allowance stays under what an iPhone SE can hold", () => {
  // Around 100 MB of page memory, and a merge peaks at roughly three times
  // its input, so anything at or above 33 MB risks killing the tab.
  assert.ok(phone.maxTotal <= 60 * MB)
})

test("a tiny reported budget still leaves a usable floor", () => {
  const weak = computeLimits(true, 50 * MB)
  assert.ok(weak.maxTotal >= 20 * MB)
})

test("a huge reported budget is still capped", () => {
  const strong = computeLimits(false, 64 * 1024 * MB)
  assert.ok(strong.maxTotal <= 500 * MB)
})

test("one file is capped below the total for the whole selection", () => {
  assert.ok(desktop.maxFile < desktop.maxTotal)
})

test("the warning comes well before the refusal", () => {
  assert.ok(desktop.warnAt < desktop.maxFile)
})

test("a phone is told a computer would cope better", () => {
  const result = checkFile(file("big.pdf", phone.maxFile + 1), phone)
  assert.equal(result.ok, false)
  assert.match(result.reason, /computer can handle larger files than a phone/)
})
