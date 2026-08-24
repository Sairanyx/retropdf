// The mark travels down the page, leaving a trail behind it.
//
// It is the same document mark that falls at the start and settles into the
// logo. Once you begin scrolling it sets off again, following a route down
// the page and drawing a pixel trail as it goes, so the page reads as one
// route being followed rather than a stack of separate blocks.
//
// The trail is drawn as discrete squares rather than a smooth line, so it
// matches the stepped edges of the display face.
//
// Purely decorative: it sits behind the content, never intercepts the
// scroll, and screen readers do not see it.

const wantsLessMotion =
  window.matchMedia("(prefers-reduced-motion: reduce)").matches

if (!wantsLessMotion) startRoute()

function startRoute() {
  const sections = Array.from(document.querySelectorAll(".wrap > section"))
  if (sections.length < 2) return

  const layer = document.createElement("div")
  layer.className = "route"
  layer.setAttribute("aria-hidden", "true")

  // The trail, as a run of squares. They are placed once and then revealed
  // in order, which is far cheaper than redrawing a path on every frame.
  const trail = document.createElement("div")
  trail.className = "route-trail"
  layer.append(trail)

  // The mark itself, the same shape that falls during the opening.
  const mark = document.createElement("div")
  mark.className = "route-mark"
  mark.innerHTML = `
    <svg viewBox="0 0 22 26" fill="none">
      <path d="M2 1h11l7 7v16a1 1 0 0 1-1 1H2a1 1 0 0 1-1-1V2a1 1 0 0 1 1-1Z"
            stroke="currentColor" stroke-width="1.6"/>
      <path d="M13 1v7h7" stroke="currentColor" stroke-width="1.6"/>
      <rect x="5" y="14" width="12" height="5" rx="1" fill="var(--accent)"/>
    </svg>`
  layer.append(mark)

  document.body.append(layer)

  // Every square in the trail, in the order they are passed.
  let dots = []

  const DOT = 6 // square size, matched to the stepped edges of the font
  const GAP = 16 // distance between squares along the route

  /**
   * Lay out the trail.
   *
   * The route runs down the page, bending toward each section in turn so it
   * weaves rather than running straight. Squares are placed along it at a
   * fixed spacing, which is what gives the stepped look.
   */
  function layout() {
    trail.replaceChildren()
    dots = []

    const width = document.documentElement.scrollWidth
    const height = document.documentElement.scrollHeight

    // Kept clear of the text, which sits in the middle of the page.
    const near = Math.max(28, width * 0.06)
    const far = Math.min(width - 28, width * 0.13)

    // One turning point per section, alternating side to side.
    const turns = sections.map((section, index) => {
      const box = section.getBoundingClientRect()
      return {
        x: index % 2 === 0 ? near : far,
        y: box.top + window.scrollY + box.height / 2,
      }
    })

    // Start above the first section so the route arrives from off screen.
    const points = [{ x: turns[0].x, y: -80 }, ...turns, {
      x: turns[turns.length - 1].x,
      y: height,
    }]

    // Walk the route, placing a square every GAP pixels. Straight segments
    // between the turning points are enough: the alternating sides already
    // give the weave, and a curve would not survive being sampled this
    // coarsely anyway.
    for (let i = 1; i < points.length; i++) {
      const from = points[i - 1]
      const to = points[i]
      const dx = to.x - from.x
      const dy = to.y - from.y
      const distance = Math.hypot(dx, dy)
      const steps = Math.floor(distance / GAP)

      for (let step = 0; step < steps; step++) {
        const along = step / steps
        const dot = document.createElement("span")
        dot.className = "route-dot"
        dot.style.left = `${from.x + dx * along - DOT / 2}px`
        dot.style.top = `${from.y + dy * along - DOT / 2}px`
        trail.append(dot)
        dots.push({ el: dot, y: from.y + dy * along, x: from.x + dx * along })
      }
    }
  }

  /**
   * Reveal the trail as far as the reader has come, and put the mark at the
   * front of it.
   */
  let ticking = false
  function update() {
    ticking = false
    if (dots.length === 0) return

    // The head of the trail sits a little below the middle of the window, so
    // the mark travels alongside what is being read rather than trailing at
    // the bottom edge.
    const head = window.scrollY + window.innerHeight * 0.55

    let last = null
    for (const dot of dots) {
      const passed = dot.y <= head
      dot.el.classList.toggle("lit", passed)
      if (passed) last = dot
    }

    if (last) {
      mark.style.transform = `translate(${last.x}px, ${last.y}px)`
      mark.style.opacity = "1"
    } else {
      mark.style.opacity = "0"
    }
  }

  function onScroll() {
    if (ticking) return
    ticking = true
    requestAnimationFrame(update)
  }

  window.addEventListener("scroll", onScroll, { passive: true })
  window.addEventListener("resize", () => {
    layout()
    update()
  }, { passive: true })

  // Wait a frame so the layout has settled before measuring it.
  requestAnimationFrame(() => {
    layout()
    update()
  })
}
