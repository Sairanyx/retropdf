// The opening sequence.
//
// A mark falls from above, settles, and the page assembles around it: the
// nav plate slides in, the headline types, then the tools arrive one after
// another. Every step is a real element moving into its final place, so the
// page is usable the moment it finishes rather than being decoration laid
// over a page that was already there.
//
// Skipped entirely for anyone who has asked for less motion, and skipped on
// repeat visits within the session so it never becomes an obstacle.

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

if (!stage || wantsLessMotion || alreadySeen) {
  document.body.classList.add("intro-done")
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
  // brighten, so the mark falls into that rather than waiting for it, and the
  // headline starts typing while the ground is still settling.
  const steps = [
    // The mark drops and lands.
    [60, () => document.body.classList.add("intro-drop")],
    // It shrinks away towards the corner where the brand sits.
    [1250, () => document.body.classList.add("intro-dock")],
    // The chrome and content arrive behind it.
    [1650, () => document.body.classList.add("intro-reveal")],
    // Hand control back while the ground is still easing to its final grey.
    [2150, () => {
      document.body.classList.remove("intro-drop", "intro-dock", "intro-reveal")
      document.body.classList.add("intro-done")
      typeHeadline()
    }],
    // The ground animation is the last thing to finish.
    [2800, () => document.body.classList.remove("intro-running")],
  ]

  for (const [delay, action] of steps) setTimeout(action, delay)
}

// Types the headline in, fast enough to feel eager rather than slow. The
// finished text is already in the markup for search engines and for anyone
// with scripting off.
function typeHeadline() {
  const headline = document.querySelector("[data-type]")
  if (!headline || wantsLessMotion) return

  const text = headline.dataset.type
  headline.textContent = ""
  headline.classList.add("typing")

  let shown = 0
  const step = () => {
    shown += 1
    headline.textContent = text.slice(0, shown)
    if (shown < text.length) setTimeout(step, 18)
    else setTimeout(() => headline.classList.remove("typing"), 400)
  }
  step()
}

// When the intro is skipped the headline still types, just without the drop.
if (document.body.classList.contains("intro-done")) {
  if (!alreadySeen) typeHeadline()
}
