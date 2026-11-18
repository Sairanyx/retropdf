// Tells a reader whose browser is too old that the tools will not work here.
//
// Shown only when this browser actually lacks something the site needs,
// tested here on the reader's own device rather than guessed from its name.
// Everyone with a supported browser never sees it.
//
// The site supports what pdf.js supports: Chrome, Edge and Opera 125 or
// newer, Firefox ESR, and Safari 18 or newer, on phones and tablets as well
// as computers. The checks below are features that every one of those has,
// so a browser missing any of them is certainly too old. One that passes and
// still fails is caught later, when a tool runs (see reasonFor in app.js).
//
// Written in the oldest JavaScript there is, deliberately. Everything else
// on the site is a module, which an old browser skips without a word, and
// that silence is the problem this file exists to fix. If this file used
// modern syntax, the browsers it is for could not read it either.
;(function () {
  function supportsModules() {
    return "noModule" in document.createElement("script")
  }

  // A worker started as a module, which the PDF work runs in. The browser
  // only reads the "type" option if it understands it, so reading it is the
  // test. The options are read before the address is, and the address given
  // cannot be parsed, so no worker starts and nothing is requested. A real
  // address would also trip the site's own policy and log a refusal.
  function supportsModuleWorkers() {
    var supported = false
    try {
      new Worker("http://[", {
        get type() {
          supported = true
          return "module"
        },
      })
    } catch (error) {
      // Always thrown, by the address. The option was read or it was not.
    }
    return supported
  }

  function supportsCss() {
    return (
      !!window.CSS &&
      typeof CSS.supports === "function" &&
      CSS.supports("color", "color-mix(in srgb, red, blue)") &&
      CSS.supports("selector(:has(a))")
    )
  }

  function supported() {
    try {
      return (
        supportsModules() &&
        supportsModuleWorkers() &&
        typeof window.structuredClone === "function" &&
        typeof Array.prototype.findLast === "function" &&
        typeof window.IntersectionObserver === "function" &&
        supportsCss()
      )
    } catch (error) {
      return false
    }
  }

  if (supported()) return

  document.documentElement.className += " old-browser"

  function explain() {
    // The opening animation hides the page until it runs, and it is a
    // module, so it never runs here. Without this the page stays blank.
    document.documentElement.className = document.documentElement.className
      .replace(/\bintro-pending\b/g, "")

    // In the reader's language when the page carries it, English otherwise.
    var text =
      "This browser is too old to run the tools on this page. Updating it, " +
      "or opening the page in an up to date Chrome, Edge, Firefox or Safari, " +
      "will fix that."
    try {
      var words = JSON.parse(document.getElementById("words").textContent)
      if (words["js.old_browser"]) text = words["js.old_browser"]
    } catch (error) {
      // English it is.
    }

    var note = document.createElement("p")
    note.className = "old-browser-note"
    note.setAttribute("role", "alert")
    note.appendChild(document.createTextNode(text))

    var header = document.querySelector(".topbar-wrap")
    if (header && header.parentNode) {
      header.parentNode.insertBefore(note, header.nextSibling)
    } else {
      document.body.insertBefore(note, document.body.firstChild)
    }

    // Choosing a file would do nothing at all, which reads as broken rather
    // than as unsupported. Better that the controls say so by being off.
    var controls = document.querySelectorAll("#picker, #download")
    for (var i = 0; i < controls.length; i++) controls[i].disabled = true
  }

  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", explain)
  } else {
    explain()
  }
})()
