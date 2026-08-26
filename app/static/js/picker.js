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
