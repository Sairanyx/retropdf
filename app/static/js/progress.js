// The mark leaves the logo and travels down the page, laying a trail.
//
// It is the same document mark that falls at the start and settles into the
// brand plate. Once you begin scrolling it sets off again from exactly
// there, so the logo is where the journey starts rather than a separate
// thing that happens to look similar.
//
// The trail is a run of squares rather than a drawn line, matching the
// stepped edges of the display face, and corners are eased through so the
// route curves rather than turning at right angles.
//
// Purely decorative: behind the content, never intercepts the scroll, and
// hidden from screen readers.

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

  const trail = document.createElement("div")
  trail.className = "route-trail"
  layer.append(trail)

  const mark = document.createElement("div")
  mark.className = "route-mark"
  mark.innerHTML =
    '<svg viewBox="0 0 22 26" fill="none">' +
    '<path d="M2 1h11l7 7v16a1 1 0 0 1-1 1H2a1 1 0 0 1-1-1V2a1 1 0 0 1 1-1Z" stroke="currentColor" stroke-width="1.6"/>' +
    '<path d="M13 1v7h7" stroke="currentColor" stroke-width="1.6"/>' +
    '<rect x="5" y="14" width="12" height="5" rx="1" fill="var(--accent)"/>' +
    "</svg>"
  layer.append(mark)

  document.body.append(layer)

  let dots = []

  const DOT = 6 // square size, matched to the stepped edges of the font
  const GAP = 16 // distance between squares along the route
  const CURVE = 110 // how far before a corner the route starts bending

  /** Where the mark sets off from: the icon inside the brand plate. */
  function startPoint() {
    const icon = document.querySelector("#brand-plate svg")
    if (!icon) return null
    const box = icon.getBoundingClientRect()
    return {
      x: box.left + window.scrollX + box.width / 2,
      y: box.top + window.scrollY + box.height / 2,
    }
  }

  /**
   * The corners the route turns at.
   *
   * On the home page it snakes: down one side of a section, across the page,
   * down the other side of the next. Elsewhere it stays a narrow weave, since
   * a tool page is somewhere you work rather than travel through.
   */
  function corners(width, height) {
    const snaking = document.body.dataset.route === "snake"
    const from = startPoint() || { x: Math.max(28, width * 0.05), y: 0 }

    if (!snaking) {
      const near = Math.max(28, width * 0.06)
      const far = Math.min(width - 28, width * 0.13)
      const turns = sections.map((section, index) => {
        const box = section.getBoundingClientRect()
        return {
          x: index % 2 === 0 ? near : far,
          y: box.top + window.scrollY + box.height / 2,
        }
      })
      return [from, ...turns, { x: turns[turns.length - 1].x, y: height }]
    }

    const left = Math.max(28, width * 0.05)
    const right = Math.min(width - 28, width * 0.95)
    const points = [from]

    sections.forEach((section, index) => {
      const box = section.getBoundingClientRect()
      const top = box.top + window.scrollY
      const bottom = top + box.height
      const side = index % 2 === 0 ? left : right

      points.push({ x: side, y: top + box.height * 0.2 })
      points.push({ x: side, y: bottom - box.height * 0.2 })

      if (sections[index + 1]) {
        points.push({
          x: index % 2 === 0 ? right : left,
          y: bottom - box.height * 0.2,
        })
      }
    })

    points.push({ x: points[points.length - 1].x, y: height })
    return points
  }

  /**
   * Walk the route, placing a square every GAP pixels.
   *
   * Approaching a corner the position is nudged toward wherever the route
   * goes next, which rounds the turn instead of leaving a right angle.
   */
  function layout() {
    trail.replaceChildren()
    dots = []

    const width = document.documentElement.scrollWidth
    const height = document.documentElement.scrollHeight
    const points = corners(width, height)

    for (let i = 1; i < points.length; i++) {
      const from = points[i - 1]
      const to = points[i]
      const next = points[i + 1]

      const distance = Math.hypot(to.x - from.x, to.y - from.y)
      const steps = Math.max(1, Math.floor(distance / GAP))

      for (let step = 0; step < steps; step++) {
        const along = step / steps
        let x = from.x + (to.x - from.x) * along
        let y = from.y + (to.y - from.y) * along

        if (next && distance > 0) {
          const remaining = distance * (1 - along)
          if (remaining < CURVE) {
            const bend = 1 - remaining / CURVE
            const eased = bend * bend * 0.5
            x += (next.x - to.x) * eased
            y += (next.y - to.y) * eased
          }
        }

        const dot = document.createElement("span")
        dot.className = "route-dot"
        dot.style.left = (x - DOT / 2) + "px"
        dot.style.top = (y - DOT / 2) + "px"
        trail.append(dot)

        // Order in this array is the order the route is walked, which is what
        // the lighting uses. Height alone would not do: a sideways stretch
        // shares one height and would light all at once.
        dots.push({ el: dot, x: x, y: y })
      }
    }
  }

  /**
   * Light the trail as far as the reader has come.
   *
   * Worked out from how far down the page they are, so the mark stays beside
   * what they are reading rather than running ahead or lagging behind.
   */
  let ticking = false
  function update() {
    ticking = false
    if (dots.length === 0) return

    const scrollable =
      document.documentElement.scrollHeight - window.innerHeight
    if (scrollable <= 0) return

    const through = Math.min(1, Math.max(0, window.scrollY / scrollable))
    const reached = Math.round(dots.length * through)

    dots.forEach(function (dot, index) {
      dot.el.classList.toggle("lit", index <= reached)
    })

    const head = dots[Math.min(dots.length - 1, reached)]
    mark.style.transform = "translate(" + head.x + "px, " + head.y + "px)"
    // Invisible at the very top, where it is still part of the logo.
    mark.style.opacity = through > 0.004 ? "1" : "0"
  }

  function onScroll() {
    if (ticking) return
    ticking = true
    requestAnimationFrame(update)
  }

  window.addEventListener("scroll", onScroll, { passive: true })
  window.addEventListener(
    "resize",
    function () {
      layout()
      update()
    },
    { passive: true },
  )

  requestAnimationFrame(function () {
    layout()
    update()
  })
}
