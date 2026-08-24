// The opening sequence.
//
// A mark falls from above, settles, then flies into the brand plate in the
// corner and becomes it. The chrome and content arrive behind it, and the
// headline types itself in.
//
// The mark's landing point is measured from the real brand plate rather than
// guessed, so it actually lands on it at any window size.
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

if (!stage || !mark || wantsLessMotion || alreadySeen) {
  document.body.classList.add("intro-done")
  typeHeadline()
} else {
  try {
    sessionStorage.setItem(SEEN, "1")
  } catch (error) {
    // Nothing to do: the intro simply plays again next time.
  }
  run()
}

function run() {
  document.body.classList.add("intro-running")

  // Timings read frame by frame from the reference. The ground takes 2.7s to
  // brighten, so the mark falls into that rather than waiting for it.
  setTimeout(() => document.body.classList.add("intro-drop"), 60)

  setTimeout(() => {
    aimAtBrand()
    document.body.classList.add("intro-dock")
  }, 1250)

  // The chrome and content arrive while the mark is still travelling.
  setTimeout(() => document.body.classList.add("intro-reveal"), 1500)

  // Hand control back. The mark is gone and the brand plate is in its place.
  setTimeout(() => {
    document.body.classList.add("intro-done")
    document.body.classList.remove("intro-drop", "intro-dock", "intro-reveal")
    typeHeadline()
  }, 2100)

  // The ground animation is the last thing to finish, so the class that
  // drives it is removed only once it has.
  setTimeout(() => document.body.classList.remove("intro-running"), 2800)
}

/**
 * Point the falling mark at the real brand plate.
 *
 * The mark starts centred in the window, so the distance it must travel is
 * measured live rather than assumed, which keeps it landing correctly at any
 * window size.
 */
function aimAtBrand() {
  const brandIcon = document.querySelector("#brand-plate svg")
  if (!brandIcon) return

  const from = mark.getBoundingClientRect()
  const to = brandIcon.getBoundingClientRect()

  const dx = to.left + to.width / 2 - (from.left + from.width / 2)
  const dy = to.top + to.height / 2 - (from.top + from.height / 2)
  // The mark is drawn larger than the brand icon, so it shrinks as it lands.
  const scale = to.width / (from.width || 1)

  mark.style.setProperty("--dock-x", `${dx}px`)
  mark.style.setProperty("--dock-y", `${dy}px`)
  mark.style.setProperty("--dock-scale", String(scale))
}

/**
 * Type the headline in.
 *
 * The finished text is already in the markup for search engines and for
 * anyone with scripting off, so this only replays it as typing.
 */
function typeHeadline() {
  const headline = document.querySelector("[data-type]")
  if (!headline || wantsLessMotion || headline.dataset.typed === "1") return

  headline.dataset.typed = "1"
  const text = headline.dataset.type

  // Hold the finished height so the page does not jump as lines are added.
  headline.style.minHeight = `${headline.offsetHeight}px`
  headline.textContent = ""
  headline.classList.add("typing")

  let shown = 0
  const step = () => {
    shown += 1
    headline.textContent = text.slice(0, shown)
    if (shown < text.length) {
      setTimeout(step, 18)
    } else {
      setTimeout(() => {
        headline.classList.remove("typing")
        headline.style.minHeight = ""
      }, 500)
    }
  }
  step()
}
