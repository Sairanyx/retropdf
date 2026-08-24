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

const SEEN = "redpdf-intro-seen"

const wantsLessMotion =
  window.matchMedia("(prefers-reduced-motion: reduce)").matches

let alreadySeen = false
try {
  alreadySeen = sessionStorage.getItem(SEEN) === "1"
} catch (error) {
  // Private browsing can refuse storage. Showing the intro again is harmless.
}

const stage = document.querySelector("[data-intro]")
const mark = document.querySelector(".intro-mark svg")
const headline = document.querySelector("[data-type]")

// Empty the headline before anything paints, so the finished text is never
// briefly visible before the typing starts. The text lives in data-type, so
// nothing is lost for search engines or without scripting.
if (headline && !wantsLessMotion) {
  headline.style.minHeight = `${headline.offsetHeight}px`
  headline.textContent = ""
}

function reveal() {
  document.documentElement.classList.remove("intro-pending")
}

if (!stage || !mark || wantsLessMotion || alreadySeen) {
  reveal()
  document.body.classList.add("intro-done", "intro-skipped")
  // Wait for the heading's own section to have risen into place before
  // writing into it, so the two are sequential rather than overlapping.
  setTimeout(typeHeadline, wantsLessMotion ? 0 : 320)
} else {
  try {
    sessionStorage.setItem(SEEN, "1")
  } catch (error) {
    // Nothing to do: the intro simply plays again next time.
  }
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
 * Point the falling mark at the real brand icon.
 *
 * The mark starts centred in the window, so the distance it must travel is
 * measured live rather than assumed. Measuring the icon rather than the
 * plate means the mark lands exactly where the logo's icon will be.
 */
function aimAtBrand() {
  const brandIcon = document.querySelector("#brand-plate svg")
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
  if (!headline || wantsLessMotion || headline.dataset.typed === "1") {
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
      // A short beat on the finished line before the page follows.
      setTimeout(() => onDone?.(), 260)
    }
  }
  step()
}
