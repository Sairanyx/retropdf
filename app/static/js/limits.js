// Checks that run before a file is opened.
//
// All the work happens on the user's own device, so these limits exist to
// stop their phone or laptop running out of memory, not to protect a server.
//
// The important thing to understand: on iOS there is no way to recover from
// running out. The tab is killed with no JavaScript error to catch, so the
// only defence is refusing before it happens. Measured limits are roughly
// 100 MB of page memory on an iPhone SE and 200 MB on an iPad, while desktop
// browsers get several gigabytes per tab. One number cannot serve both.

/** Rough memory budget for this device, in bytes. */
function deviceBudget() {
  // Chrome and Edge report the actual heap limit, which is the best signal.
  if (typeof performance !== "undefined" && performance.memory) {
    const limit = performance.memory.jsHeapSizeLimit
    if (limit) return limit
  }

  // navigator.deviceMemory is device RAM in GB, rounded and capped at 8. Only
  // Chromium reports it, and a tab gets a fraction of the whole machine.
  if (typeof navigator !== "undefined" && navigator.deviceMemory) {
    return navigator.deviceMemory * 1024 * 1024 * 1024 * 0.25
  }

  // Nothing to go on. Safari and Firefox report neither, and Safari is where
  // the tight limits live, so assume the worst.
  return 400 * 1024 * 1024
}

/**
 * True when this looks like a phone or tablet.
 *
 * iOS is the case that matters: its page memory limit is low, and exceeding
 * it kills the tab outright with nothing to catch.
 */
function isMobile() {
  if (typeof navigator === "undefined") return false
  if (navigator.userAgentData) return navigator.userAgentData.mobile === true
  return /Android|iPhone|iPad|iPod|Mobile/i.test(navigator.userAgent || "")
}

// A merge holds the sources and the output at once, then copies the result
// again to hand it to the browser, so peak use is roughly three times the
// input. The usable share of the budget is therefore a third of it.
const PEAK_MULTIPLE = 3

export function computeLimits(mobile = isMobile(), budget = deviceBudget()) {
  // Leave room for the page itself, the rendered thumbnails and the browser.
  const usable = (budget * (mobile ? 0.3 : 0.5)) / PEAK_MULTIPLE

  // Clamp into a sensible range whatever the device claims.
  const floor = mobile ? 20 * 1024 * 1024 : 80 * 1024 * 1024
  const ceiling = mobile ? 60 * 1024 * 1024 : 500 * 1024 * 1024
  const total = Math.min(ceiling, Math.max(floor, usable))

  return {
    mobile,
    // One file is capped below the total, since a single large document is
    // harder on memory than several smaller ones of the same combined size.
    maxFile: Math.round(total * 0.7),
    maxTotal: Math.round(total),
    // Warn well before refusing, so slowness is expected rather than alarming.
    warnAt: Math.round(total * 0.35),
  }
}

export const LIMITS = computeLimits()
export const MAX_FILES = 50

export function formatSize(bytes) {
  if (bytes >= 1024 * 1024) return `${Math.round(bytes / (1024 * 1024))} MB`
  return `${Math.max(1, Math.round(bytes / 1024))} KB`
}

/**
 * Decide whether a file can be opened.
 *
 * Returns { ok } when it is fine, { ok, warning } when it is large but
 * workable, or { ok: false, reason } when it must be refused. Messages are
 * written to be shown to the user unchanged.
 */
export function checkFile(file, limits = LIMITS) {
  if (file.size === 0) {
    return { ok: false, reason: `${file.name} is empty.` }
  }

  if (file.size > limits.maxFile) {
    return {
      ok: false,
      reason:
        `${file.name} is ${formatSize(file.size)}. The limit for one file on ` +
        `this device is ${formatSize(limits.maxFile)}. ` +
        (limits.mobile
          ? "A computer can handle larger files than a phone."
          : "You could split it into smaller files first."),
    }
  }

  if (file.size > limits.warnAt) {
    return {
      ok: true,
      warning: `${file.name} is ${formatSize(file.size)}, so this may take a while.`,
    }
  }

  return { ok: true }
}

/** Check a whole selection before any of it is opened. */
export function checkSelection(files, alreadyLoadedBytes = 0, limits = LIMITS) {
  if (files.length > MAX_FILES) {
    return {
      ok: false,
      reason: `That is ${files.length} files. The limit is ${MAX_FILES} at a time.`,
    }
  }

  let total = alreadyLoadedBytes
  for (const file of files) {
    const check = checkFile(file, limits)
    if (!check.ok) return check
    total += file.size
  }

  if (total > limits.maxTotal) {
    return {
      ok: false,
      reason:
        `Those files come to ${formatSize(total)}. The limit on this device ` +
        `is ${formatSize(limits.maxTotal)} at a time, so try choosing fewer.`,
    }
  }

  return { ok: true }
}

/**
 * Confirm the bytes really are a PDF.
 *
 * A file name can claim anything, so this checks the contents. Every PDF
 * begins with the characters %PDF-.
 */
export function looksLikePdf(bytes) {
  if (bytes.byteLength < 5) return false
  const view = new Uint8Array(bytes, 0, 5)
  return (
    view[0] === 0x25 && // %
    view[1] === 0x50 && // P
    view[2] === 0x44 && // D
    view[3] === 0x46 && // F
    view[4] === 0x2d // -
  )
}
