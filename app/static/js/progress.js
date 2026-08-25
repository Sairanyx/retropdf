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
//
// A first check only. The window being wide enough does not prove there is
// room beside the text, since zooming in grows the content without changing
// the window, so the real test is roomBeside() below.
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

  // The mark is the logo's own, not a copy of it. Scrolling moves this very
  // element out of the plate and down the page, so there is never a moment
  // where one disappears and another appears somewhere else.
  const plate = document.querySelector("#brand-plate")
  const slot = document.querySelector("#brand-slot")
  const mark = slot?.querySelector("svg")
  if (!plate || !slot || !mark) return

  const layer = document.createElement("div")
  layer.className = "route"
  layer.setAttribute("aria-hidden", "true")

  const trail = document.createElement("div")
  trail.className = "route-trail"
  layer.append(trail)

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

  // Far enough from the text that the line is beside it rather than grazing
  // it. The clearance has to cover the sway, which carries the trail 18
  // pixels either side of the lane, and the square's own width, or the widest
  // part of the swing ends up a few pixels from the words.
  const CLEAR = 18 + 18 + DOT

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
      // How much clear space there actually is to the left of the text. The
      // lane below is clamped to a minimum so the line stays on screen, and
      // that clamp is what would push it over the words, so the true gap is
      // kept separately for roomBeside() to judge.
      gap: contentLeft,
      left: Math.max(18, Math.min(contentLeft - CLEAR, contentLeft / 2)),
      right: Math.min(
        window.innerWidth - 18,
        Math.max(contentRight + 18, (contentRight + window.innerWidth) / 2),
      ),
    }
    return cachedLanes
  }

  /**
   * Whether there is genuinely room for the line beside the text.
   *
   * The window being wide is not the same question. Zooming in grows the
   * text without changing the window, so a zoomed page can be 1200 pixels
   * wide with the words running to both edges, and a trail drawn there goes
   * straight through them. Asking the measured gap covers both, since a
   * narrow window and a zoomed one leave the same lack of space.
   */
  function roomBeside() {
    return lanes().gap >= CLEAR + DOT
  }

  // Measured once, like the origin, and for the same reason: the answer must
  // not change as the page scrolls.
  let cachedEnd = null

  /**
   * Where the mark is going: the slot in the logo at the foot of the page.
   *
   * The journey has two ends rather than one. It sets off from the logo in
   * the header and arrives at the logo in the footer, so the trail lands
   * somewhere rather than stopping at whatever fraction of the page the
   * scroll happened to reach.
   */
  function destination() {
    if (cachedEnd !== null) return cachedEnd

    const slot = document.querySelector("#brand-end")
    if (!slot) {
      // No footer logo on this page. Ending a little short of the bottom
      // keeps the mark on screen rather than parked under the fold.
      cachedEnd =
        document.documentElement.scrollHeight - window.innerHeight * 0.4
      return cachedEnd
    }

    // Offsets rather than a rectangle, so the answer is the slot's place on
    // the page and not wherever the current scroll has put it on screen.
    let y = slot.offsetHeight / 2
    for (let el = slot; el; el = el.offsetParent) y += el.offsetTop
    cachedEnd = y
    return cachedEnd
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

    const inLane = lane.left + sway

    // Except at the very end, where it curves across to the logo waiting in
    // the footer.
    //
    // Crossing the page anywhere else puts the trail through the text, which
    // is why the route holds one side for its whole descent. Down here there
    // is no text to cross: the footer is the last thing on the page and the
    // space beside it is empty, so the mark can come home.
    const finish = destination()
    const slot = document.querySelector("#brand-end")

    if (slot) {
      let slotX = slot.offsetWidth / 2
      for (let el = slot; el; el = el.offsetParent) slotX += el.offsetLeft

      // The run in is as long as the distance it has to cover sideways,
      // rather than a fixed number of pixels. A short fixed stretch turns a
      // wide crossing into a diagonal with a corner at each end, which is
      // what made the arrival look sharp on a wide screen. Two units down
      // per unit across keeps it gentle, the same ratio the mark uses
      // leaving the logo at the top.
      const homeRun = Math.max(320, Math.abs(slotX - inLane) * 2.2)

      if (y > finish - homeRun) {
        // The crossing finishes a little before the descent does, so the
        // last stretch comes straight down into the slot rather than
        // arriving diagonally and clipping the corner of the plate.
        const into = Math.min(1, (y - (finish - homeRun)) / homeRun)
        const crossing = Math.min(1, into / 0.82)
        const eased = (1 - Math.cos(crossing * Math.PI)) / 2
        return { x: inLane + (slotX - inLane) * eased, y }
      }
    }

    return { x: inLane, y }
  }

  /**
   * Move the mark to wherever the scroll has taken it, dropping squares for
   * any part of the route it has passed but not yet marked.
   */
  let ticking = false
  function update() {
    ticking = false

    // No room beside the text, so there is nowhere to draw. The mark goes
    // back into the logo and the trail is cleared rather than left lying
    // across the words. Zooming far enough in reaches this on any screen.
    if (!roomBeside()) {
      layer.hidden = true
      trail.replaceChildren()
      laid.clear()
      slot.classList.remove("travelling")
      mark.style.transform = ""
      return
    }
    layer.hidden = false

    const from = origin()

    // The journey is over when the logo at the foot of the page is on screen,
    // which is not the same as the scroll having bottomed out. Anything below
    // the footer, a margin or a page that simply runs on, would otherwise be
    // scroll the mark still has to cover, and it would hang above the logo
    // until the very last pixel.
    const scrollable = Math.min(
      document.documentElement.scrollHeight - window.innerHeight,
      Math.max(0, destination() - window.innerHeight * 0.72),
    )
    if (scrollable <= 0) return

    // The whole scroll maps onto the whole route: at the top the mark is in
    // its slot, at the bottom it is at the end of the page. Everything in
    // between is proportional, so it arrives exactly when the reader does.
    //
    // Moving it one pixel per pixel scrolled instead leaves it pinned near
    // the top of the window, since scrolling already moves the page under
    // it, and it never reaches the end. Placing it at a fixed depth in the
    // window has the opposite fault: it has to cover that depth on top of
    // the scroll, so it drags going down and races coming back up.
    const through = Math.min(1, Math.max(0, window.scrollY / scrollable))
    const y = from.y + (destination() - from.y) * through

    const here = positionAt(y)

    // At the very top the mark is left exactly as the layout placed it, so
    // the logo is untouched and cannot drift by a pixel. Any scroll at all
    // lifts it out and it is positioned by hand from there.
    if (here.y <= from.y + 0.5) {
      slot.classList.remove("travelling")
      mark.style.transform = ""
      return
    }

    // Once it has arrived it is a logo again rather than something in
    // flight, so it stops answering the pointer. The mark is only clickable
    // while it is out on the page between the two logos, which is where it
    // reads as a thing you could send back to the top. Sitting inside either
    // plate it is simply the icon in the logo, and the plate around it is
    // the link.
    // "travelling" keeps the mark positioned by hand rather than by the
    // layout, so it stays on the whole way down. "arrived" is separate and
    // only says whether it is sitting in the logo at the foot of the page,
    // where it stops answering the pointer.
    slot.classList.add("travelling")
    slot.classList.toggle("arrived", here.y >= destination() - 0.5)

    // Page coordinates, used directly: the mark is positioned against the
    // page like its trail is. The offsets centre the shape on the point,
    // since the transform places its top left corner.
    mark.style.transform =
      "translate(" + (here.x - 11) + "px, " + (here.y - 13) + "px)"

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

    // The route can change under a trail that has already been laid: opening
    // files makes the page longer, clearing them makes it shorter, and the
    // curve into the footer moves with it. A square placed once and left
    // there ends up on a path that no longer exists, which is what split the
    // line into two disconnected halves.
    //
    // So every square is moved to where the current route puts it, rather
    // than only the new ones being placed. Setting a style that has not
    // changed costs nothing, and it means the trail is always the route
    // rather than a record of every route there has ever been.
    for (let at = from.y; at <= y; at += STEP) {
      const key = Math.round(at / STEP)
      const point = positionAt(at)

      let dot = laid.get(key)
      if (!dot) {
        dot = document.createElement("span")
        dot.className = "route-dot lit"
        batch.append(dot)
        laid.set(key, dot)
      }

      dot.style.left = point.x - DOT / 2 + "px"
      dot.style.top = point.y - DOT / 2 + "px"
    }

    // Squares below the mark are on the current route too, and they are the
    // ones the loop above never reaches. Opening files makes the page longer,
    // which moves the mark back up the journey while everything already laid
    // stays where it was, so the old curve is left behind under the new one
    // and the trail appears to fork.
    for (const [key, dot] of laid) {
      const at = key * STEP
      if (at <= y) continue
      const point = positionAt(at)
      dot.style.left = point.x - DOT / 2 + "px"
      dot.style.top = point.y - DOT / 2 + "px"
    }

    // The steps rarely land exactly on the end, so the last one falls short
    // by up to a full step and the trail appears to stop beside the logo
    // rather than reaching it. This closes that gap.
    const finish = destination()
    if (y >= finish - STEP) {
      const key = Math.round(finish / STEP) + 1
      if (!laid.has(key)) {
        const point = positionAt(finish)
        const dot = document.createElement("span")
        dot.className = "route-dot lit"
        dot.style.left = point.x - DOT / 2 + "px"
        dot.style.top = point.y - DOT / 2 + "px"
        batch.append(dot)
        laid.set(key, dot)
      }
    }

    // Squares below the end of the page belong to a route that no longer
    // exists, so they are taken away rather than left hanging past the logo.
    //
    // Measured against the end of the page rather than against the mark:
    // scrolling back up moves the mark without changing the route, and
    // clearing everything below it there would wipe the trail you have just
    // made, which is the record of where you have been.
    const end = destination()
    for (const [key, dot] of laid) {
      if (key * STEP > end + STEP) {
        dot.remove()
        laid.delete(key)
      }
    }

    if (batch.childNodes.length) trail.append(batch)


  }

  /**
   * Redraw the piece of trail that hangs from the plate.
   *
   * It runs from the slot in the logo down to the mark, in window
   * coordinates, so it stays attached to the sticky plate. Once the mark is
   * far enough down that the laid trail has caught up, there is nothing left
   * for it to bridge and it is left empty.
   */


  function onScroll() {
    if (ticking) return
    ticking = true
    requestAnimationFrame(update)
  }

  window.addEventListener("scroll", onScroll, { passive: true })

  // The page grows and shrinks while you work: opening files fills the
  // panel, switching tools shows and hides its options, and the footer moves
  // down with all of it. The measurements are taken once and kept, so
  // without this the mark still travels to wherever the footer was when the
  // page first loaded and stops short of it now.
  //
  // Watching the height rather than any particular control means it holds
  // for anything that changes the layout, including whatever gets added
  // later.
  let settleTimer = null
  let lastHeight = document.documentElement.scrollHeight
  const watchHeight = new ResizeObserver(() => {
    const now = document.documentElement.scrollHeight
    if (now === lastHeight) return

    // Compared before the new height is recorded, or every change looks
    // like a shrink.
    const grew = now > lastHeight
    lastHeight = now

    // Only the destination moves. The origin is the logo at the top, which
    // has not gone anywhere, and the lanes follow the content width rather
    // than the height, so neither needs measuring again.
    cachedEnd = null

    if (grew) {
      // A longer page keeps its trail. Every square already laid is still
      // somewhere the mark has been, and only the stretch below them is new.
      // Clearing here would make the whole line vanish and redraw, which
      // reads as the mark jumping even though it has not moved.
      requestAnimationFrame(update)
      return
    }

    // A shorter page cannot. Clearing files or switching to a tool with
    // fewer options brings the footer up, and squares laid for the old
    // longer route are now below the logo, so the trail runs straight past
    // it and off the end of the page. Those have to go.
    //
    // Faded out rather than removed on the spot: the line vanishing between
    // one frame and the next is the harsher of the two, and the mark is left
    // hanging with nothing behind it. The old squares dim while the new ones
    // are laid over them.
    const old = [...trail.children]
    for (const dot of old) dot.classList.remove("lit")
    setTimeout(() => {
      for (const dot of old) dot.remove()
    }, 400)

    // A shorter page moves the mark without the reader touching anything,
    // sometimes the length of the page, so the move is eased for as long as
    // it takes rather than happening between two frames.
    slot.classList.add("settling")
    clearTimeout(settleTimer)
    settleTimer = setTimeout(() => slot.classList.remove("settling"), 500)

    laid.clear()
    requestAnimationFrame(update)
  })
  watchHeight.observe(document.body)

  // The page is a different height once the display face has arrived, since
  // it is a different width from the fallback it replaces. Anything measured
  // before that is measured against a page that has since moved, which on a
  // reload at the foot of the page left the mark a little short of the logo
  // with nothing to prompt another look.
  if (document.fonts?.ready) {
    document.fonts.ready.then(remeasure)
  }

  /** Take every measurement again and redraw from scratch. */
  function remeasure() {
    cachedOrigin = null
    cachedLanes = null
    cachedEnd = null
    lastHeight = document.documentElement.scrollHeight
    requestAnimationFrame(update)
  }

  // Reloading restores the scroll position after the page has settled, which
  // is after the route has already been worked out and drawn once. Nothing
  // else runs afterwards, so a reload at the foot of the page left the mark
  // short of the logo until something moved.
  //
  // A few passes over the first couple of seconds covers it: the fonts
  // arriving, the scroll being put back, and the layout settling all land in
  // that window, and each one can move where the logo sits.
  for (const delay of [200, 600, 1200, 2000]) {
    setTimeout(remeasure, delay)
  }

  // Returning with the back button restores the scroll position without a
  // scroll event, so the trail would be missing until something moved.
  window.addEventListener("pageshow", () => {
    cachedOrigin = null
    cachedLanes = null
    cachedEnd = null
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
      cachedEnd = null

      // Narrowed past the cutoff there is no room beside the content, so the
      // mark stops travelling and the logo takes its own mark back.
      // Narrowed past the cutoff there is no clear space beside the content,
      // so the mark goes back to being just the logo's icon.
      if (window.innerWidth < NARROWEST) {
        slot.classList.remove("travelling")
        mark.style.transform = ""
        return
      }

      update()
    },
    { passive: true },
  )

  requestAnimationFrame(update)
}
