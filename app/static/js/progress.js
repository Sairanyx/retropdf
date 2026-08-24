// The mark travels down the page, laying a trail behind it.
//
// It is the same document mark that falls during the opening sequence and
// settles into the logo. Once you begin scrolling it sets off again from
// there, bouncing gently from side to side down the page.
//
// The trail is a run of squares rather than a drawn line, so its edges are
// stepped in the same way the display face is.
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

  /**
   * The corners the route turns at.
   *
   * The route leaves the logo, runs straight down one margin, steps across
   * to the other, and continues. Straight runs and square corners rather
   * than curves or diagonals: the shape is built from the same right angles
   * as the pixel type, and a diagonal across the page would cut through
   * whatever is being read.
   */
  function corners(width) {
    const margin = Math.max(28, width * 0.045)
    const near = margin
    const far = width - margin

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
      : { x: near, y: 0 }

    // The first turn goes to whichever side is further from the logo, so the
    // route leaves it heading outward rather than doubling back.
    const startsFar = Math.abs(from.x - near) > Math.abs(from.x - far)

    const points = [from]

    sections.forEach((section, index) => {
      const box = section.getBoundingClientRect()
      const top = box.top + window.scrollY
      const bottom = top + box.height
      const side = (startsFar ? index % 2 === 0 : index % 2 === 1) ? far : near

      // Step across at the top of the section, then run straight down it.
      points.push({ x: side, y: top })
      points.push({ x: side, y: bottom })
    })

    return points
  }

  /** Walk the route, placing a square every GAP pixels. */
  function layout() {
    trail.replaceChildren()
    dots = []

    const points = corners(document.documentElement.scrollWidth)

    for (let i = 1; i < points.length; i++) {
      const from = points[i - 1]
      const to = points[i]
      const distance = Math.hypot(to.x - from.x, to.y - from.y)
      const steps = Math.max(1, Math.floor(distance / GAP))

      for (let step = 0; step < steps; step++) {
        const along = step / steps
        const x = from.x + (to.x - from.x) * along
        const y = from.y + (to.y - from.y) * along

        const dot = document.createElement("span")
        dot.className = "route-dot"
        dot.style.left = x - DOT / 2 + "px"
        dot.style.top = y - DOT / 2 + "px"
        trail.append(dot)

        // Order in this array is the order the route is walked, which is what
        // the lighting uses. Height alone would not do: a sideways stretch
        // shares one height and would light all at once.
        dots.push({ el: dot, x: x, y: y })
      }
    }
  }

  /**
   * Light the trail as far as the reader has come, and place the mark at the
   * head of it.
   */
  let ticking = false
  function update() {
    ticking = false
    if (dots.length === 0) return

    const scrollable =
      document.documentElement.scrollHeight - window.innerHeight
    const through =
      scrollable > 0 ? Math.min(1, Math.max(0, window.scrollY / scrollable)) : 0

    const reached = Math.min(dots.length - 1, Math.round(dots.length * through))

    dots.forEach(function (dot, index) {
      dot.el.classList.toggle("lit", index <= reached)
    })

    // The mark follows the route, but is held within the middle band of the
    // window. Left to itself it drifts into the very top or bottom corner,
    // where it reads as something stuck rather than travelling alongside
    // what is being read.
    const head = dots[reached]
    const onScreen = head.y - window.scrollY
    const highest = window.innerHeight * 0.25
    const lowest = window.innerHeight * 0.6
    const heldY = window.scrollY + Math.min(lowest, Math.max(highest, onScreen))

    mark.style.transform = "translate(" + head.x + "px, " + heldY + "px)"
    mark.style.opacity = through > 0.002 ? "1" : "0"
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
