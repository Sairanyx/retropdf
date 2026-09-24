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
// Two storages, because neither alone answers the question.
//
// The flag has to be shared between tabs, so opening a second one does not
// replay everything. That is localStorage, which every tab sees.
//
// It also has to be forgotten when the browser closes, so coming back
// tomorrow opens properly. localStorage never forgets, but sessionStorage
// does: the browser clears it on quit and keeps it while it is open. So a
// mark is kept in both, and the shared flag is trusted only while this tab
// can still see a session mark of its own.
//
// A new tab has no session mark, and writes one. Whether it also replays the
// opening depends on the shared flag, which the first tab already set: the
// browser is still open, so nothing replays. Quit the browser and every
// session mark goes with it, which is what clears the shared flag.
const SEEN_MAIN = "retropdf-seen-main"
const SEEN_PAGES = "retropdf-seen-pages"

// This tab's own name, kept in sessionStorage so the browser discards it on
// quit. A tab arriving without one has never been here.
const SESSION = "retropdf-session"

// The shared list of tabs currently open, and how a claim ages.
//
// The gap between refreshing and expiring is generous: a tab working through
// a large PDF must never be mistaken for one that has closed.
const CLAIMS = "retropdf-tabs"
const CLAIM_EVERY = 4 * 1000
const CLAIM_STALE = 30 * 1000

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
 * Whether any other tab of this site is already open.
 *
 * This is what tells "still browsing" from "came back later", and it needs
 * both storages because neither answers it alone. localStorage is shared
 * between tabs but never forgets. sessionStorage forgets when the browser
 * quits but is private to one tab.
 *
 * So each tab claims a slot in a shared list and lets go of it on the way
 * out. An empty list means nothing else is here, which is a new visit.
 *
 * A tab that dies without warning cannot let go, so every claim carries the
 * time it was made and stale ones are dropped on sight. The window is long
 * enough that a tab busy with a large PDF is never mistaken for a dead one,
 * and the claim is refreshed while the tab lives, so only a tab that has
 * genuinely gone ages out.
 */
function otherTabsOpen() {
  let mine = null
  try {
    mine = sessionStorage.getItem(SESSION)
  } catch (error) {
    // Storage refused, which private browsing does. The opening plays more
    // often than it might, which is the harmless way to be wrong.
    return false
  }

  const claims = readClaims()
  const now = Date.now()

  // Everything heard from recently, this tab's own claim aside.
  const others = Object.entries(claims).filter(
    ([id, at]) => id !== mine && now - at < CLAIM_STALE,
  )

  if (!mine) {
    // A tab with no claim of its own: either the first of a visit or the
    // first after the browser was quit. Both look the same from here, and
    // both are told apart by whether anyone else is present.
    mine = String(Math.random()).slice(2)
    try {
      sessionStorage.setItem(SESSION, mine)
    } catch (error) {
      return false
    }

    if (others.length === 0) {
      // Nobody else. Whatever is left belongs to a visit that has ended.
      forget(SEEN_MAIN)
      forget(SEEN_PAGES)
    }
  }

  // Claim a slot and keep it fresh for as long as this tab is here.
  const hold = () => {
    const current = readClaims()
    current[mine] = Date.now()
    for (const [id, at] of Object.entries(current)) {
      if (Date.now() - at > CLAIM_STALE) delete current[id]
    }
    note(CLAIMS, JSON.stringify(current))
  }

  hold()
  const holding = setInterval(hold, CLAIM_EVERY)

  // Let go on the way out, so the last tab to close ends the visit at once
  // rather than after the stale window.
  window.addEventListener("pagehide", (event) => {
    // A page kept alive for the back button has not really gone.
    if (event.persisted) return
    clearInterval(holding)
    const current = readClaims()
    delete current[mine]
    note(CLAIMS, JSON.stringify(current))
  })

  return others.length > 0
}

/** Every tab's claim, or nothing if they cannot be read. */
function readClaims() {
  try {
    const raw = recall(CLAIMS)
    const parsed = raw ? JSON.parse(raw) : {}
    return parsed && typeof parsed === "object" ? parsed : {}
  } catch {
    return {}
  }
}

otherTabsOpen()

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
 * Where the browser breaks the finished heading.
 *
 * Asked rather than guessed. The text is put into the heading itself and
 * every word is measured in place, so the answer comes from the real font at
 * the real width. A word that sits lower than the one before it started a
 * new row.
 *
 * Returns the lines as arrays of words. A single row comes back as one line,
 * which is the common case on a wide screen and needs no breaks at all.
 */
function splitIntoLines(text) {
  const words = text.split(" ")
  if (words.length < 2) return [words]

  // Each word wrapped, so its position can be read back. The heading is
  // already empty and invisible at this point, so nothing of this shows.
  const was = headline.textContent
  headline.textContent = ""
  const spans = words.map((word, index) => {
    const span = document.createElement("span")
    span.textContent = index === 0 ? word : " " + word
    headline.append(span)
    return span
  })

  const lines = []
  let current = []
  let rowTop = null
  spans.forEach((span, index) => {
    // Rounded, since a taller glyph on the same row can shift the box by a
    // fraction of a pixel without it being a new line.
    const top = Math.round(span.getBoundingClientRect().top)
    if (rowTop === null) rowTop = top
    if (top > rowTop + 2) {
      lines.push(current)
      current = []
      rowTop = top
    }
    current.push(words[index])
  })
  if (current.length) lines.push(current)

  headline.textContent = was
  return lines
}

/**
 * The first so many characters, with the line breaks put back in.
 *
 * The count runs over the text as one string, so this walks the lines
 * spending it as it goes and stops wherever it runs out.
 */
function withBreaks(lines, count) {
  let left = count
  const out = []

  for (const words of lines) {
    const line = words.join(" ")
    if (left <= 0) break
    out.push(line.slice(0, left))
    // The space that joined this line to the next is spent as well, or the
    // count drifts by one character per line.
    left -= line.length + 1
  }

  return out.join("\n")
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

  // Typed with the line breaks already decided, so each row is written and
  // then left alone. Letting the browser wrap a growing string instead
  // fills the first row to the edge and then throws a word down to the
  // second, and the whole heading jumps as it goes.
  const lines = splitIntoLines(text)

  headline.textContent = ""
  headline.classList.add("typing")

  let shown = 0
  const step = () => {
    shown += 1
    headline.textContent = withBreaks(lines, shown)
    if (shown < text.length) {
      setTimeout(step, 22)
    } else {
      setTimeout(() => {
        headline.classList.remove("typing")
        headline.style.minHeight = ""

        // The typed breaks were worked out for the width at the time, and
        // the finished heading should not keep them: turning a phone counts
        // as a new width, and the line would then break where the old screen
        // wanted rather than where this one does. Plain text again, wrapped
        // by the browser from here on.
        headline.textContent = text
      }, 120)
      // A beat on the finished line before anything follows, long enough
      // to register as a pause rather than a stutter.
      setTimeout(() => onDone?.(), 420)
    }
  }
  step()
}
