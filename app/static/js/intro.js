// The opening sequence.
//
// The order matters and is the whole point:
//   1. a document mark fades in on the dark ground, alone
//   2. it travels up to the corner and lands where the brand icon sits
//   3. the brand plate appears around it, so the mark becomes the logo
//   4. the headline types itself in
//   5. the rest of the page arrives
//
// The mark's landing point is measured from the real brand icon rather than
// guessed, so it lands correctly at any window size.
//
// Skipped for anyone who has asked for less motion, and skipped on repeat
// visits within the session so it never becomes an obstacle.

// Reloading should leave you where you were.
//
// The browser's own restoring is turned off and the position is remembered
// here instead. Its version runs while the opening sequence is still laying
// the page out in stages, so it measures against a page that has not
// finished arriving and lands a few dozen pixels off. Putting it back after
// the layout has settled restores the exact place instead.
//
// Kept per page in sessionStorage, so it lasts for reloads within this tab
// and is gone when the tab closes. A page carrying a #section is left alone,
// since there the position is asked for rather than remembered.
const WHERE = "retropdf-scroll-" + location.pathname

if ("scrollRestoration" in history) {
  history.scrollRestoration = "manual"
}

if (!location.hash) {
  // Saved continuously rather than on unload, which is not reliably reached
  // on a reload or when a tab is closed.
  let saving = null
  window.addEventListener(
    "scroll",
    () => {
      if (saving) return
      saving = setTimeout(() => {
        saving = null
        try {
          sessionStorage.setItem(WHERE, String(Math.round(window.scrollY)))
        } catch {
          // Private browsing can refuse storage. Nothing here needs it.
        }
      }, 150)
    },
    { passive: true },
  )

  restoreScroll()
}

/**
 * Should this arrival put you back where you were?
 *
 * Only for a reload or the back button. Both are a request to return to
 * something, so losing your place is the wrong answer.
 *
 * Following a link is not: clicking the logo, or any other link to a page,
 * asks to start at the top of it, and restoring a remembered position there
 * makes the logo look broken.
 *
 * Treated as a fresh arrival when the browser does not say, since landing at
 * the top is the safer of the two to get wrong.
 */
function shouldRestore() {
  const [entry] = performance.getEntriesByType?.("navigation") ?? []
  return entry?.type === "reload" || entry?.type === "back_forward"
}

/**
 * Put the page back where it was before the reload.
 *
 * Waits for the fonts, because the display face is a different width from
 * its fallback and the page is a different height until it has arrived.
 * Scrolling before then lands somewhere that shifts a moment later.
 */
function restoreScroll() {
  let saved = null
  try {
    saved = sessionStorage.getItem(WHERE)
  } catch {
    return
  }

  const y = Number(saved)
  if (!saved || !Number.isFinite(y) || y <= 0) return

  // Following a link starts at the top, so the remembered place is dropped
  // rather than used. It is cleared as well, or the next reload of this page
  // would jump to a position from before the link was followed.
  if (!shouldRestore()) {
    try {
      sessionStorage.removeItem(WHERE)
    } catch {
      // Storage can be refused. Nothing here depends on it.
    }
    return
  }

  const go = () => {
    // Only as far as the page actually goes, in case it is shorter now.
    const limit = document.documentElement.scrollHeight - window.innerHeight
    window.scrollTo(0, Math.min(y, Math.max(0, limit)))
  }

  if (document.fonts?.ready) document.fonts.ready.then(() => requestAnimationFrame(go))
  else window.addEventListener("load", () => requestAnimationFrame(go), { once: true })
}

// What has been seen this visit.
//
// The full sequence, with the mark falling, is a first impression. It plays
// once, because sitting through it repeatedly would get in the way of
// someone who came here to do a job. The heading typing is shorter and
// still reads well, so it plays once per page.
//
// Two flags in sessionStorage, which is the narrowest thing that survives a
// page load. Worth being precise about what that means, since this is the
// only thing this site keeps anywhere:
//
//   - it never leaves the device, and cannot: connect-src 'none' forbids
//     every outbound request, so there is nothing that could send it
//   - the server never sees it, and has no way to ask for it
//   - it holds no identifier, only what this browser has already watched
//   - it cannot leave the device: connect-src 'none' forbids every outbound
//     request, so there is nothing that could send it
//   - the server never sees it, and has no way to ask for it
//
// A cookie would have been the obvious alternative and is the wrong choice:
// cookies are sent to the server on every request, which is exactly the
// thing this site does not do.

// What this browser has already watched, shared across every tab.
//
// sessionStorage would be the natural home, but it is per tab by design, so
// opening a second tab alongside the first would replay everything. These
// live in localStorage instead and are cleared when the last tab closes.
const SEEN_MAIN = "retropdf-seen-main"
const SEEN_PAGES = "retropdf-seen-pages"

// How many tabs of this site are open right now.
//
// This is what tells "still browsing" apart from "came back later". A
// timestamp cannot: a tab left open for hours looks exactly like a tab
// closed hours ago, so the opening would replay in the middle of a session.
//
// Each tab adds itself on arrival and removes itself on leaving. When the
// count reaches zero the flags are cleared, so the next visit opens properly.
const TAB_COUNT = "retropdf-tabs"

// When the last page left. Paired with the count above, this is what makes a
// reload look like a reload rather than the end of a visit.
const LEFT_AT = "retropdf-left"

// How long a gap still counts as the same visit. Long enough to cover a slow
// page load or a moment spent on another site, short enough that coming back
// later opens properly.
const REJOIN_WINDOW = 20 * 1000

// After this long with nothing leaving, the count of open tabs is treated as
// wrong rather than as a very long visit. Generous enough that a real day of
// work is never interrupted, short enough that a crash does not silence the
// opening for good.
const STALE_AFTER = 12 * 60 * 60 * 1000

// Beyond this the count is not a number of tabs, it is a number that has
// gone wrong. Generous: nobody has this many of one site open at once.
const MAX_PLAUSIBLE_TABS = 12

const wantsLessMotion =
  window.matchMedia("(prefers-reduced-motion: reduce)").matches

/** Read from localStorage, treating a refusal to store as not knowing. */
function recall(key) {
  try {
    return localStorage.getItem(key)
  } catch (error) {
    // Private browsing can refuse storage outright. Playing the sequence
    // again is harmless, so there is nothing to handle.
    return null
  }
}

function note(key, value) {
  try {
    localStorage.setItem(key, value)
  } catch (error) {
    // As above: nothing to do.
  }
}

function forget(key) {
  try {
    localStorage.removeItem(key)
  } catch (error) {
    // As above.
  }
}

/**
 * Join the count of open tabs, and leave it again on the way out.
 *
 * Returns true when this is the first tab, which is what makes the opening
 * play on a genuinely new visit rather than on every tab.
 */
/**
 * Did this page come from the site itself?
 *
 * A reload, the back button, or a link from another page here all count. A
 * tab opened fresh does not, whatever was in the address bar, which is what
 * separates the end of a visit from a page changing under you.
 */
function cameFromHere() {
  const [entry] = performance.getEntriesByType?.("navigation") ?? []
  if (entry?.type === "reload" || entry?.type === "back_forward") return true
  return document.referrer.startsWith(window.location.origin)
}

function joinSession() {
  let open = Number(recall(TAB_COUNT)) || 0
  const leftAt = Number(recall(LEFT_AT)) || 0

  // A count that only ever goes up is a count that has gone wrong.
  //
  // Tabs are removed from it on the way out, but a crash, a killed browser
  // or a machine losing power never gets the chance, so the number is left
  // permanently above zero and the site believes a visit that ended weeks
  // ago is still going. The opening then never plays again.
  //
  // A count that only ever goes up is a count that has gone wrong.
  //
  // Tabs remove themselves on the way out, but a crash, a killed browser or
  // a machine losing power never gets the chance, so the number is left
  // permanently above zero and the site believes a visit that ended weeks
  // ago is still going. The opening then never plays again.
  //
  // Two ways to spot it. Either something left long enough ago that nothing
  // can still be open, or the count has climbed past any number of tabs a
  // person would actually have. A missing leave record is not a symptom: a
  // first visit has none either, and treating that as stale would restart
  // the session on every tab.
  const longSinceAnythingLeft = leftAt && Date.now() - leftAt > STALE_AFTER
  if (open > 0 && (longSinceAnythingLeft || open > MAX_PLAUSIBLE_TABS)) {
    open = 0
  }

  // Reloading and following a link both close the old page before opening
  // the new one, so the count dips to zero for a moment and the end of a
  // visit looks identical to a reload.
  //
  // The browser knows which it was. A reload or a link followed from this
  // site is a navigation with a type, and a tab opened fresh is not, so the
  // count only means "the visit ended" when this page was not reached from
  // the site itself.
  const continuing = open > 0 || (cameFromHere() && Date.now() - leftAt < REJOIN_WINDOW)
  const first = !continuing

  if (first) {
    // Nothing was open and nothing just left, so this is a new visit and
    // last time's flags are stale.
    forget(SEEN_MAIN)
    forget(SEEN_PAGES)
  }

  note(TAB_COUNT, String(Math.max(0, open) + 1))

  // pagehide rather than unload, which is not reliably reached on mobile.
  window.addEventListener("pagehide", (event) => {
    // A page kept alive for the back button has not really gone away.
    if (event.persisted) return
    const now = Number(recall(TAB_COUNT)) || 1
    note(TAB_COUNT, String(Math.max(0, now - 1)))
    note(LEFT_AT, String(Date.now()))
  })

  return first
}

joinSession()

const alreadySeen = recall(SEEN_MAIN) === "1"

// Which pages have already introduced themselves this visit, so a heading
// writes itself once rather than every time you come back to it.
const seenPages = new Set((recall(SEEN_PAGES) || "").split(",").filter(Boolean))
const thisPage = window.location.pathname
const firstTimeOnThisPage = !seenPages.has(thisPage)

if (firstTimeOnThisPage) {
  seenPages.add(thisPage)
  note(SEEN_PAGES, Array.from(seenPages).join(","))
}

const stage = document.querySelector("[data-intro]")
const mark = document.querySelector(".intro-mark svg")
const headline = document.querySelector("[data-type]")

/**
 * Everything that should wait for the heading to be written.
 *
 * That is the rest of the heading's own section, and then the sections
 * following it, so a page whose real content sits in a separate block still
 * holds it back rather than showing it while the heading is mid sentence.
 * Ordered top to bottom, which is the order they arrive in.
 */
const afterHeading = collectAfterHeading()

function collectAfterHeading() {
  if (!headline) return []

  const section = headline.closest("section") || headline.parentElement
  const siblings = Array.from(section.children).filter((el) => el !== headline)

  // Sections below the heading's own, which on a tool page is where the
  // workspace panel lives. Anything marked for the scroll reveal is left
  // out: it appears when you reach it, not as part of the arrival.
  const below = []
  let next = section.nextElementSibling
  while (next) {
    if (next.tagName === "SECTION" && !next.hasAttribute("data-reveal")) {
      below.push(next)
    }
    next = next.nextElementSibling
  }

  return [...siblings, ...below]
}

// Empty the heading before anything paints, so the finished text is never
// briefly visible before the typing starts. The text lives in data-type, so
// nothing is lost for search engines or without scripting.
// Every page writes its own heading, the first time you reach it. That is
// the shorter of the two openings and it belongs to the page rather than to
// the visit, so it plays on the workspace and on each tool as you arrive.
const willType = headline && !wantsLessMotion && firstTimeOnThisPage

if (willType) {
  headline.style.minHeight = `${headline.offsetHeight}px`
  headline.textContent = ""

  // Held back, and set a little low, so they rise into place rather than
  // simply appearing. Movement is what makes it read as settling.
  for (const el of afterHeading) {
    el.style.opacity = "0"
    el.style.transform =
      el.tagName === "SECTION" ? "translateY(20px)" : "translateY(12px)"
  }
}

/**
 * Bring in the lines below the heading, one after another.
 *
 * Each waits a little longer than the last, and the gaps widen slightly as
 * they go, so the group eases to a stop instead of arriving at a fixed
 * rhythm. The fade is slower than the movement, which keeps the text from
 * appearing to snap into position.
 */
function showAfterHeading() {
  // Nothing was hidden, so there is nothing to bring back.
  if (!willType) return

  afterHeading.forEach((el, index) => {
    const delay = 0.06 + index * 0.13
    // A whole section carries more weight than a line of text, so it takes
    // a little longer to settle.
    const isSection = el.tagName === "SECTION"

    el.style.transition =
      `opacity ${isSection ? 0.9 : 0.75}s ease-out ${delay}s, ` +
      `transform ${isSection ? 0.8 : 0.65}s cubic-bezier(0.16, 0.84, 0.32, 1) ${delay}s`
    el.style.opacity = "1"
    el.style.transform = "none"
  })
}

function reveal() {
  document.documentElement.classList.remove("intro-pending")
}

if (!stage || !mark || wantsLessMotion || alreadySeen) {
  reveal()
  document.body.classList.add("intro-done", "intro-skipped")

  if (willType) {
    // Wait for the heading's own section to have risen into place before
    // writing into it, so the two are sequential rather than overlapping.
    setTimeout(() => typeHeadline(showAfterHeading), 320)
  } else {
    // Nothing to wait for: the page simply arrives.
    showAfterHeading()
  }
} else {
  note(SEEN_MAIN, "1")
  run()
}

function run() {
  // The holding classes go on first, so nothing is visible for the frame
  // between revealing the page and the sequence taking over.
  document.body.classList.add("intro-running")
  reveal()

  // Work out where the mark has to travel to before it starts moving. The
  // header is laid out already, it is only transparent, so measuring is safe.
  aimAtBrand()
  window.addEventListener("resize", aimAtBrand)

  // Each step waits for the last to actually finish, rather than starting
  // partway through it. The numbers below are the CSS durations, so the two
  // stay in step if either is changed.
  //
  //   drop      80 + 900   settles at   980
  //   rest                 holds to    1400   a beat of stillness
  //   dock    1400 + 700   lands at    2100
  //   brand   2100 + 450   plate up at 2550
  //   typing  2550         starts as the plate settles
  //   reveal                 once the heading has finished writing

  const DROP_AT = 80
  const DROP_MS = 900
  const REST_MS = 420 // the mark sits still, which is what gives it weight
  const DOCK_MS = 700
  const BRAND_MS = 450

  const dockAt = DROP_AT + DROP_MS + REST_MS
  const brandAt = dockAt + DOCK_MS
  const typeAt = brandAt + BRAND_MS

  // 1. The mark arrives on the dark ground, alone, and rests there.
  setTimeout(() => document.body.classList.add("intro-drop"), DROP_AT)

  // 2. It travels to the corner and lands on the brand icon's position.
  setTimeout(() => document.body.classList.add("intro-dock"), dockAt)

  // 3. The brand plate fades up around the landed mark, so the mark becomes
  //    the logo rather than disappearing and being replaced.
  setTimeout(() => document.body.classList.add("intro-brand"), brandAt)

  // 4. The heading appears, empty, and types itself in. The rest of the
  //    page waits for it, so the line is finished before anything else
  //    arrives rather than the two competing for attention.
  setTimeout(() => {
    document.body.classList.add("intro-typing")
    typeHeadline(finish)
  }, typeAt)

  function finish() {
    // 5. Everything else arrives, once the heading has been written.
    showAfterHeading()
    document.body.classList.add("intro-reveal")

    setTimeout(() => {
      document.body.classList.add("intro-done")
      document.body.classList.remove(
        "intro-running", "intro-drop", "intro-dock", "intro-brand",
        "intro-typing", "intro-reveal",
      )
      window.removeEventListener("resize", aimAtBrand)
    }, 900)
  }
}

/**
 * Point the falling mark at its slot in the logo.
 *
 * The mark starts centred in the window, so the distance it must travel is
 * measured live rather than assumed. Aiming at the slot rather than at the
 * plate means it lands exactly where the logo's mark rests, which is also
 * where the scrolling mark sets off from.
 */
function aimAtBrand() {
  const brandIcon = document.querySelector("#brand-slot")
  if (!brandIcon) return

  // Measure the mark at its resting size, ignoring any transform in flight.
  const previous = mark.style.transform
  mark.style.transform = "none"
  const from = mark.getBoundingClientRect()
  mark.style.transform = previous

  const to = brandIcon.getBoundingClientRect()

  const dx = to.left + to.width / 2 - (from.left + from.width / 2)
  const dy = to.top + to.height / 2 - (from.top + from.height / 2)
  const scale = to.width / (from.width || 1)

  mark.style.setProperty("--dock-x", `${dx}px`)
  mark.style.setProperty("--dock-y", `${dy}px`)
  mark.style.setProperty("--dock-scale", String(scale))
}

/**
 * Type the headline in.
 *
 * The finished text lives in data-type, so it is in the markup for search
 * engines and for anyone with scripting off.
 */
function typeHeadline(onDone) {
  if (!willType || headline.dataset.typed === "1") {
    onDone?.()
    return
  }

  headline.dataset.typed = "1"
  const text = headline.dataset.type

  headline.textContent = ""
  headline.classList.add("typing")

  let shown = 0
  const step = () => {
    shown += 1
    headline.textContent = text.slice(0, shown)
    if (shown < text.length) {
      setTimeout(step, 22)
    } else {
      setTimeout(() => {
        headline.classList.remove("typing")
        headline.style.minHeight = ""
      }, 120)
      // A beat on the finished line before anything follows, long enough
      // to register as a pause rather than a stutter.
      setTimeout(() => onDone?.(), 420)
    }
  }
  step()
}
