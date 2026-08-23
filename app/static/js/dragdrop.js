// Dragging: files onto the page, and thumbnails into a new order.
//
// Both are additions, never the only way to do something. The arrow buttons
// stay, because dragging is genuinely hard or impossible for some people:
// motor difficulties, trackpads, and screen readers all struggle with it.
//
// Reordering uses pointer events rather than the HTML drag and drop API,
// which does not work on touchscreens at all. Pointer events cover mouse,
// touch and stylus with one path.

/**
 * Let files be dropped anywhere on the page.
 *
 * `onFiles` receives the dropped files. `onState` is told when the page is
 * being dragged over, so the caller can show it.
 */
export function acceptDroppedFiles(target, onFiles, onState = () => {}) {
  // Without preventing these, the browser navigates away to open the file,
  // losing whatever the user was doing.
  const stop = (event) => {
    event.preventDefault()
    event.stopPropagation()
  }

  // dragenter and dragleave fire for every child element the pointer crosses,
  // so a plain boolean flickers. Counting them is the usual fix.
  let depth = 0

  target.addEventListener("dragenter", (event) => {
    stop(event)
    depth++
    if (depth === 1) onState(true)
  })

  target.addEventListener("dragover", stop)

  target.addEventListener("dragleave", (event) => {
    stop(event)
    depth = Math.max(0, depth - 1)
    if (depth === 0) onState(false)
  })

  target.addEventListener("drop", (event) => {
    stop(event)
    depth = 0
    onState(false)

    const files = Array.from(event.dataTransfer?.files || [])
    if (files.length > 0) onFiles(files)
  })
}

// How far the pointer must travel before this counts as a drag rather than a
// click. Without it, a slightly shaky click would start dragging.
const DRAG_THRESHOLD = 6

/**
 * Let the items inside a container be dragged into a new order.
 *
 * While dragging, the item shrinks and follows the pointer, and the others
 * slide aside to show where it would land. `onMove(from, to)` is called once
 * the drag finishes somewhere new, and the caller redraws from its own data.
 *
 * Items must carry a data-position attribute giving their index.
 */
export function makeReorderable(container, onMove) {
  let source = null // the item being dragged
  let ghost = null // the shrunken copy that follows the pointer
  let startIndex = -1
  let lastTarget = -1
  let pointerId = null
  let origin = null // where the pointer went down
  let started = false // has it passed the threshold yet

  function itemsExcept(exclude) {
    return Array.from(container.querySelectorAll("[data-position]")).filter(
      (item) => item !== exclude,
    )
  }

  function beginDrag(event) {
    started = true
    const box = source.getBoundingClientRect()

    // A shrunken copy follows the pointer. The original stays in place as a
    // gap, so the layout does not jump when the drag starts.
    ghost = source.cloneNode(true)
    ghost.classList.add("drag-ghost")
    ghost.style.width = `${box.width}px`
    ghost.style.height = `${box.height}px`
    ghost.style.left = `${box.left}px`
    ghost.style.top = `${box.top}px`
    document.body.appendChild(ghost)

    // Remember where in the copy the pointer was, so it does not jump to the
    // corner as it shrinks.
    ghost.dataset.grabX = String((event.clientX - box.left) / box.width)
    ghost.dataset.grabY = String((event.clientY - box.top) / box.height)

    source.classList.add("drag-source")
    document.body.classList.add("dragging-page")
    moveGhost(event)
  }

  function moveGhost(event) {
    if (!ghost) return
    const box = ghost.getBoundingClientRect()
    const grabX = Number(ghost.dataset.grabX) * box.width
    const grabY = Number(ghost.dataset.grabY) * box.height
    ghost.style.left = `${event.clientX - grabX}px`
    ghost.style.top = `${event.clientY - grabY}px`
  }

  /** Which item is under the pointer, ignoring the ghost itself. */
  function itemUnder(event) {
    if (ghost) ghost.style.pointerEvents = "none"
    const element = document.elementFromPoint(event.clientX, event.clientY)
    return element?.closest("[data-position]") || null
  }

  container.addEventListener("pointerdown", (event) => {
    // Only a plain left click or a single touch. Anything else is a right
    // click, a second finger, or a button inside the item doing its own job.
    if (event.button !== 0) return
    if (event.target.closest("button")) return

    const item = event.target.closest("[data-position]")
    if (!item) return

    source = item
    startIndex = Number(item.dataset.position)
    lastTarget = startIndex
    pointerId = event.pointerId
    origin = { x: event.clientX, y: event.clientY }
    started = false

    // Keep receiving events even when the pointer leaves the element.
    item.setPointerCapture(pointerId)
  })

  container.addEventListener("pointermove", (event) => {
    if (!source || event.pointerId !== pointerId) return

    if (!started) {
      const moved = Math.hypot(event.clientX - origin.x, event.clientY - origin.y)
      if (moved < DRAG_THRESHOLD) return
      beginDrag(event)
    }

    // Stop the page scrolling under a touch drag.
    event.preventDefault()
    moveGhost(event)

    const over = itemUnder(event)
    const overIndex = over ? Number(over.dataset.position) : -1

    if (overIndex !== lastTarget) {
      lastTarget = overIndex

      // Slide the others aside so the gap appears where it would land.
      for (const item of itemsExcept(source)) {
        const index = Number(item.dataset.position)
        const shifts =
          overIndex >= 0 &&
          ((startIndex < overIndex && index > startIndex && index <= overIndex) ||
            (startIndex > overIndex && index < startIndex && index >= overIndex))

        item.classList.toggle("shift-back", shifts && startIndex < overIndex)
        item.classList.toggle("shift-forward", shifts && startIndex > overIndex)
      }
    }
  })

  function finish(event) {
    if (!source || event.pointerId !== pointerId) return

    const wasDragging = started
    const over = wasDragging ? itemUnder(event) : null
    const endIndex = over ? Number(over.dataset.position) : -1

    // Send the ghost to where the page will end up, then hand over.
    if (ghost) {
      const landing = over || source
      const box = landing.getBoundingClientRect()
      ghost.classList.add("drag-landing")
      ghost.style.left = `${box.left}px`
      ghost.style.top = `${box.top}px`

      const settling = ghost
      ghost = null
      settling.addEventListener("transitionend", () => settling.remove(), { once: true })
      // In case the transition never fires, for instance on a hidden tab.
      setTimeout(() => settling.remove(), 400)
    }

    source.classList.remove("drag-source")
    document.body.classList.remove("dragging-page")
    for (const item of itemsExcept(null)) {
      item.classList.remove("shift-back", "shift-forward")
    }

    const from = startIndex
    source = null
    pointerId = null
    started = false

    if (wasDragging && endIndex >= 0 && endIndex !== from) {
      // Let the ghost start settling before the grid redraws under it.
      requestAnimationFrame(() => onMove(from, endIndex))
    }
  }

  container.addEventListener("pointerup", finish)
  container.addEventListener("pointercancel", finish)
}
