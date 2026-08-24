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
   * Work out the corners the route turns at.
   *
   * On the home page it snakes: down the left of the hero, across the page,
   * down the right of the tools, back across, then down the left again past
   * privacy. Crossing the full width makes each section feel like a stop on
   * a journey rather than a block in a list.
   *
   * Everywhere else it stays as a narrow weave down one side, since a tool
   * page is somewhere you work rather than somewhere you travel through.
   */
  function corners(width, height) {
    const left = Math.max(28, width * 0.05)
    const right = Math.min(width - 28, width * 0.95)
    const snaking = document.body.dataset.route === "snake"

    if (!snaking) {
      const near = Math.max(28, width * 0.06)
      const far = Math.min(width - 28, width * 0.13)
      const turns = sections.map((section, index) => ({
        x: index % 2 === 0 ? near : far,
        y: middleOf(section),
      }))
      return [
        { x: turns[0].x, y: -80 },
        ...turns,
        { x: turns[turns.length - 1].x, y: height },
      ]
    }

    // Each section gets an entry corner and an exit corner on the same side,
    // so the route runs down beside it before crossing to the next.
    const points = [{ x: left, y: -80 }]

    sections.forEach((section, index) => {
      const box = section.getBoundingClientRect()
      const top = box.top + window.scrollY
      const bottom = top + box.height
      const side = index % 2 === 0 ? left : right

      // Down the side of this section.
      points.push({ x: side, y: top + box.height * 0.15 })
      points.push({ x: side, y: bottom - box.height * 0.15 })

      // Then across to the other side, ready for the next one.
      const next = sections[index + 1]
      if (next) {
        const otherSide = index % 2 === 0 ? right : left
        points.push({ x: otherSide, y: bottom - box.height * 0.15 })
      }
    })

    points.push({ x: points[points.length - 1].x, y: height })
    return points
  }

  function middleOf(section) {
    const box = section.getBoundingClientRect()
    return box.top + window.scrollY + box.height / 2
  }

  /**
   * Lay out the trail.
   *
   * Squares are placed along the route at a fixed spacing, which is what
   * gives the stepped look.
   */
  function layout() {
    trail.replaceChildren()
    dots = []

    const width = document.documentElement.scrollWidth
    const height = document.documentElement.scrollHeight
    const points = corners(width, height)

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
        // Order in this array is the order the route is walked, which is
        // what the lighting uses. Position alone would not do: a sideways
        // stretch shares one height and would light all at once.
        dots.push({
          el: dot,
          x: from.x + dx * along,
          y: from.y + dy * along,
        })
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

    // Which square the reader has reached, by position along the route
    // rather than by height, so a sideways stretch lights in sequence.
    const reached = Math.floor(
      dots.length * Math.min(1, Math.max(0, head / document.documentElement.scrollHeight)),
    )

    let last = null
    dots.forEach((dot, index) => {
      const passed = index <= reached
      dot.el.classList.toggle("lit", passed)
      if (passed) last = dot
    })

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
