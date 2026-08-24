// Marks the document before it paints, so a first visit never shows the
// finished page for a frame before the opening sequence starts.
//
// A separate file rather than an inline script in the head: the site's own
// Content Security Policy sets script-src 'self', which blocks inline
// scripts, so an inline one here was silently refused and the class never
// applied. Loaded without defer, so it runs before the body is parsed.
//
// intro.js removes the class. Without scripting the noscript rule in the
// head shows the page instead.
document.documentElement.classList.add("intro-pending")
