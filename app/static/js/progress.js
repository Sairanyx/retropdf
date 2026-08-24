// A hairline down the left edge showing how far through the page you are.
//
// The point is to stop the page feeling bottomless. Without any sense of
// length, people stop scrolling early because they cannot tell whether there
// is anything left. This never moves the content and never takes control of
// the scroll away from the reader.
//
// Hidden entirely on a page short enough not to need it.

const wantsLessMotion =
  window.matchMedia("(prefers-reduced-motion: reduce)").matches

const rail = document.createElement("div")
rail.className = "progress"
rail.setAttribute("aria-hidden", "true")

const fill = document.createElement("div")
fill.className = "progress-fill"
rail.append(fill)
document.body.append(rail)

let ticking = false

function update() {
  ticking = false

  const scrollable = document.documentElement.scrollHeight - window.innerHeight

  // A page barely taller than the window does not need telling how long it
  // is, and a rail that jumps from empty to full is worse than none.
  if (scrollable < window.innerHeight * 0.5) {
    rail.style.display = "none"
    return
  }

  rail.style.display = ""
  const through = Math.min(1, Math.max(0, window.scrollY / scrollable))
  fill.style.height = `${through * 100}%`
}

// Scroll events fire far more often than the screen redraws, so the work is
// deferred to the next frame rather than done on every one.
function onScroll() {
  if (ticking) return
  ticking = true
  requestAnimationFrame(update)
}

window.addEventListener("scroll", onScroll, { passive: true })
window.addEventListener("resize", onScroll, { passive: true })
update()
