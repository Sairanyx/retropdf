// A dashed route running the length of the page, behind everything.
//
// One continuous line rather than a bar or a set of separate marks: it
// leaves the hero, bends past each section, and draws itself as you scroll.
// The effect is that the page reads as a single route being followed rather
// than a stack of unrelated blocks, and it answers the question a long page
// always raises, which is whether there is anything below.
//
// It sits behind the content, never intercepts the scroll, and is decoration
// only. Nothing depends on it and screen readers do not see it.

const wantsLessMotion =
  window.matchMedia("(prefers-reduced-motion: reduce)").matches

if (!wantsLessMotion) drawRoute()

function drawRoute() {
  const sections = Array.from(document.querySelectorAll(".wrap > section"))
  if (sections.length < 2) return

  const svg = document.createElementNS("http://www.w3.org/2000/svg", "svg")
  svg.setAttribute("class", "route")
  svg.setAttribute("aria-hidden", "true")
  svg.setAttribute("preserveAspectRatio", "none")

  const path = document.createElementNS("http://www.w3.org/2000/svg", "path")
  path.setAttribute("class", "route-line")
  svg.append(path)

  // A page travelling along the route, at the head of the drawn line. It is
  // the thing being worked on, following the path down through the tools.
  const marker = document.createElementNS("http://www.w3.org/2000/svg", "g")
  marker.setAttribute("class", "route-mark")
  marker.innerHTML =
    '<path d="M-7 -9h9l5 5v13h-14z" />' +
    '<path d="M2 -9v5h5" />' +
    '<rect x="-4" y="1" width="8" height="3" class="route-mark-bar" />'
  svg.append(marker)

  document.body.append(svg)

  /**
   * Build a path that threads past each section in turn.
   *
   * The line alternates sides so it weaves down the page rather than running
   * straight, and each bend lands beside a section, which is what makes it
   * feel like a route between places rather than a ruler.
   */
  function shape() {
    const width = document.documentElement.scrollWidth
    const height = document.documentElement.scrollHeight
    svg.setAttribute("viewBox", `0 0 ${width} ${height}`)
    svg.setAttribute("width", width)
    svg.setAttribute("height", height)

    // Keep the line clear of the text, which sits in the middle column.
    const left = Math.max(24, width * 0.08)
    const right = Math.min(width - 24, width * 0.92)

    const points = sections.map((section, index) => {
      const box = section.getBoundingClientRect()
      const middle = box.top + window.scrollY + box.height / 2
      return { x: index % 2 === 0 ? left : right, y: middle }
    })

    // Start above the first section and finish below the last, so the line
    // arrives from off screen rather than beginning in mid air.
    let d = `M ${points[0].x} ${Math.max(0, points[0].y - 260)}`
    for (let i = 0; i < points.length; i++) {
      const point = points[i]
      const previous = i === 0 ? { x: point.x, y: point.y - 260 } : points[i - 1]
      // A curve whose control points sit vertically between the two, which
      // gives a long sweeping bend rather than a sharp corner.
      const midway = (previous.y + point.y) / 2
      d += ` C ${previous.x} ${midway}, ${point.x} ${midway}, ${point.x} ${point.y}`
    }
    const last = points[points.length - 1]
    d += ` L ${last.x} ${height}`

    path.setAttribute("d", d)

    // The dash offset is what lets the line draw itself: the whole path is
    // one dash as long as the path, pushed out of view, then pulled back.
    const length = path.getTotalLength()
    path.style.strokeDasharray = `${length}`
    path.style.strokeDashoffset = `${length}`
    return length
  }

  let length = shape()

  /** Draw as much of the line as the reader has scrolled past. */
  let ticking = false
  function update() {
    ticking = false
    const scrollable =
      document.documentElement.scrollHeight - window.innerHeight
    if (scrollable <= 0) return

    // Slightly ahead of the scroll, so the line is arriving rather than
    // trailing behind.
    const through = Math.min(1, (window.scrollY + window.innerHeight * 0.6) /
      document.documentElement.scrollHeight)
    path.style.strokeDashoffset = `${length * (1 - through)}`

    // The page sits at the head of the drawn line, and turns to face the
    // direction the route is going, so it reads as travelling rather than
    // being dragged.
    const at = path.getPointAtLength(length * through)
    const ahead = path.getPointAtLength(Math.min(length, length * through + 12))
    const angle = (Math.atan2(ahead.y - at.y, ahead.x - at.x) * 180) / Math.PI
    marker.setAttribute(
      "transform",
      `translate(${at.x} ${at.y}) rotate(${angle - 90})`,
    )
    marker.style.opacity = through > 0.02 && through < 0.995 ? "1" : "0"
  }

  function onScroll() {
    if (ticking) return
    ticking = true
    requestAnimationFrame(update)
  }

  window.addEventListener("scroll", onScroll, { passive: true })
  window.addEventListener("resize", () => {
    length = shape()
    update()
  }, { passive: true })

  // Wait a frame so the layout has settled before measuring it.
  requestAnimationFrame(() => {
    length = shape()
    update()
  })
}
