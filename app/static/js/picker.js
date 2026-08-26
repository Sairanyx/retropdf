// Closes the language picker when you click away from it.
//
// A details element opens and closes on its own summary, which is why the
// picker works with no scripting at all. What it will not do is close when
// you decide against it and click elsewhere, so the panel stays open behind
// whatever you do next. This adds that, and Escape with it.
//
// Everything here is an addition. With scripting off the picker still opens,
// still lists every language, and still closes on a second click of the chip.

const picker = document.querySelector(".picker")

if (picker) {
  // Anything outside the picker closes it. Listening on the document rather
  // than on the page body catches clicks on the margins too.
  document.addEventListener("click", (event) => {
    if (!picker.open) return
    if (picker.contains(event.target)) return
    picker.open = false
  })

  // Escape is what people press to dismiss a menu, and the browser does not
  // do it for a details element.
  document.addEventListener("keydown", (event) => {
    if (event.key !== "Escape" || !picker.open) return
    picker.open = false
    // Back to the chip, so the keyboard is where the reader left it rather
    // than at the top of the page.
    picker.querySelector("summary")?.focus()
  })
}


// Line the desktop app button up with the left edge of the taskbar.
//
// The taskbar is fixed to the right and its width changes with the language,
// so the button's distance from the left of the window is not a fixed number
// and cannot be written in the stylesheet. Measured here and handed back as a
// custom property, which the CSS uses in place of its own rough guess.
function alignWantedWithNav() {
  const nav = document.querySelector(".navgroup")
  const wanted = document.querySelector(".wanted")
  if (!nav || !wanted) return

  // Only while the nav is fixed to the right. On a phone it sits in the flow
  // and the button follows it there on its own.
  if (getComputedStyle(nav).position !== "fixed") {
    document.documentElement.style.removeProperty("--nav-left")
    return
  }

  const left = Math.round(nav.getBoundingClientRect().left)
  document.documentElement.style.setProperty("--nav-left", `${left}px`)
}

alignWantedWithNav()
window.addEventListener("resize", alignWantedWithNav, { passive: true })
// The nav is a different width once the display face has arrived.
document.fonts?.ready.then(alignWantedWithNav)

