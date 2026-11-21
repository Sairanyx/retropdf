"""RetroPDF web server.

Serves the HTML pages and the static files. It never receives or processes a
PDF: that happens entirely in the browser, so there is no upload endpoint and
nothing here ever touches a user's document.

Each tool gets its own URL so that someone searching for one specific job
lands on a page about that job. All of them render the same template with a
different tool selected.
"""

import json
import os
from pathlib import Path

from fastapi import FastAPI, Request
from fastapi.responses import FileResponse, HTMLResponse, PlainTextResponse
from fastapi.staticfiles import StaticFiles
from fastapi.templating import Jinja2Templates
from starlette.exceptions import HTTPException as StarletteHTTPException

from app import flags, interest, languages
from app.security import HEADERS, SecurityHeaders
from app.translations import words_for
from app.tool_art import ART
from app.tools import TOOLS, BY_SLUG

APP_DIR = Path(__file__).resolve().parent
STATIC_DIR = APP_DIR / "static"

# Used for canonical URLs and the sitemap. Set RETROPDF_BASE_URL in production.
BASE_URL = os.environ.get("RETROPDF_BASE_URL", "http://127.0.0.1:8000").rstrip("/")

app = FastAPI(title="RetroPDF", docs_url=None, redoc_url=None)

# HSTS is only meaningful over HTTPS, so it stays off unless this is running
# behind the production proxy.
app.add_middleware(
    SecurityHeaders,
    hsts=os.environ.get("RETROPDF_HTTPS", "").lower() in {"1", "true", "yes"},
    # Development only: stops the browser serving a cached script, which
    # makes a change look as though it did not take effect.
    no_cache=os.environ.get("RETROPDF_DEV", "").lower() in {"1", "true", "yes"},
)

app.mount("/static", StaticFiles(directory=STATIC_DIR), name="static")

templates = Jinja2Templates(directory=APP_DIR / "templates")


def route(path: str, **options):
    """Register a page for GET and HEAD.

    FastAPI's app.get answers HEAD with 405, unlike plain Starlette. HEAD is
    what `curl -I`, uptime monitors and some crawlers send, and a site whose
    headers cannot be checked that way looks broken from outside.
    """
    return app.api_route(path, methods=["GET", "HEAD"], **options)


def _script_words(lang: str) -> str:
    """Every js. string for one language, as JSON for the page to carry.

    Only the js. keys: the rest are already rendered into the markup, and
    sending them again would be dead weight on every page.
    """
    words = words_for(lang)
    english = words_for("en")
    chosen = {
        key: words(key)
        for key in english.keys()
        if key.startswith("js.")
    }
    return json.dumps(chosen, ensure_ascii=False, separators=(",", ":"))


def _language_urls(here: str) -> dict:
    """This page's address in every language."""
    return {
        language.code: languages.path_for(language.code, here)
        for language in languages.LANGUAGES
    }


def render(request: Request, template: str, lang: str = "en", **context) -> HTMLResponse:
    """Render a page with the values every template needs.

    `t` is how a template asks for a word: `{{ t("nav.tools") }}`. It is bound
    to the language of this request, so the template itself is written once
    and says nothing about which language it is being read in.

    `url` builds an address in the current language, so a link written once
    stays inside the language the reader is already in.
    """
    words = words_for(lang)
    language = languages.BY_CODE.get(lang, languages.DEFAULT)
    return templates.TemplateResponse(
        request=request,
        name=template,
        context={
            "tools": TOOLS,
            "art": ART,
            "t": words,
            "lang": language,
            "languages": languages.LANGUAGES,
            "url": lambda path="": languages.path_for(lang, path),
            "base_url": BASE_URL,
            # The strings the browser scripts need, in this page's language.
            # They cannot read the translation files themselves, and shipping
            # every language to every visitor would be eleven times the words
            # for no reason.
            "script_words": _script_words(lang),
            "flags": flags.FLAGS,
            # Where each language's version of this page lives, so the picker
            # keeps you on the page you are reading.
            "language_urls": _language_urls(context.get("here", "")),
            # Every language this page exists in, for the hreflang tags that
            # tell a search engine these are the same page rather than
            # duplicates competing with each other.
            # An English only page has no alternates: its other addresses
            # carry the same English text, so they point back to the English
            # one as canonical instead.
            "alternates": (
                []
                if languages.english_only(context.get("here", ""))
                else [
                    (other, languages.path_for(other.code, context.get("here", "")))
                    for other in languages.LANGUAGES
                ]
            ),
            **context,
        },
    )


def make_home_route(lang: str = "en"):
    """Build the home page handler for one language."""

    def home(request: Request) -> HTMLResponse:
        """The home page: what this is, and a way into each tool."""
        words = words_for(lang)
        return render(
            request,
            "home.html",
            lang=lang,
            here="",
            page_title=words("home.title"),
            page_description=words("home.description"),
            canonical=f"{BASE_URL}{languages.path_for(lang)}",
            on_home=True,
            route="snake",
        )

    home.__name__ = f"home_{lang}"
    return home


route("/", response_class=HTMLResponse)(make_home_route())


def make_workspace_route(lang: str = "en"):
    """Build the workspace handler for one language."""

    def workspace(request: Request) -> HTMLResponse:
        """Every tool on one page, for people who want to chain operations."""
        return render(
            request,
            "workspace.html",
            lang=lang,
            here="workspace",
            page_title=words_for(lang)("workspace.title"),
            page_description=words_for(lang)("workspace.description"),
            canonical=f"{BASE_URL}{languages.path_for(lang, 'workspace')}",
            on_workspace=True,
        )

    workspace.__name__ = f"workspace_{lang}"
    return workspace


route("/workspace", response_class=HTMLResponse)(make_workspace_route())


# The pages that say who runs this and what it does with your files.
#
# Kept as a list because they are all the same shape: a template, a title and
# a description. Writing three near identical handlers would only invite them
# to drift apart.
LEGAL_PAGES = (
    (
        "privacy",
        "privacy.html",
        "Privacy · RetroPDF",
        "What RetroPDF collects, which is almost nothing, and why your files "
        "cannot reach us even if we wanted them.",
    ),
    (
        "terms",
        "terms.html",
        "Terms · RetroPDF",
        "The terms for using RetroPDF: free, as is, and yours to check.",
    ),
    (
        "security",
        "security.html",
        "Security · RetroPDF",
        "How RetroPDF works in your browser, and how to verify that for "
        "yourself rather than taking our word for it.",
    ),
)


def make_page_route(path: str, template: str, title: str, description: str, lang: str = "en"):
    """Build the handler for one static page.

    A factory for the same reason as the tool routes below: each handler has
    to close over its own values rather than share the last of a loop.
    """

    def page(request: Request) -> HTMLResponse:
        # A translated page carries its own title and description; the
        # English only ones use the fixed English pair given here.
        words = words_for(lang)
        translated = f"{path}.title" in words_for("en").keys()
        return render(
            request,
            template,
            lang=lang,
            here=path,
            page_title=words(f"{path}.title") if translated else title,
            page_description=words(f"{path}.description") if translated else description,
            # English only pages have the same text at every address, so the
            # English one is the page search engines should list.
            canonical=f"{BASE_URL}{languages.path_for(languages.DEFAULT.code if languages.english_only(path) else lang, path)}",
            # These pages say what the site does with your files, which is
            # what the Info section covers, so its lamp is the lit one.
            on_info=True,
        )

    page.__name__ = f"page_{lang}_{path}"
    return page


for _path, _template, _title, _description in LEGAL_PAGES:
    route(f"/{_path}", response_class=HTMLResponse)(
        make_page_route(_path, _template, _title, _description)
    )


def make_tool_route(slug: str, lang: str = "en"):
    """Build the handler for one tool page.

    Defined in a factory so each route closes over its own slug rather than
    all of them sharing the last value of a loop variable.
    """

    def tool_page(request: Request) -> HTMLResponse:
        tool = BY_SLUG[slug]
        words = words_for(lang)
        return render(
            request,
            "tool.html",
            lang=lang,
            tool=tool,
            here=tool.slug,
            page_title=words(f"tool.{tool.slug}.title"),
            page_description=words(f"tool.{tool.slug}.description"),
            canonical=f"{BASE_URL}{languages.path_for(lang, tool.slug)}",
            # A tool page is one of the tools, so the Tools lamp is lit.
            on_tools=True,
        )

    return tool_page


for _tool in TOOLS:
    route(f"/{_tool.slug}", response_class=HTMLResponse)(make_tool_route(_tool.slug))


# The same pages again, once per language, at their prefixed addresses.
#
# Separate routes rather than one route reading a header, because the address
# is what a search engine indexes and what a reader copies. A page that serves
# eleven languages at one address is one page as far as Google is concerned,
# and the other ten are invisible.
def register_translated_routes() -> None:
    """Add every page under every language prefix except English.

    English already has its routes above at the plain addresses, which is
    deliberate: those exist and are linked to, so they do not move.
    """
    for language in languages.PREFIXED:
        code = language.code

        route(f"/{code}", response_class=HTMLResponse)(make_home_route(code))
        route(f"/{code}/workspace", response_class=HTMLResponse)(
            make_workspace_route(code)
        )
        for tool in TOOLS:
            route(f"/{code}/{tool.slug}", response_class=HTMLResponse)(
                make_tool_route(tool.slug, code)
            )

        route(f"/{code}/desktop", response_class=HTMLResponse)(
            make_desktop_route(code)
        )

        # Every page, Terms and Security included. Those two keep their text
        # in English, but the menu and footer around it stay in the reader's
        # language, so reading them does not switch the whole site to English.
        for path, template, title, description in LEGAL_PAGES:
            route(f"/{code}/{path}", response_class=HTMLResponse)(
                make_page_route(path, template, title, description, code)
            )


# Development only. Kept out of the sitemap and hidden in production so it
# never appears to users or search engines.
if os.environ.get("RETROPDF_DEV", "").lower() in {"1", "true", "yes"}:

    @route("/bench", response_class=HTMLResponse)
    def bench(request: Request) -> HTMLResponse:
        """Measure where merging actually stops working on this device."""
        return render(
            request,
            "bench.html",
            page_title="RetroPDF memory test",
            page_description="Development page.",
            canonical=f"{BASE_URL}/bench",
        )


def pressed_by_a_person(request: Request) -> bool:
    """Whether this request is somebody clicking the button on this site.

    The button is a plain link, and crawlers follow links. Without this check
    every crawl of every page would add one to the tally.

    Browsers label each navigation with Sec-Fetch headers that a page cannot
    forge: Sec-Fetch-Site says the link was on this site, and Sec-Fetch-User
    says a person activated it rather than a script or a prefetch. Crawlers
    and command line tools do not send them. Nothing here is stored or tells
    one person from another, so it keeps the promise the count makes.

    HEAD never counts: it asks about a page rather than for it.
    """
    return (
        request.method == "GET"
        and request.headers.get("sec-fetch-site") == "same-origin"
        and request.headers.get("sec-fetch-user") == "?1"
    )


def make_desktop_route(lang: str = "en"):
    """Build the desktop app handler for one language."""

    def desktop(request: Request, ask: str = "") -> HTMLResponse:
        """Count somebody asking for a desktop app.

        You arrive here by pressing a button that says it will count you, so
        the counting is something you chose rather than something that
        happened while you were reading. That distinction is the whole reason
        this is a page you go to: the site may not make requests of its own,
        so a button that quietly sent a tally would need `connect-src 'none'`
        relaxed, and being counted without noticing is exactly what this is
        trying to avoid.

        Only a request carrying ?ask=1 counts, which is the link the button
        points at. Reloading drops back to the plain address, so holding F5
        shows the number again without adding to it, and so does sharing the
        link or coming back to it later. The button itself will not offer
        that address a second time, since the browser remembers you asked.

        The number says how many, never who.
        """
        words = words_for(lang)
        counted = ask == "1" and pressed_by_a_person(request)
        return render(
            request,
            "desktop.html",
            lang=lang,
            here="desktop",
            page_title=words("desktop.title"),
            page_description=words("desktop.description"),
            canonical=f"{BASE_URL}{languages.path_for(lang, 'desktop')}",
            asked=interest.record() if counted else interest.read(),
            counted=counted,
            on_info=True,
            # The button that leads here steps aside on this page, since you
            # have already pressed it.
            on_desktop=True,
        )

    desktop.__name__ = f"desktop_{lang}"
    return desktop


route("/desktop", response_class=HTMLResponse)(make_desktop_route())


@route("/favicon.ico", include_in_schema=False)
def favicon() -> FileResponse:
    """Browsers ask for this address whatever the page says.

    Older ones ignore the SVG icon in the markup and request /favicon.ico
    from the root regardless, so serving it here saves a 404 on every visit.
    """
    return FileResponse(
        STATIC_DIR / "favicon.ico",
        media_type="image/x-icon",
        # It changes about never, so there is no reason to ask again.
        headers={"Cache-Control": "public, max-age=604800"},
    )


@route("/robots.txt", response_class=PlainTextResponse)
def robots() -> str:
    """Tell crawlers everything is open, and where the sitemap is.

    Except the button's own address. Following it is how somebody asks for a
    desktop app, and a crawler is not somebody. The server refuses to count a
    crawler anyway (see pressed_by_a_person); this keeps the polite ones from
    trying.
    """
    return (
        "User-agent: *\n"
        "Allow: /\n"
        "Disallow: /*?ask=\n"
        f"\nSitemap: {BASE_URL}/sitemap.xml\n"
    )


@route("/sitemap.xml")
def sitemap() -> PlainTextResponse:
    """List every page, so search engines find the tools without crawling."""
    # Every page worth finding: the home page, each tool, the workspace and
    # the pages describing what the site does with your files. The bench page
    # is deliberately absent, being a development tool.
    # Every page, in every language. A search engine that cannot find the
    # Spanish pages will not index them, and the whole point of publishing
    # them is that they are found.
    pages = (
        [""]
        + [tool.slug for tool in TOOLS]
        + ["workspace"]
        + [path for path, _, _, _ in LEGAL_PAGES]
        + ["desktop"]
    )
    urls = [
        f"{BASE_URL}{languages.path_for(language.code, page)}"
        for language in languages.LANGUAGES
        for page in pages
        # English only pages appear once, under their plain address, rather
        # than eleven times at addresses that do not exist.
        if language.code == languages.DEFAULT.code or not languages.english_only(page)
    ]
    entries = "\n".join(f"  <url><loc>{url}</loc></url>" for url in urls)
    body = (
        '<?xml version="1.0" encoding="UTF-8"?>\n'
        '<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">\n'
        f"{entries}\n"
        "</urlset>\n"
    )
    return PlainTextResponse(body, media_type="application/xml")


# Registered last, once every factory above exists. The translated pages are
# the same handlers as the English ones with a different language bound in,
# so they cannot be built before those are defined.
register_translated_routes()


# --- error pages ---------------------------------------------------------
#
# Without these, a mistyped address gets FastAPI's bare {"detail": "Not
# Found"}, which reads as a broken site rather than a missing page. Each error
# is a page of the site instead: the same plates and type, in the language of
# the address that was asked for, with a way back.

# Errors with words of their own. Anything else gets the general ones.
ERROR_KINDS = {404: "404", 405: "405", 500: "500"}


def _language_of(request: Request) -> str:
    """The language an address was in, judged by its prefix."""
    first = request.url.path.strip("/").split("/", 1)[0]
    return first if first in languages.BY_CODE else languages.DEFAULT.code


def error_page(request: Request, status: int) -> HTMLResponse:
    """The page for one error, keeping the status code."""
    lang = _language_of(request)
    words = words_for(lang)
    kind = ERROR_KINDS.get(status, "other")
    response = render(
        request,
        "error.html",
        lang=lang,
        here="",
        page_title=words(f"error.{kind}.title"),
        page_description=words(f"error.{kind}.heading"),
        canonical=None,
        noindex=True,
        # An error has no versions in other languages to point a search
        # engine at.
        alternates=[],
        status=status,
        kind=kind,
    )
    response.status_code = status
    # A HEAD request asks about the page, not for it.
    if request.method == "HEAD":
        return HTMLResponse(status_code=status, headers=dict(response.headers))
    return response


@app.exception_handler(StarletteHTTPException)
async def http_error(request: Request, exc: StarletteHTTPException):
    # A missing script or stylesheet is asked for by the browser, not a
    # person, so a whole page in reply is only wasted bytes.
    if request.url.path.startswith("/static/"):
        return PlainTextResponse(str(exc.detail), status_code=exc.status_code)
    response = error_page(request, exc.status_code)
    # 405 must say what is allowed.
    for name, value in (exc.headers or {}).items():
        response.headers[name] = value
    return response


@app.exception_handler(Exception)
async def server_error(request: Request, exc: Exception):
    """Something broke while building a page.

    This handler runs outside the middleware that adds the security headers,
    so it adds them itself: an error page without the CSP would be the one
    page on the site allowed to make requests. If even the error page fails,
    a plain sentence is sent rather than nothing.
    """
    try:
        response = error_page(request, 500)
    except Exception:
        response = PlainTextResponse("Something went wrong. Please try again.", status_code=500)
    for name, value in HEADERS.items():
        response.headers[name] = value
    return response
