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

if (!wantsLessMotion) waitThenStart()

/**
 * Hold off until the opening sequence has finished.
 *
 * Laying the trail while the page is still arriving would put a line on
 * screen before the heading it is meant to follow.
 */
function waitThenStart() {
  if (document.body.classList.contains("intro-done")) {
    startRoute()
    return
  }

  const waiting = new MutationObserver(() => {
    if (!document.body.classList.contains("intro-done")) return
    waiting.disconnect()
    startRoute()
  })
  waiting.observe(document.body, { attributes: true, attributeFilter: ["class"] })
}

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
    //
    // The home page swings the full width, so the route crosses the screen
    // between sections and each one feels like a stop along the way. Other
    // pages keep a narrow weave down one side, since a tool page is
    // somewhere you work rather than travel through.
    const wide = document.body.dataset.route === "snake"
    const near = wide ? Math.max(28, width * 0.05) : Math.max(28, width * 0.06)
    const far = wide
      ? Math.min(width - 28, width * 0.92)
      : Math.min(width - 28, width * 0.13)

    // The mark sets off from the icon in the brand plate, which is where the
    // opening sequence left it, so the logo is the start of the journey.
    const icon = document.querySelector("#brand-plate svg")
    const from = icon
      ? (() => {
          const box = icon.getBoundingClientRect()
          return {
            x: box.left + window.scrollX + box.width / 2,
            y: box.top + window.scrollY + box.height / 2,
          }
        })()
      : { x: near, y: -80 }

    // The first turn goes to whichever side is further from the logo, so the
    // route leaves it heading outward rather than doubling back.
    const startsFar = Math.abs(from.x - near) < Math.abs(from.x - far)

    // The route hugs one edge, runs the length of a section, then curves
    // across to the other edge for the next one. Long straight diagonals
    // across the middle would cut through the text, which is what makes a
    // route read as a stray line rather than a path around the content.
    const points = [from]

    sections.forEach((section, index) => {
      const box = section.getBoundingClientRect()
      const top = box.top + window.scrollY
      const bottom = top + box.height
      const onFarSide = startsFar ? index % 2 === 0 : index % 2 === 1
      const side = onFarSide ? far : near

      // Arrive at this edge, then run down it.
      points.push({ x: side, y: top + box.height * 0.18 })
      points.push({ x: side, y: bottom - box.height * 0.18 })
    })

    // Off the bottom, on whichever side the route finished.
    points.push({ x: points[points.length - 1].x, y: height })

    return points
  }

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
    //
    // The home page swings the full width, so the route crosses the screen
    // between sections and each one feels like a stop along the way. Other
    // pages keep a narrow weave down one side, since a tool page is
    // somewhere you work rather than travel through.
    const wide = document.body.dataset.route === "snake"
    const near = wide ? Math.max(28, width * 0.05) : Math.max(28, width * 0.06)
    const far = wide
      ? Math.min(width - 28, width * 0.92)
      : Math.min(width - 28, width * 0.13)

    // The mark sets off from the icon in the brand plate, which is where the
    // opening sequence left it, so the logo is the start of the journey.
    const icon = document.querySelector("#brand-plate svg")
    const from = icon
      ? (() => {
          const box = icon.getBoundingClientRect()
          return {
            x: box.left + window.scrollX + box.width / 2,
            y: box.top + window.scrollY + box.height / 2,
          }
        })()
      : { x: near, y: -80 }

    // One turning point per section, alternating side to side.
    //
    // The first turn goes to whichever side is further from the logo, so the
    // route leaves it heading outward. Turning toward the near side first
    // would send the mark backwards across the short gap to the page edge.
    const startsFar = Math.abs(from.x - near) < Math.abs(from.x - far)

    const turns = sections.map((section, index) => {
      const box = section.getBoundingClientRect()
      const onFarSide = startsFar ? index % 2 === 0 : index % 2 === 1
      return {
        x: onFarSide ? far : near,
        y: box.top + window.scrollY + box.height / 2,
      }
    })

    const points = [from, ...turns, {
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
  // Where the mark was on the last frame, so the direction of travel is
  // known. The trail only ever falls behind it, never ahead.
  let previousIndex = 0

  let ticking = false
  function update() {
    ticking = false
    if (dots.length === 0) return

    const scrollable =
      document.documentElement.scrollHeight - window.innerHeight
    const through =
      scrollable > 0 ? Math.min(1, Math.max(0, window.scrollY / scrollable)) : 0

    // Position along the route, worked out from how far down the page the
    // reader is. Using distance travelled rather than height means a
    // sideways stretch is crossed in sequence rather than lighting at once,
    // and the mark reaches the end of the route exactly at the foot of the
    // page rather than stopping short.
    const index = Math.min(dots.length - 1, Math.round(dots.length * through))
    const goingForward = index >= previousIndex

    dots.forEach((dot, at) => {
      // Everything the mark has already passed stays lit, so the route
      // behind is a record of where you have been.
      const passed = at <= index
      dot.el.classList.toggle("lit", passed)

      // A brighter run immediately behind the mark, which reads as the trail
      // it is leaving. Behind means the opposite way to travel: scrolling
      // down it falls above, scrolling up it falls below. Without that it
      // appears ahead of the mark, which looks like it is being pulled
      // rather than moving.
      const distance = goingForward ? index - at : at - index
      dot.el.classList.toggle("fresh", distance >= 0 && distance < 9)
    })

    previousIndex = index

    const head = dots[index]
    mark.style.transform = `translate(${head.x}px, ${head.y}px)`
    mark.style.opacity = through > 0.002 ? "1" : "0"
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
