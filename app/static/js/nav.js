// Softens the jump between pages.
//
// A link to another page is a full reload, which lands as a hard cut. Fading
// the current page out first, then letting the new one fade in, removes the
// flash without making navigation feel slow.
//
// Anything that would leave the site, open a new tab, or is a plain anchor on
// this page is left alone.

const wantsLessMotion =
  window.matchMedia("(prefers-reduced-motion: reduce)").matches

const FADE_MS = 160

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
    const samePage =
      url.pathname === window.location.pathname && url.search === window.location.search
    if (samePage && url.hash) return

    event.preventDefault()
    document.body.classList.add("leaving")
    setTimeout(() => {
      window.location.href = link.href
    }, FADE_MS)
  })

  // Coming back with the browser's back button can restore the faded state
  // from cache, so it is always cleared on arrival.
  window.addEventListener("pageshow", () => {
    document.body.classList.remove("leaving")
  })
}
