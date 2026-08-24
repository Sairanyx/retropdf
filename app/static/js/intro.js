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

if (!stage || !mark || wantsLessMotion || alreadySeen) {
  document.body.classList.add("intro-done", "intro-skipped")
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

  // Work out where the mark has to travel to before it starts moving. The
  // header is laid out already, it is only transparent, so measuring is safe.
  aimAtBrand()
  window.addEventListener("resize", aimAtBrand)

  // 1. The mark arrives on the dark ground, alone.
  setTimeout(() => document.body.classList.add("intro-drop"), 80)

  // 2. It travels to the corner and lands on the brand icon's position.
  setTimeout(() => document.body.classList.add("intro-dock"), 1300)

  // 3. The brand plate fades up around the landed mark, so the mark becomes
  //    the logo rather than disappearing and being replaced.
  setTimeout(() => document.body.classList.add("intro-brand"), 2000)

  // 4. The headline types in. Only the home page has one, so pages without
  //    it move straight on rather than pausing for nothing.
  const typingStart = headline ? 2450 : 2150
  const revealStart = headline ? 2700 : 2300

  if (headline) {
    setTimeout(() => {
      document.body.classList.add("intro-typing")
      typeHeadline()
    }, typingStart)
  }

  // 5. Everything else arrives.
  setTimeout(() => document.body.classList.add("intro-reveal"), revealStart)

  setTimeout(() => {
    document.body.classList.add("intro-done")
    document.body.classList.remove(
      "intro-running", "intro-drop", "intro-dock", "intro-brand",
      "intro-typing", "intro-reveal",
    )
    window.removeEventListener("resize", aimAtBrand)
  }, revealStart + 900)
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
function typeHeadline() {
  if (!headline || wantsLessMotion || headline.dataset.typed === "1") return

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
      }, 500)
    }
  }
  step()
}
