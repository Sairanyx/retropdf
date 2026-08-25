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

      // The last section on the page cannot be brought to the top of the
      // window, because there is not a screenful of page left below it. The
      // browser stops partway and the footer ends up half shown.
      //
      // Going to the very bottom instead fixes the footer but pushes a short
      // section off the top, so the heading you came to read sits above the
      // window. This lands wherever shows the most of it: as far down as the
      // page allows, but never past the point where the section itself
      // starts to leave the screen.
      const target = document.querySelector(url.hash)
      if (target && isLastSection(target)) {
        event.preventDefault()
        history.pushState(null, "", url.hash)

        const box = target.getBoundingClientRect()
        const top = box.top + window.scrollY
        const bottom = document.documentElement.scrollHeight - window.innerHeight

        // Centred with its footer, the way every other section is centred in
        // its own screen. Landing at the top of it left the text against the
        // top edge with a screen of nothing below.
        //
        // The room above is whatever is left once the section and its footer
        // are accounted for, halved. It is never taken past the top of the
        // section itself, since that is where the section above begins and
        // the reader would arrive looking at two things at once.
        const foot = document.querySelector("footer")
        const tail = foot
          ? foot.getBoundingClientRect().bottom + window.scrollY
          : top + box.height

        const spare = window.innerHeight - (tail - top)
        const room = Math.max(0, Math.min(spare / 2, box.top + window.scrollY - top))

        window.scrollTo({
          top: Math.min(bottom, Math.max(0, top - room)),
          behavior: "smooth",
        })
      }
      return
    }

    // The logo, clicked while already on the home page. Reloading to reach a
    // place you can see is wasteful, so it scrolls back up instead.
    if (samePage && !url.hash) {
      event.preventDefault()
      // The address still names whichever section you jumped to last, so it
      // is cleared: you are at the top of the page now, not in a section.
      // replaceState rather than pushState, since going back to "the same
      // page with a stale hash" is not a step worth keeping.
      history.replaceState(null, "", url.pathname + url.search)
      window.scrollTo({ top: 0, behavior: "smooth" })
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
