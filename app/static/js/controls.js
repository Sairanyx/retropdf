// Replaces the browser's own number spinners with buttons that match the
// rest of the page.
//
// The real input stays exactly where it was, so typing, keyboard arrows and
// screen readers all keep working. Only the tiny native arrows are hidden by
// the CSS, and these buttons drive the same input.

for (const input of document.querySelectorAll('input[type="number"]')) {
  // Skip one that has already been wrapped, in case this runs twice.
  if (input.parentElement?.classList.contains("stepper")) continue

  const stepper = document.createElement("div")
  stepper.className = "stepper"
  input.replaceWith(stepper)

  stepper.append(step(input, -1, "\u2212"), input, step(input, 1, "+"))
}

/**
 * One stepper button.
 *
 * `stepDown` and `stepUp` are the browser's own, so min, max and step are
 * respected without repeating that logic here. Dispatching `input` and
 * `change` means anything listening to the field reacts as if it were typed.
 */
function step(input, direction, label) {
  const button = document.createElement("button")
  button.type = "button"
  button.className = "mini"
  button.textContent = label
  button.tabIndex = -1 // the input itself is the keyboard target
  button.setAttribute(
    "aria-label",
    direction < 0 ? "Decrease" : "Increase",
  )

  button.addEventListener("click", () => {
    if (direction < 0) input.stepDown()
    else input.stepUp()

    input.dispatchEvent(new Event("input", { bubbles: true }))
    input.dispatchEvent(new Event("change", { bubbles: true }))
  })

  return button
}
