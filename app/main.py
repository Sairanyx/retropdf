"""RedPdf web server.

Serves the HTML pages and the static files. It never receives or processes a
PDF and all of that happens in the browser.
"""

from pathlib import Path

from fastapi import FastAPI
from fastapi.responses import FileResponse
from fastapi.staticfiles import StaticFiles

STATIC_DIR = Path(__file__).resolve().parent / "static"

app = FastAPI(title="RedPDF")

app.mount("/static", StaticFiles(directory=STATIC_DIR), name="static")


@app.get("/")
def home() -> FileResponse:
    """Serves the workspace page"""
    return FileResponse(STATIC_DIR / "index.html")

