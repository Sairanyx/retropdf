// Two things that depend on where the page is scrolled to.
//
// 1. Blocks appear as they come into view, one after another, rather than
//    everything being visible from the start.
// 2. The nav LED lights for whichever section is currently on screen.
//
// Both are skipped for anyone who has asked for less motion, and neither
// hides anything from search engines: the markup is complete and the CSS
// only dims what has not been reached yet once scripting is running.

const wantsLessMotion =
  window.matchMedia("(prefers-reduced-motion: reduce)").matches

// --- blocks appear as you reach them -----------------------------------

/**
 * Hide the blocks that appear on scroll.
 *
 * This runs immediately rather than waiting for the opening sequence,
 * because a block left visible during the intro is visible before the
 * heading has been written, which is exactly what the sequence is for.
 */
function hideRevealBlocks() {
  if (wantsLessMotion || !("IntersectionObserver" in window)) return
  document.documentElement.classList.add("reveal-on")
}

hideRevealBlocks()

function startReveals() {
  if (wantsLessMotion || !("IntersectionObserver" in window)) return

  const seen = new IntersectionObserver(
    (entries) => {
      for (const entry of entries) {
        if (!entry.isIntersecting) continue
        entry.target.classList.add("shown")
        // Once a block has appeared it stays, so stop watching it.
        seen.unobserve(entry.target)
      }
    },
    // A margin rather than a large threshold: a section taller than the
    // window can never reach a high fraction of itself, so asking for 45%
    // left long sections hidden for good on a short screen.
    { rootMargin: "0px 0px -33% 0px", threshold: 0.01 },
  )

  for (const block of document.querySelectorAll("[data-reveal]")) {
    seen.observe(block)
  }
}

// Wait for the opening sequence, so the two do not fight over the same
// elements. Pages without an intro start immediately.
if (document.body.classList.contains("intro-done")) {
  startReveals()
} else {
  const waiting = new MutationObserver(() => {
    if (document.body.classList.contains("intro-done")) {
      waiting.disconnect()
      startReveals()
    }
  })
  waiting.observe(document.body, { attributes: true, attributeFilter: ["class"] })
}

// --- nav lights follow the section you are in --------------------------

const watched = new Map()
for (const link of document.querySelectorAll("[data-watch]")) {
  const section = document.getElementById(link.dataset.watch)
  if (section) watched.set(section, link)
}

if (watched.size > 0 && "IntersectionObserver" in window) {
  const visible = new Set()

  // Arriving from another page with a #section in the address, the browser
  // lands at the top first and jumps down a moment later. Without this the
  // wrong light comes on for that moment and then swaps, which reads as a
  // glitch. Holding off until the jump has happened avoids it.
  let settling = window.location.hash.length > 1

  if (settling) {
    const target = document.querySelector(window.location.hash)
    if (target) {
      // Arriving with a #section in the address, the browser lands at the
      // top and scrolls down. Reporting during that scroll lights every
      // section it passes, so nothing is reported until it has stopped.
      let quietFor = null
      const waitForStillness = () => {
        clearTimeout(quietFor)
        quietFor = setTimeout(() => {
          window.removeEventListener("scroll", waitForStillness)
          settling = false
          update()
        }, 140)
      }
      window.addEventListener("scroll", waitForStillness, { passive: true })
      waitForStillness()
    } else {
      settling = false
    }
  }

  let update = () => {}

  const where = new IntersectionObserver(
    (entries) => {
      for (const entry of entries) {
        if (entry.isIntersecting) visible.add(entry.target)
        else visible.delete(entry.target)
      }

      if (settling) return
      update()
    },

    // A section counts as current only while it covers the middle third of
    // the window. Nothing is lit at the top of the page, where the hero is,
    // so a light means you have actually scrolled to that section.
    { rootMargin: "-35% 0px -55% 0px" },
  )

  // Light only the topmost visible section, so two never compete.
  update = () => {
    let top = null
    for (const section of visible) {
      if (!top || section.offsetTop < top.offsetTop) top = section
    }
    for (const [section, link] of watched) {
      link.classList.toggle("on", section === top)
    }
  }

  for (const section of watched.keys()) where.observe(section)
}

// --- the hint at the foot of a tool page --------------------------------

/**
 * Sit the other tools just below the fold, showing only their heading.
 *
 * Not expressible in CSS: the space needed depends on where the tool panel
 * above ends, and the panel is much the same height whatever the window, so
 * a fraction of the window hides the heading on a short screen and shows two
 * rows of cards on a tall one.
 */
function placeTheHint() {
  const panel = document.querySelector(".workspace")
  const next = panel?.parentElement?.querySelector(".panel")
  if (!panel || !next) return

  // How much of the heading to leave showing. Enough to read the words and
  // see that something follows them.
  const SHOW = 52

  next.style.paddingTop = ""

  // Measured against the page, not the screen. A rectangle's bottom edge is
  // a different number at every scroll position, which made the padding grow
  // as you scrolled and pushed the section lower and lower.
  let end = panel.offsetHeight
  for (let el = panel; el; el = el.offsetParent) end += el.offsetTop

  const gap = screenHeight() - SHOW - end
  if (gap > 0) next.style.paddingTop = `${Math.round(gap)}px`
}

/**
 * The height of the screen, ignoring the browser's own furniture.
 *
 * On a phone innerHeight changes by about a hundred pixels as the address bar
 * collapses and returns, firing a resize each time. 100svh is the size with
 * the bar showing and does not move.
 */
function screenHeight() {
  if (!CSS.supports?.("height", "100svh")) return window.innerHeight

  const probe = document.createElement("div")
  // Out of the flow and out of sight, so measuring costs nothing visually.
  probe.style.cssText =
    "position:absolute;top:0;left:0;width:0;height:100svh;visibility:hidden;pointer-events:none"
  document.body.append(probe)
  const height = probe.getBoundingClientRect().height
  probe.remove()
  return height || window.innerHeight
}

// Only where a tool panel is followed by another section, which is the tool
// pages. The home page and the workspace are laid out differently.
if (document.querySelector(".workspace") && document.querySelector(".panel")) {
  placeTheHint()

  // The panel changes height as files are opened and tools switched, and the
  // window changes with the browser, so the measurement is taken again.
  const watch = new ResizeObserver(() => placeTheHint())
  watch.observe(document.querySelector(".workspace"))
  window.addEventListener("resize", placeTheHint, { passive: true })

  // The display face is a different width from its fallback, so the panel is
  // a different height once it has arrived.
  document.fonts?.ready.then(placeTheHint)
}
