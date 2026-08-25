// Softens the jump between pages.
//
// A link to another page is a full reload, which lands as a hard cut. The
// current page settles away first and the new one rises into place, so the
// two read as one movement. Anything leaving the site, opening a new tab, or
// anchoring within this page is left alone.

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

      // The last section cannot be brought to the top of the window: there
      // is not a screenful below it, so the browser stops partway and the
      // footer ends up half shown. This lands wherever shows the most of it.
      const target = document.querySelector(url.hash)
      if (target && isLastSection(target)) {
        event.preventDefault()
        history.pushState(null, "", url.hash)

        const box = target.getBoundingClientRect()
        const top = box.top + window.scrollY
        const bottom = document.documentElement.scrollHeight - window.innerHeight

        // Centred with its footer, the way every other section is centred in
        // its own screen. Never taken past the top of the section itself,
        // since that is where the section above begins.
        const foot = document.querySelector("footer")
        const tail = foot
          ? foot.getBoundingClientRect().bottom + window.scrollY
          : top + box.height

        const spare = window.innerHeight - (tail - top)
        const room = Math.max(0, Math.min(spare / 2, box.top + window.scrollY - top))

        // The same clearance scroll-margin-top gives every other section,
        // which this path cannot use because it scrolls by hand. A ceiling
        // rather than an alternative to the room above, or centring wins and
        // puts the section back under the bar.
        const clear = stuckNavHeight()
        const highest = top - clear

        window.scrollTo({
          top: Math.min(bottom, highest, Math.max(0, top - room)),
          behavior: "smooth",
        })
      }
      return
    }

    // The logo, clicked while already on the home page. Reloading to reach a
    // place you can see is wasteful, so it scrolls back up instead.
    if (samePage && !url.hash) {
      event.preventDefault()
      // Clear the stale #section: you are at the top now. replaceState, since
      // going back to the same page with a stale hash is not worth a step.
      history.replaceState(null, "", url.pathname + url.search)
      window.scrollTo({ top: 0, behavior: "smooth" })
      return
    }

    event.preventDefault()

    // Only the content settles away. The header stays, which makes the
    // change read as moving within a place rather than leaving it.
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
 * How much of the screen the taskbar holds, when it is holding any.
 *
 * Zero on a wide screen, where the nav is out of the flow and covers
 * nothing. Measured from the element rather than repeated as a number, so
 * the two cannot fall out of step.
 */
function stuckNavHeight() {
  const nav = document.querySelector(".navgroup")
  if (!nav) return 0
  if (getComputedStyle(nav.closest("header") || nav).position !== "sticky") return 0
  // A little air below the bar, so the heading is not touching it.
  return Math.round(nav.getBoundingClientRect().height + 16)
}

/**
 * Is this the last section on the page?
 *
 * Only the footer may follow it. Anything else below means there is a
 * screenful left to scroll and the browser can place the section normally.
 */
function isLastSection(section) {
  let next = section.nextElementSibling
  while (next) {
    if (next.tagName !== "FOOTER" && next.offsetHeight > 0) return false
    next = next.nextElementSibling
  }
  return true
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
