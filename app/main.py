"""RetroPDF web server.

Serves the HTML pages and the static files. It never receives or processes a
PDF: that happens entirely in the browser, so there is no upload endpoint and
nothing here ever touches a user's document.

Each tool gets its own URL so that someone searching for one specific job
lands on a page about that job. All of them render the same template with a
different tool selected.
"""

import os
from pathlib import Path

from fastapi import FastAPI, Request
from fastapi.responses import FileResponse, HTMLResponse, PlainTextResponse
from fastapi.staticfiles import StaticFiles
from fastapi.templating import Jinja2Templates

from app import interest, languages
from app.security import SecurityHeaders
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
            # Every language this page exists in, for the hreflang tags that
            # tell a search engine these are the same page rather than
            # duplicates competing with each other.
            # An English only page has no alternates: claiming versions that
            # do not exist makes a search engine follow links to nothing.
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


app.get("/", response_class=HTMLResponse)(make_home_route())


def make_workspace_route(lang: str = "en"):
    """Build the workspace handler for one language."""

    def workspace(request: Request) -> HTMLResponse:
        """Every tool on one page, for people who want to chain operations."""
        return render(
            request,
            "workspace.html",
            lang=lang,
            here="workspace",
            page_title="Workspace · RetroPDF",
            page_description=(
                "Load a PDF once and merge, remove, reorder, rotate or split "
                "it without uploading anything."
            ),
            canonical=f"{BASE_URL}{languages.path_for(lang, 'workspace')}",
            on_workspace=True,
        )

    workspace.__name__ = f"workspace_{lang}"
    return workspace


app.get("/workspace", response_class=HTMLResponse)(make_workspace_route())


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
        return render(
            request,
            template,
            lang=lang,
            here=path,
            page_title=title,
            page_description=description,
            canonical=f"{BASE_URL}{languages.path_for(lang, path)}",
            # These pages say what the site does with your files, which is
            # what the Info section covers, so its lamp is the lit one.
            on_info=True,
        )

    page.__name__ = f"page_{lang}_{path}"
    return page


for _path, _template, _title, _description in LEGAL_PAGES:
    app.get(f"/{_path}", response_class=HTMLResponse)(
        make_page_route(_path, _template, _title, _description)
    )


def make_tool_route(slug: str, lang: str = "en"):
    """Build the handler for one tool page.

    Defined in a factory so each route closes over its own slug rather than
    all of them sharing the last value of a loop variable.
    """

    def tool_page(request: Request) -> HTMLResponse:
        tool = BY_SLUG[slug]
        return render(
            request,
            "tool.html",
            lang=lang,
            tool=tool,
            here=tool.slug,
            page_title=tool.title,
            page_description=tool.description,
            canonical=f"{BASE_URL}{languages.path_for(lang, tool.slug)}",
            # A tool page is one of the tools, so the Tools lamp is lit.
            on_tools=True,
        )

    return tool_page


for _tool in TOOLS:
    app.get(f"/{_tool.slug}", response_class=HTMLResponse)(make_tool_route(_tool.slug))


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

        app.get(f"/{code}", response_class=HTMLResponse)(make_home_route(code))
        app.get(f"/{code}/workspace", response_class=HTMLResponse)(
            make_workspace_route(code)
        )
        for tool in TOOLS:
            app.get(f"/{code}/{tool.slug}", response_class=HTMLResponse)(
                make_tool_route(tool.slug, code)
            )

        # The legal pages and the desktop page are English only, so they get
        # no prefixed address. A reader following a link to one leaves their
        # language for that page, which is honest: there is no translation to
        # send them to.


# Development only. Kept out of the sitemap and hidden in production so it
# never appears to users or search engines.
if os.environ.get("RETROPDF_DEV", "").lower() in {"1", "true", "yes"}:

    @app.get("/bench", response_class=HTMLResponse)
    def bench(request: Request) -> HTMLResponse:
        """Measure where merging actually stops working on this device."""
        return render(
            request,
            "bench.html",
            page_title="RetroPDF memory test",
            page_description="Development page.",
            canonical=f"{BASE_URL}/bench",
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
        counted = ask == "1"
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


app.get("/desktop", response_class=HTMLResponse)(make_desktop_route())


@app.get("/favicon.ico", include_in_schema=False)
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


@app.get("/robots.txt", response_class=PlainTextResponse)
def robots() -> str:
    """Tell crawlers everything is open, and where the sitemap is."""
    return f"User-agent: *\nAllow: /\n\nSitemap: {BASE_URL}/sitemap.xml\n"


@app.get("/sitemap.xml")
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
