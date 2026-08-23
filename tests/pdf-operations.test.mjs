// Tests for the PDF operations that back every tool.
//
// These run in Node against the same pdf-lib the browser uses, so a passing
// test means the real operation works, not a stand in for it.

import test from "node:test"
import assert from "node:assert/strict"

import { PDFDocument, rgb } from "/static/js/vendor/pdf-lib.esm.min.js"
import { load, build, close, reset } from "/static/js/pdf-operations.js"

/**
 * Make a PDF with the given number of pages. Each page is drawn a different
 * width so pages can be told apart after they are copied around.
 */
async function makePdf(pageCount) {
  const doc = await PDFDocument.create()
  for (let n = 1; n <= pageCount; n++) {
    const page = doc.addPage([200 + n, 400])
    page.drawRectangle({ x: 0, y: 0, width: 10 * n, height: 10, color: rgb(1, 0, 0) })
  }
  return doc.save()
}

/** Load some bytes back and report each page's width, to identify pages. */
async function widths(bytes) {
  const doc = await PDFDocument.load(bytes)
  return doc.getPages().map((page) => Math.round(page.getWidth()))
}

test.beforeEach(() => reset())

test("load reports the page count", async () => {
  const { id, pageCount } = await load({ bytes: await makePdf(5) })
  assert.equal(pageCount, 5)
  assert.ok(Number.isInteger(id))
})

test("load rejects something that is not a PDF", async () => {
  const notAPdf = new TextEncoder().encode("this is plain text, not a pdf")
  await assert.rejects(
    () => load({ bytes: notAPdf }),
    /could not be read as a PDF/,
  )
})

test("build keeps every page when nothing is dropped", async () => {
  const { id } = await load({ bytes: await makePdf(3) })
  const items = [1, 2, 3].map((page) => ({ doc: id, page }))

  const { bytes } = await build({ items })
  assert.deepEqual(await widths(bytes), [201, 202, 203])
})

test("remove drops the pages that are left out", async () => {
  const { id } = await load({ bytes: await makePdf(5) })
  // Remove pages 2 and 4.
  const items = [1, 3, 5].map((page) => ({ doc: id, page }))

  const { bytes } = await build({ items })
  assert.deepEqual(await widths(bytes), [201, 203, 205])
})

test("extract keeps only the chosen pages", async () => {
  const { id } = await load({ bytes: await makePdf(6) })
  const items = [2, 3].map((page) => ({ doc: id, page }))

  const { bytes } = await build({ items })
  assert.deepEqual(await widths(bytes), [202, 203])
})

test("reorder puts pages in the order given", async () => {
  const { id } = await load({ bytes: await makePdf(4) })
  const items = [4, 1, 3, 2].map((page) => ({ doc: id, page }))

  const { bytes } = await build({ items })
  assert.deepEqual(await widths(bytes), [204, 201, 203, 202])
})

test("merge joins two documents in order", async () => {
  const first = await load({ bytes: await makePdf(2) })
  const second = await load({ bytes: await makePdf(3) })

  const items = [
    { doc: first.id, page: 1 },
    { doc: first.id, page: 2 },
    { doc: second.id, page: 1 },
    { doc: second.id, page: 2 },
    { doc: second.id, page: 3 },
  ]

  const { bytes } = await build({ items })
  assert.deepEqual(await widths(bytes), [201, 202, 201, 202, 203])
})

test("merge can interleave pages from different documents", async () => {
  const a = await load({ bytes: await makePdf(2) })
  const b = await load({ bytes: await makePdf(2) })

  const items = [
    { doc: a.id, page: 1 },
    { doc: b.id, page: 2 },
    { doc: a.id, page: 2 },
  ]

  const { bytes } = await build({ items })
  const doc = await PDFDocument.load(bytes)
  assert.equal(doc.getPageCount(), 3)
})

test("rotate turns only the pages asked for", async () => {
  const { id } = await load({ bytes: await makePdf(3) })
  const items = [
    { doc: id, page: 1, rotate: 90 },
    { doc: id, page: 2 },
    { doc: id, page: 3, rotate: 180 },
  ]

  const { bytes } = await build({ items })
  const doc = await PDFDocument.load(bytes)
  const angles = doc.getPages().map((page) => page.getRotation().angle)
  assert.deepEqual(angles, [90, 0, 180])
})

test("rotating past a full turn wraps back to zero", async () => {
  const { id } = await load({ bytes: await makePdf(1) })
  const { bytes } = await build({ items: [{ doc: id, page: 1, rotate: 360 }] })

  const doc = await PDFDocument.load(bytes)
  assert.equal(doc.getPages()[0].getRotation().angle, 0)
})

test("rotating left from zero gives 270, not a negative angle", async () => {
  const { id } = await load({ bytes: await makePdf(1) })
  const { bytes } = await build({ items: [{ doc: id, page: 1, rotate: -90 }] })

  const doc = await PDFDocument.load(bytes)
  assert.equal(doc.getPages()[0].getRotation().angle, 270)
})

test("build refuses an empty selection", async () => {
  await load({ bytes: await makePdf(3) })
  await assert.rejects(() => build({ items: [] }), /No pages were selected/)
})

test("build refuses a page number past the end", async () => {
  const { id } = await load({ bytes: await makePdf(3) })
  await assert.rejects(
    () => build({ items: [{ doc: id, page: 9 }] }),
    /Page 9 does not exist/,
  )
})

test("build refuses page zero, since pages count from one", async () => {
  const { id } = await load({ bytes: await makePdf(3) })
  await assert.rejects(
    () => build({ items: [{ doc: id, page: 0 }] }),
    /does not exist/,
  )
})

test("build refuses a document that was closed", async () => {
  const { id } = await load({ bytes: await makePdf(2) })
  await close({ id })

  await assert.rejects(
    () => build({ items: [{ doc: id, page: 1 }] }),
    /no longer loaded/,
  )
})

test("a merge then split round trip preserves the page count", async () => {
  const a = await load({ bytes: await makePdf(3) })
  const b = await load({ bytes: await makePdf(4) })

  const merged = await build({
    items: [
      ...[1, 2, 3].map((page) => ({ doc: a.id, page })),
      ...[1, 2, 3, 4].map((page) => ({ doc: b.id, page })),
    ],
  })

  const reloaded = await load({ bytes: merged.bytes })
  assert.equal(reloaded.pageCount, 7)

  const firstHalf = await build({
    items: [1, 2, 3].map((page) => ({ doc: reloaded.id, page })),
  })
  const secondHalf = await build({
    items: [4, 5, 6, 7].map((page) => ({ doc: reloaded.id, page })),
  })

  const back = await Promise.all([widths(firstHalf.bytes), widths(secondHalf.bytes)])
  assert.equal(back[0].length + back[1].length, 7)
})
