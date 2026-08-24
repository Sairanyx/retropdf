// Softens the jump between pages.
//
// A link to another page is a full reload, which lands as a hard cut. The
// current page settles away first, and the new one rises into place, so the
// two read as one movement rather than a flicker.
//
// The timing is deliberately unhurried. A page change that is too quick
// registers as a glitch, and one that is too slow gets in the way. Around
// four hundred milliseconds each side sits between the two.
//
// Anything that would leave the site, open a new tab, or is a plain anchor on
// this page is left alone.

const wantsLessMotion =
  window.matchMedia("(prefers-reduced-motion: reduce)").matches

// Must match --leave-ms in the stylesheet.
const LEAVE_MS = 380

if (!wantsLessMotion) {
  document.addEventListener("click", (event) => {
    // Let the browser handle anything with a modifier held, which usually
    // means open in a new tab or window.
    if (event.metaKey || event.ctrlKey || event.shiftKey || event.altKey) return
    if (event.button !== 0) return

    const link = event.target.closest("a")
    if (!link || link.target === "_blank" || link.hasAttribute("download")) return

    const url = new URL(link.href, window.location.href)
    if (url.origin !== window.location.origin) return

    // A link to a section of this same page scrolls, it does not navigate.
    // Smooth scrolling is switched on just for the jump, since leaving it on
    // would also animate the browser restoring your position on reload.
    const samePage =
      url.pathname === window.location.pathname && url.search === window.location.search
    if (samePage && url.hash) {
      glide()
      return
    }

    event.preventDefault()

    // Only the content settles away. The header stays, because it is the
    // one thing common to both pages, which is what makes the change read
    // as moving within a place rather than leaving it.
    document.body.classList.add("leaving")

    setTimeout(() => {
      window.location.href = link.href
    }, LEAVE_MS)
  })

  // Coming back with the browser's back button can restore the faded state
  // from cache, so it is always cleared on arrival.
  window.addEventListener("pageshow", () => {
    document.body.classList.remove("leaving")
  })
}

/**
 * Allow smooth scrolling for the length of one jump.
 *
 * A second or so covers any reasonable distance, after which it is turned
 * off again so nothing else on the page inherits it.
 */
let glideTimer = null
function glide() {
  document.documentElement.classList.add("gliding")
  clearTimeout(glideTimer)
  glideTimer = setTimeout(() => {
    document.documentElement.classList.remove("gliding")
  }, 1200)
}
