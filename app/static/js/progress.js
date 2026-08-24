// The mark travels down the page, leaving a trail where it has been.
//
// It is the same document mark that falls during the opening sequence and
// settles into the logo. From there it sets off, drifting gently left and
// right as it descends.
//
// The mark's position is the single source of truth: the trail is simply a
// record of where it has already been. Drawing a path and then placing the
// mark on it separately is what made the two disagree, with the mark cutting
// corners and falling behind on long runs.
//
// Purely decorative: behind the content, never intercepts the scroll, and
// hidden from screen readers.

const wantsLessMotion =
  window.matchMedia("(prefers-reduced-motion: reduce)").matches

// Below this the content fills the screen and there is no clear space beside
// it. A line through the words is worse than no line.
const NARROWEST = 700

if (!wantsLessMotion) waitThenStart()

/**
 * Hold off until the opening sequence has finished.
 *
 * Laying a trail while the page is still arriving would put a line on screen
 * before the heading it is meant to follow.
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
  if (window.innerWidth < NARROWEST) return

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

  // Squares already dropped, keyed by how far down the page they were laid,
  // so the same spot is never marked twice.
  const laid = new Map()

  const DOT = 6 // square size, matched to the stepped edges of the font
  const STEP = 14 // how far the mark moves between squares

  // Also measured once, for the same reason: the brand plate is sticky, so
  // its viewport position is the same at every scroll offset but its page
  // position is not, and the origin has to be a fixed point on the page.
  let cachedOrigin = null

  /** Where the mark sets off from: the icon in the brand plate. */
  function origin() {
    if (cachedOrigin) return cachedOrigin

    const icon = document.querySelector("#brand-plate svg")
    if (!icon) return { x: 60, y: 0 }

    const box = icon.getBoundingClientRect()
    cachedOrigin = {
      x: box.left + window.scrollX + box.width / 2,
      y: box.top + window.scrollY + box.height / 2,
    }
    return cachedOrigin
  }

  // Measured once and reused. getBoundingClientRect reports positions
  // relative to the viewport, so measuring on every call returns different
  // answers as the page scrolls. The route would then be laid in a slightly
  // different place each time, leaving the gaps and wobble that made the
  // trail look broken.
  let cachedLanes = null

  /** The clear space either side of the content, measured rather than assumed. */
  function lanes() {
    if (cachedLanes) return cachedLanes

    let contentLeft = window.innerWidth
    let contentRight = 0

    for (const el of document.querySelectorAll(".wrap h1, .wrap p, .wrap .tools")) {
      const box = el.getBoundingClientRect()
      if (box.width < 4) continue
      contentLeft = Math.min(contentLeft, box.left)
      contentRight = Math.max(contentRight, box.right)
    }

    // The content stops widening past a point, so a wide screen has hundreds
    // of pixels of clear space and a narrow one has almost none. Measuring
    // beats taking a percentage of the window, which lands the route in open
    // space on one screen and through the text on another.
    cachedLanes = {
      left: Math.max(18, Math.min(contentLeft - 18, contentLeft / 2)),
      right: Math.min(
        window.innerWidth - 18,
        Math.max(contentRight + 18, (contentRight + window.innerWidth) / 2),
      ),
    }
    return cachedLanes
  }

  /**
   * Where the mark is when it has descended this far down the page.
   *
   * This function is the whole route. The mark is placed by it and the trail
   * is drawn from it, so the two can never disagree.
   *
   * The path drifts side to side as it descends, staying in the clear space
   * beside the content. A slow wave rather than hard corners: there are no
   * long horizontal crossings to fall behind on, and no stubs left at turns.
   */
  function positionAt(y) {
    const from = origin()
    const lane = lanes()

    // The first stretch leads away from the logo, so the mark visibly leaves
    // it rather than appearing somewhere else on the page.
    const settle = 260
    const travelled = y - from.y

    if (travelled < settle) {
      const into = Math.max(0, travelled) / settle
      // Eased, so it pulls away gently rather than shooting off.
      return { x: from.x + (lane.left - from.x) * (into * into), y }
    }

    // Then the route stays in one lane for a stretch before switching to
    // the other, drifting a little within the lane as it goes.
    //
    // It never travels between the lanes. Anything that crosses the middle
    // of a wide screen passes straight through the content, and no amount of
    // shaping a wave avoids that: the middle is where the text is.
    const stretch = window.innerHeight * 1.6
    const leg = Math.floor((travelled - settle) / stretch)
    const along = ((travelled - settle) % stretch) / stretch

    const side = leg % 2 === 0 ? lane.left : lane.right

    // A gentle sway within the lane, so the line breathes rather than being
    // ruler straight. Small enough that it never reaches the content.
    const sway = Math.sin(along * Math.PI * 2) * 26
    const inward = leg % 2 === 0 ? 1 : -1

    return { x: side + sway * inward, y }
  }

  /**
   * Move the mark to wherever the scroll has taken it, dropping squares for
   * any part of the route it has passed but not yet marked.
   */
  let ticking = false
  function update() {
    ticking = false

    const scrollable =
      document.documentElement.scrollHeight - window.innerHeight
    if (scrollable <= 0) return

    const from = origin()

    // The mark keeps pace with the reader: a quarter of the way down the
    // window near the top of the page, drifting to about two thirds by the
    // bottom, so it travels alongside what is being read rather than sitting
    // in a corner.
    const through = Math.min(1, Math.max(0, window.scrollY / scrollable))
    const band = 0.25 + through * 0.35
    const y = Math.max(from.y, window.scrollY + window.innerHeight * band)

    const here = positionAt(y)
    mark.style.transform = "translate(" + here.x + "px, " + here.y + "px)"
    mark.style.opacity = window.scrollY > 4 ? "1" : "0"

    // Lay squares for every step between the logo and here that is not
    // already marked. They come from the same function that places the mark,
    // so the trail is exactly the path it took.
    for (let at = from.y; at <= y; at += STEP) {
      const key = Math.round(at / STEP)
      if (laid.has(key)) continue

      const point = positionAt(at)
      const dot = document.createElement("span")
      dot.className = "route-dot lit"
      dot.style.left = point.x - DOT / 2 + "px"
      dot.style.top = point.y - DOT / 2 + "px"
      trail.append(dot)
      laid.set(key, dot)
    }
  }

  function onScroll() {
    if (ticking) return
    ticking = true
    requestAnimationFrame(update)
  }

  window.addEventListener("scroll", onScroll, { passive: true })

  window.addEventListener(
    "resize",
    () => {
      // The lanes move with the layout, so an old trail would no longer match
      // the path. Clearing it lets the route be laid again as you scroll.
      trail.replaceChildren()
      laid.clear()
      cachedLanes = null
      cachedOrigin = null

      if (window.innerWidth < NARROWEST) {
        mark.style.opacity = "0"
        return
      }
      update()
    },
    { passive: true },
  )

  requestAnimationFrame(update)
}
