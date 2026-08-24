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

if (!wantsLessMotion && "IntersectionObserver" in window) {
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

// --- nav lights follow the section you are in --------------------------

const watched = new Map()
for (const link of document.querySelectorAll("[data-watch]")) {
  const section = document.getElementById(link.dataset.watch)
  if (section) watched.set(section, link)
}

if (watched.size > 0 && "IntersectionObserver" in window) {
  const visible = new Set()

  const where = new IntersectionObserver(
    (entries) => {
      for (const entry of entries) {
        if (entry.isIntersecting) visible.add(entry.target)
        else visible.delete(entry.target)
      }

      // Light only the topmost visible section, so two lights never compete.
      let top = null
      for (const section of visible) {
        if (!top || section.offsetTop < top.offsetTop) top = section
      }

      for (const [section, link] of watched) {
        link.classList.toggle("on", section === top)
      }
    },
    // A section counts as current once it covers the middle of the window.
    { rootMargin: "-45% 0px -45% 0px" },
  )

  for (const section of watched.keys()) where.observe(section)
}
