// Replaces two browser drawn controls with ones that match the page.
//
// In both cases the real form element stays in the DOM and keeps its value,
// so anything reading the form still works. The replacements drive it.

// --- number inputs -----------------------------------------------------

// The browser draws tiny spinner arrows that look like Windows rather than
// like this page. The CSS hides them and these buttons take over.

for (const input of document.querySelectorAll('input[type="number"]')) {
  if (input.parentElement?.classList.contains("stepper")) continue

  const stepper = document.createElement("div")
  stepper.className = "stepper"
  input.replaceWith(stepper)
  stepper.append(stepButton(input, -1, "−"), input, stepButton(input, 1, "+"))
}

/**
 * One stepper button.
 *
 * stepDown and stepUp are the browser's own, so min, max and step are
 * respected without repeating that logic. Dispatching input and change means
 * anything listening reacts as if the value had been typed.
 */
function stepButton(input, direction, label) {
  const button = document.createElement("button")
  button.type = "button"
  button.className = "mini"
  button.textContent = label
  button.tabIndex = -1 // the input itself is the keyboard target
  button.setAttribute("aria-label", direction < 0 ? "Decrease" : "Increase")

  button.addEventListener("click", () => {
    if (direction < 0) input.stepDown()
    else input.stepUp()
    input.dispatchEvent(new Event("input", { bubbles: true }))
    input.dispatchEvent(new Event("change", { bubbles: true }))
  })

  return button
}

// --- selects -----------------------------------------------------------

// A native select's open list is painted by the operating system and cannot
// be styled at all, so it always looks like Windows. This replaces it with a
// listbox built from ordinary elements.
//
// The original select is kept, hidden, and stays the source of truth for its
// value. Keyboard support matches what a native select does: arrows move,
// Home and End jump, Enter and Space open and choose, Escape closes, and
// typing a letter jumps to the next option starting with it.

for (const select of document.querySelectorAll("select")) {
  if (select.dataset.enhanced !== "1") enhanceSelect(select)
}

function enhanceSelect(select) {
  select.dataset.enhanced = "1"

  const wrap = document.createElement("div")
  wrap.className = "picker"

  const button = document.createElement("button")
  button.type = "button"
  button.className = "picker-button"
  button.setAttribute("aria-haspopup", "listbox")
  button.setAttribute("aria-expanded", "false")

  const value = document.createElement("span")
  value.className = "picker-value"
  value.id = (select.id || "picker") + "-value"
  button.append(value)

  const list = document.createElement("ul")
  list.className = "picker-list"
  list.setAttribute("role", "listbox")
  list.hidden = true

  // Carry the select's own label across, so the button is still named.
  const labelEl = select.id
    ? document.querySelector('label[for="' + select.id + '"]')
    : null
  if (labelEl) {
    if (!labelEl.id) labelEl.id = (select.id || "picker") + "-label"
    button.setAttribute("aria-labelledby", labelEl.id + " " + value.id)
    list.setAttribute("aria-labelledby", labelEl.id)
  }

  const options = Array.from(select.options).map((option, index) => {
    const item = document.createElement("li")
    item.className = "picker-option"
    item.setAttribute("role", "option")
    item.textContent = option.textContent
    item.id = (select.id || "picker") + "-option-" + index
    list.append(item)
    return item
  })

  // Which option the keyboard is currently on, separate from what is chosen.
  let active = select.selectedIndex < 0 ? 0 : select.selectedIndex

  function paint() {
    value.textContent = select.options[select.selectedIndex]?.textContent ?? ""

    options.forEach((item, index) => {
      const chosen = index === select.selectedIndex
      item.setAttribute("aria-selected", String(chosen))
      item.classList.toggle("chosen", chosen)
      item.classList.toggle("active", index === active && !list.hidden)
    })

    if (list.hidden) list.removeAttribute("aria-activedescendant")
    else list.setAttribute("aria-activedescendant", options[active].id)
  }

  function open() {
    if (!list.hidden) return
    active = select.selectedIndex < 0 ? 0 : select.selectedIndex
    list.hidden = false
    button.setAttribute("aria-expanded", "true")
    wrap.classList.add("open")
    paint()
    options[active].scrollIntoView({ block: "nearest" })
  }

  function close(refocus = true) {
    if (list.hidden) return
    list.hidden = true
    button.setAttribute("aria-expanded", "false")
    wrap.classList.remove("open")
    paint()
    if (refocus) button.focus()
  }

  function choose(index) {
    select.selectedIndex = index
    select.dispatchEvent(new Event("input", { bubbles: true }))
    select.dispatchEvent(new Event("change", { bubbles: true }))
    close()
  }

  /** Jump to the next option starting with a letter, as a native select does. */
  function jumpTo(letter) {
    const from = list.hidden ? select.selectedIndex + 1 : active + 1
    for (let i = 0; i < options.length; i++) {
      const index = (from + i) % options.length
      if (options[index].textContent.toLowerCase().startsWith(letter)) {
        if (list.hidden) choose(index)
        else active = index
        return
      }
    }
  }

  button.addEventListener("click", () => {
    if (list.hidden) open()
    else close()
  })

  // pointerdown rather than click, so the button does not lose focus first
  // and close the list out from under the pointer.
  list.addEventListener("pointerdown", (event) => {
    const item = event.target.closest(".picker-option")
    if (!item) return
    event.preventDefault()
    choose(options.indexOf(item))
  })

  list.addEventListener("pointermove", (event) => {
    const item = event.target.closest(".picker-option")
    if (!item) return
    active = options.indexOf(item)
    paint()
  })

  wrap.addEventListener("keydown", (event) => {
    const isOpen = !list.hidden

    switch (event.key) {
      case "ArrowDown":
        event.preventDefault()
        if (!isOpen) return open()
        active = Math.min(active + 1, options.length - 1)
        break

      case "ArrowUp":
        event.preventDefault()
        if (!isOpen) return open()
        active = Math.max(active - 1, 0)
        break

      case "Home":
        if (!isOpen) return
        event.preventDefault()
        active = 0
        break

      case "End":
        if (!isOpen) return
        event.preventDefault()
        active = options.length - 1
        break

      case "Enter":
      case " ":
        event.preventDefault()
        if (isOpen) choose(active)
        else open()
        return

      case "Escape":
        if (!isOpen) return
        event.preventDefault()
        close()
        return

      case "Tab":
        close(false)
        return

      default:
        if (event.key.length === 1 && /\S/.test(event.key)) {
          jumpTo(event.key.toLowerCase())
        }
        break
    }

    paint()
    if (!list.hidden) options[active].scrollIntoView({ block: "nearest" })
  })

  // Clicking anywhere else closes the list.
  document.addEventListener("pointerdown", (event) => {
    if (!wrap.contains(event.target)) close(false)
  })

  // Anything changing the select directly keeps the button in step.
  select.addEventListener("change", paint)

  select.replaceWith(wrap)
  wrap.append(button, list, select)

  // The native select stays for its value, but out of the tab order and out
  // of the accessibility tree, since the listbox above now represents it.
  select.classList.add("picker-native")
  select.tabIndex = -1
  select.setAttribute("aria-hidden", "true")

  paint()
}
