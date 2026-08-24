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

  // The slot in the brand plate is where the mark rests. The plate has no
  // mark of its own once the route is running: the travelling element is it,
  // parked, so scrolling moves the same object rather than swapping one copy
  // for another.
  const plate = document.querySelector("#brand-plate")
  const slot = document.querySelector("#brand-slot")

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

  // The mark starts parked, which is the slot's own copy showing. The
  // travelling one takes over as soon as it has cleared the plate.

  // Squares already dropped, keyed by how far down the page they were laid,
  // so the same spot is never marked twice.
  const laid = new Map()

  const DOT = 6 // square size, matched to the stepped edges of the font
  const STEP = 14 // how far the mark moves between squares

  // Also measured once, for the same reason: the brand plate is sticky, so
  // its viewport position is the same at every scroll offset but its page
  // position is not, and the origin has to be a fixed point on the page.
  let cachedOrigin = null


  /**
   * Where the mark rests: its slot in the logo.
   *
   * This is both the start of the route and the mark's home position, so it
   * has to be exact. Anything off shows as the logo sitting crooked.
   */
  function origin() {
    if (cachedOrigin) return cachedOrigin
    if (!slot) return { x: 60, y: 0 }

    // Measured against the plate's own offset position rather than the
    // scroll. The plate is sticky, so its viewport position is wherever the
    // scroll has parked it: adding scrollY to that would put the origin
    // thousands of pixels down when measured after scrolling.
    //
    // The icon is an SVG element, which has no offsetTop of its own, so its
    // place inside the plate is taken from the difference between the two
    // rectangles. That difference is unaffected by scrolling, since both
    // move together.
    // The plate is sticky, so its viewport position is wherever the scroll
    // has parked it. Adding scrollY to that would put the origin thousands
    // of pixels down when measured after scrolling, so the plate's place on
    // the page comes from its offsets instead.
    //
    // offsetLeft and offsetTop are each relative to the nearest positioned
    // ancestor, so they are summed up the chain to reach the page.
    let plateX = 0
    let plateY = 0
    for (let el = plate; el; el = el.offsetParent) {
      plateX += el.offsetLeft
      plateY += el.offsetTop
    }

    // Where the slot sits inside the plate, taken as the difference between
    // the two rectangles. Both move together with the scroll, so their
    // difference does not change.
    const slotBox = slot.getBoundingClientRect()
    const plateBox = plate.getBoundingClientRect()

    cachedOrigin = {
      x: plateX + (slotBox.left - plateBox.left) + slotBox.width / 2,
      y: plateY + (slotBox.top - plateBox.top) + slotBox.height / 2,
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
    //
    // Its length is set by how far there is to move sideways rather than
    // being a fixed number. A wide screen puts the lane a long way from the
    // logo, and covering that in a short drop is what made the opening look
    // like a diagonal slash. Roughly two units down per unit across keeps
    // the steepest part of the curve gentle at any width.
    const across = Math.abs(lane.left - from.x)
    const settle = Math.min(620, Math.max(320, across * 2.2))
    const travelled = y - from.y

    if (travelled < settle) {
      const into = Math.max(0, travelled) / settle
      // An S curve: it leaves the logo straight down, bends across the
      // middle of the stretch, and arrives at the lane straight down again.
      // A squared ease starts flat but arrives at an angle, which is what
      // made the join look like a corner.
      const eased = (1 - Math.cos(into * Math.PI)) / 2
      return { x: from.x + (lane.left - from.x) * eased, y }
    }

    // Then the route runs down one lane, and stays there.
    //
    // It does not switch sides. Getting from one lane to the other means
    // crossing the middle of the page, which on a wide screen is exactly
    // where the content sits: either the line goes through the text, or it
    // jumps and the trail appears out of nowhere. Neither is worth the
    // variety, so it holds one side and simply descends.
    //
    // A slight sway keeps it from being ruler straight, small enough that it
    // never reaches the content.
    const sway = Math.sin((travelled - settle) / 260) * 18

    return { x: lane.left + sway, y }
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

    // The mark moves with the scroll, one pixel for one pixel, starting from
    // its slot in the logo.
    //
    // It used to be placed at a fixed depth in the window instead, which
    // meant it had to cover that depth on top of the scroll: going down it
    // lagged behind the page, and coming back up it raced ahead to catch
    // its resting place. Tying it directly to distance scrolled makes it
    // behave the same in both directions, because there is nothing to catch
    // up on.
    const y = from.y + window.scrollY

    const here = positionAt(y)
    mark.style.transform = "translate(" + here.x + "px, " + here.y + "px)"

    // Exactly one mark is ever visible. While parked it is the slot's own,
    // because the route layer is painted behind the header and a mark
    // sitting in the plate would be hidden by it. Once the travelling mark
    // has cleared the plate it is in open page and takes over.
    //
    // The two occupy the same spot, so the changeover happens where they
    // overlap and reads as the one object moving off.
    const clear = here.y - from.y > 30
    mark.style.visibility = clear ? "visible" : "hidden"
    slot?.classList.toggle("handed-over", clear)

    // Lay squares for every step between the logo and here that is not
    // already marked. They come from the same function that places the mark,
    // so the trail is exactly the path it took.
    //
    // The loop always starts at the logo, so arriving partway down the page,
    // which happens when a link carries a #section, fills in everything
    // above rather than leaving the trail starting in mid air.
    // Collected into a fragment and appended once. A jump from a nav link
    // can ask for several hundred squares in a single frame, and appending
    // them one at a time makes the browser recalculate layout for each,
    // which is what made those jumps stutter.
    const batch = document.createDocumentFragment()

    for (let at = from.y; at <= y; at += STEP) {
      const key = Math.round(at / STEP)
      if (laid.has(key)) continue

      const point = positionAt(at)
      const dot = document.createElement("span")
      dot.className = "route-dot lit"
      dot.style.left = point.x - DOT / 2 + "px"
      dot.style.top = point.y - DOT / 2 + "px"
      batch.append(dot)
      laid.set(key, dot)
    }

    if (batch.childNodes.length) trail.append(batch)
  }

  function onScroll() {
    if (ticking) return
    ticking = true
    requestAnimationFrame(update)
  }

  window.addEventListener("scroll", onScroll, { passive: true })

  // Returning with the back button restores the scroll position without a
  // scroll event, so the trail would be missing until something moved.
  window.addEventListener("pageshow", () => {
    cachedOrigin = null
    cachedLanes = null
    trail.replaceChildren()
    laid.clear()
    requestAnimationFrame(update)
  })

  window.addEventListener(
    "resize",
    () => {
      // The lanes move with the layout, so an old trail would no longer match
      // the path. Clearing it lets the route be laid again as you scroll.
      trail.replaceChildren()
      laid.clear()
      cachedLanes = null
      cachedOrigin = null

      // Narrowed past the cutoff there is no room beside the content, so the
      // mark stops travelling and the logo takes its own mark back.
      if (window.innerWidth < NARROWEST) {
        mark.style.display = "none"
        slot?.classList.remove("handed-over")
        return
      }

      mark.style.display = ""
      update()
    },
    { passive: true },
  )

  requestAnimationFrame(update)
}
