"""RedPDF web server.

Serves the HTML pages and the static files. It never receives or processes a
PDF: that happens entirely in the browser, so there is no upload endpoint and
nothing here ever touches a user's document.

Each tool gets its own URL so that someone searching for one specific job
lands on a page about that job. All of them render the same template with a
different tool selected.
"""

from pathlib import Path

from fastapi import FastAPI, Request
from fastapi.responses import HTMLResponse, PlainTextResponse
from fastapi.staticfiles import StaticFiles
from fastapi.templating import Jinja2Templates

from app.tools import TOOLS, BY_SLUG

APP_DIR = Path(__file__).resolve().parent
STATIC_DIR = APP_DIR / "static"

# Used for canonical URLs and the sitemap. Set REDPDF_BASE_URL in production.
import os

BASE_URL = os.environ.get("REDPDF_BASE_URL", "http://127.0.0.1:8000").rstrip("/")

app = FastAPI(title="RedPDF", docs_url=None, redoc_url=None)
app.mount("/static", StaticFiles(directory=STATIC_DIR), name="static")

templates = Jinja2Templates(directory=APP_DIR / "templates")


def render(request: Request, template: str, **context) -> HTMLResponse:
    """Render a page with the values every template needs."""
    return templates.TemplateResponse(
        request=request,
        name=template,
        context={"tools": TOOLS, **context},
    )


@app.get("/", response_class=HTMLResponse)
def home(request: Request) -> HTMLResponse:
    """The home page: what this is, and a way into each tool."""
    return render(
        request,
        "home.html",
        page_title="RedPDF: PDF tools that never upload your files",
        page_description=(
            "Merge, split, rotate and edit PDFs in your browser. Your files "
            "stay on your device. No account, no limits, no uploads."
        ),
        canonical=f"{BASE_URL}/",
    )


@app.get("/workspace", response_class=HTMLResponse)
def workspace(request: Request) -> HTMLResponse:
    """Every tool on one page, for people who want to chain operations."""
    return render(
        request,
        "workspace.html",
        page_title="RedPDF workspace: every PDF tool on one page",
        page_description=(
            "Load a PDF once and merge, remove, reorder, rotate or split it "
            "without uploading anything."
        ),
        canonical=f"{BASE_URL}/workspace",
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
