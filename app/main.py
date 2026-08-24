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
from fastapi.responses import HTMLResponse, PlainTextResponse
from fastapi.staticfiles import StaticFiles
from fastapi.templating import Jinja2Templates

from app.security import SecurityHeaders
from app.tool_art import ART
from app.tools import TOOLS, BY_SLUG

APP_DIR = Path(__file__).resolve().parent
STATIC_DIR = APP_DIR / "static"

# Used for canonical URLs and the sitemap. Set REDPDF_BASE_URL in production.
BASE_URL = os.environ.get("REDPDF_BASE_URL", "http://127.0.0.1:8000").rstrip("/")

app = FastAPI(title="RetroPDF", docs_url=None, redoc_url=None)

# HSTS is only meaningful over HTTPS, so it stays off unless this is running
# behind the production proxy.
app.add_middleware(
    SecurityHeaders,
    hsts=os.environ.get("REDPDF_HTTPS", "").lower() in {"1", "true", "yes"},
    # Development only: stops the browser serving a cached script, which
    # makes a change look as though it did not take effect.
    no_cache=os.environ.get("REDPDF_DEV", "").lower() in {"1", "true", "yes"},
)

app.mount("/static", StaticFiles(directory=STATIC_DIR), name="static")

templates = Jinja2Templates(directory=APP_DIR / "templates")


def render(request: Request, template: str, **context) -> HTMLResponse:
    """Render a page with the values every template needs."""
    return templates.TemplateResponse(
        request=request,
        name=template,
        context={"tools": TOOLS, "art": ART, **context},
    )


@app.get("/", response_class=HTMLResponse)
def home(request: Request) -> HTMLResponse:
    """The home page: what this is, and a way into each tool."""
    return render(
        request,
        "home.html",
        page_title="RetroPDF: PDF tools that never upload your files",
        page_description=(
            "Merge, split, rotate and edit PDFs in your browser. Your files "
            "stay on your device. No account, no limits, no uploads."
        ),
        canonical=f"{BASE_URL}/",
        on_home=True,
        route="snake",
    )


@app.get("/workspace", response_class=HTMLResponse)
def workspace(request: Request) -> HTMLResponse:
    """Every tool on one page, for people who want to chain operations."""
    return render(
        request,
        "workspace.html",
        page_title="RetroPDF workspace: every PDF tool on one page",
        page_description=(
            "Load a PDF once and merge, remove, reorder, rotate or split it "
            "without uploading anything."
        ),
        canonical=f"{BASE_URL}/workspace",
        on_workspace=True,
    )


def make_tool_route(slug: str):
    """Build the handler for one tool page.

    Defined in a factory so each route closes over its own slug rather than
    all of them sharing the last value of a loop variable.
    """

    def tool_page(request: Request) -> HTMLResponse:
        tool = BY_SLUG[slug]
        return render(
            request,
            "tool.html",
            tool=tool,
            start_hint="Choose a file to begin.",
            page_title=tool.title,
            page_description=tool.description,
            canonical=f"{BASE_URL}/{tool.slug}",
        )

    return tool_page


for _tool in TOOLS:
    app.get(f"/{_tool.slug}", response_class=HTMLResponse)(make_tool_route(_tool.slug))


# Development only. Kept out of the sitemap and hidden in production so it
# never appears to users or search engines.
if os.environ.get("REDPDF_DEV", "").lower() in {"1", "true", "yes"}:

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


@app.get("/robots.txt", response_class=PlainTextResponse)
def robots() -> str:
    """Tell crawlers everything is open, and where the sitemap is."""
    return f"User-agent: *\nAllow: /\n\nSitemap: {BASE_URL}/sitemap.xml\n"


@app.get("/sitemap.xml")
def sitemap() -> PlainTextResponse:
    """List every page, so search engines find the tools without crawling."""
    urls = [f"{BASE_URL}/"] + [f"{BASE_URL}/{tool.slug}" for tool in TOOLS]
    entries = "\n".join(f"  <url><loc>{url}</loc></url>" for url in urls)
    body = (
        '<?xml version="1.0" encoding="UTF-8"?>\n'
        '<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">\n'
        f"{entries}\n"
        "</urlset>\n"
    )
    return PlainTextResponse(body, media_type="application/xml")
