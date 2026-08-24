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

function startReveals() {
  if (wantsLessMotion || !("IntersectionObserver" in window)) return
  document.documentElement.classList.add("reveal-on")

  const seen = new IntersectionObserver(
    (entries) => {
      for (const entry of entries) {
        if (!entry.isIntersecting) continue
        entry.target.classList.add("shown")
        // Once a block has appeared it stays, so stop watching it.
        seen.unobserve(entry.target)
      }
    },
    // Fire slightly before the block reaches the bottom edge, so it is
    // already arriving as it comes into view rather than after.
    { rootMargin: "0px 0px -12% 0px", threshold: 0.05 },
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
      // Let the browser finish scrolling, then start reporting.
      requestAnimationFrame(() => {
        target.scrollIntoView({ behavior: "auto", block: "start" })
        setTimeout(() => {
          settling = false
          update()
        }, 60)
      })
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

    // A section counts as current once it covers the middle of the window.
    { rootMargin: "-45% 0px -45% 0px" },
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
