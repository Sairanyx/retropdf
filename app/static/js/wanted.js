// Remembers that you already asked for a desktop app.
//
// The count is a number of people rather than a number of clicks, so pressing
// the button twice should not say two. Your own browser remembers, which is
// the only way to do this without breaking the promises the site makes: a
// cookie is ruled out by the privacy page, and anything derived from your
// address would be something kept about you.
//
// It stops the ordinary repeats, which is what it is for: a refresh, a second
// visit, pressing it again because you forgot. Somebody determined to inflate
// the number can clear their storage or open a private window, and the page
// says so rather than pretending otherwise.

const ASKED = "retropdf-wanted-desktop"

/** Read, treating a refusal to store as not knowing. */
function recall() {
  try {
    return localStorage.getItem(ASKED)
  } catch (error) {
    // Private browsing can refuse storage outright, which reads the same as
    // never having asked. Counting again is the harmless way to be wrong.
    return null
  }
}

function remember() {
  try {
    localStorage.setItem(ASKED, new Date().toISOString().slice(0, 10))
  } catch (error) {
    // As above: nothing to do about it.
  }
}

const button = document.querySelector(".wanted")

// On the page that did the counting, so this visit is the asking.
if (document.body.dataset.counted === "1") {
  remember()

  // Take the marker out of the address. Only a request carrying it counts,
  // so leaving it there would let a reload ask again and again: the count
  // would follow how long somebody held F5 rather than how many people
  // wanted the thing. The page you are reading does not change, only the
  // address a reload would use.
  try {
    history.replaceState(null, "", location.pathname)
  } catch (error) {
    // Nothing to do. The worst case is the old behaviour, where a reload
    // counts again.
  }
} else if (button && recall()) {
  // Asked before, so the button says so and stops leading anywhere. Left as
  // a link it would count the same person twice.
  button.classList.add("asked")
  button.removeAttribute("href")
  button.setAttribute("role", "note")

  const doing = button.querySelector(".wanted-do")
  if (doing) doing.textContent = "You have asked for this"
}
