// The words the scripts need, in the reader's language.
//
// The translations live in JSON files the server reads, which the browser
// cannot see. Rather than shipping every language to every visitor, the page
// carries only its own: the server writes them into a script tag and this
// reads them back.
//
// A type of application/json rather than a module, because the site sets
// script-src 'self' and the browser will not run an inline script. It will
// happily read one as data.

// Read once, the first time a word is asked for rather than when this file
// loads. The operations are tested in Node, which has no document, and
// reading at import time made merely importing them fail.
let WORDS = null

/** Every string this page was given, or nothing if there is no page. */
function load() {
  if (WORDS) return WORDS
  if (typeof document === "undefined") return (WORDS = {})

  const block = document.getElementById("words")
  if (!block) return (WORDS = {})
  try {
    return (WORDS = JSON.parse(block.textContent))
  } catch (error) {
    // A malformed block should cost the wording, not the tool. The fallbacks
    // are English, which is what the site had before any of this.
    return (WORDS = {})
  }
}

/**
 * The words for a key, with any values substituted in.
 *
 * `say("js.saved_pages", { count: 3 })` finds "Saved {count} pages." and
 * fills it. The placeholder stays inside the sentence rather than being
 * glued on, so a translation can put the number where its own grammar wants
 * it.
 *
 * An unknown key comes back as the fallback, or as the key itself when there
 * is none. Both are visible rather than silent, which is what you want when a
 * string has been renamed and something was missed.
 */
export function say(key, values = {}, fallback = "") {
  const known = load()[key] || fallback
  const entries = Object.entries(values)

  // No words for this key, which happens in a test with no page and would
  // happen on a page whose block failed to parse. The key alone would drop
  // the filename and size the reader needs, so they are kept beside it.
  if (!known) {
    if (entries.length === 0) return key
    return `${key}|${entries.map(([, value]) => String(value)).join("|")}`
  }

  let text = known
  for (const [name, value] of entries) {
    text = text.replaceAll(`{${name}}`, String(value))
  }
  return text
}

/**
 * A count with its noun, in the right form for the number.
 *
 * English needs two forms and most of these languages need one or two, but
 * the split is not the same everywhere: Finnish uses the singular after a
 * number, Chinese and Japanese have no plural at all. So the choice is made
 * by the translation rather than by adding an "s" here, which is what the
 * old helper did and what would have read as "3 files" in every language.
 */
export function count(n, noun) {
  const key = n === 1 ? `js.count.${noun}.one` : `js.count.${noun}.many`
  return say(key, { count: n }, `${n} ${noun}${n === 1 ? "" : "s"}`)
}
