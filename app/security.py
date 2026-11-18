"""Security headers sent with every response.

The important one is the Content Security Policy. `connect-src 'none'` tells
the browser to refuse every outbound request the page might make: fetch, XHR,
WebSocket, beacon. That turns "we do not upload your files" from a promise
into a rule the browser enforces and anyone can verify by reading one header.

It also means this site can never carry analytics, ad scripts, third party
fonts or error reporting. That is a deliberate trade, not an oversight.
"""

from starlette.middleware.base import BaseHTTPMiddleware
from starlette.types import ASGIApp

# Built as a list so each line can carry its reason.
CSP = "; ".join(
    (
        # Nothing loads unless a rule below allows it.
        "default-src 'self'",
        # THE important line: no network requests may leave the page.
        "connect-src 'none'",
        # Our own scripts only. No CDN, no inline script, no eval. The last
        # two also close off the class of bug behind CVE-2024-4367 in pdf.js.
        "script-src 'self'",
        # Workers are scripts too, and pdf.js starts one of its own.
        "worker-src 'self' blob:",
        # blob: is needed because finished PDFs are handed to the user as an
        # in memory blob URL. data: covers small inline images.
        "img-src 'self' blob: data:",
        # Our own stylesheets only.
        "style-src 'self'",
        # Fonts are served from here, never from a font host.
        "font-src 'self'",
        # No <object> or <embed> at all.
        "object-src 'none'",
        # Downloads are created as blob URLs by the page itself.
        "frame-src 'none'",
        # Nobody may put this site inside an iframe, which blocks clickjacking.
        "frame-ancestors 'none'",
        # A stray <base> tag cannot redirect relative URLs elsewhere.
        "base-uri 'self'",
        # There are no forms that post anywhere.
        "form-action 'none'",
    )
)

HEADERS = {
    "Content-Security-Policy": CSP,
    # Trust the declared content type instead of guessing, which stops a file
    # being treated as script because its contents look like one.
    "X-Content-Type-Options": "nosniff",
    # Send the page address to other sites only over HTTPS, and never the path.
    "Referrer-Policy": "strict-origin-when-cross-origin",
    # Turn off device features this site never uses.
    "Permissions-Policy": (
        "camera=(), microphone=(), geolocation=(), payment=(), usb=()"
    ),
    # Belt and braces alongside frame-ancestors, for older browsers.
    "X-Frame-Options": "DENY",
}


def static_cache_control(path: str, development: bool = False) -> str:
    """How long a browser may keep a static file without asking again.

    The file names never change between deploys: app.js is /static/js/app.js
    in every version, and the scripts import each other by those fixed
    names. So nothing may be cached on trust for long, or a deploy reaches
    visitors only when their cache happens to expire, and a fix to the code
    handling their files arrives weeks late.

    "no-cache" does not mean "do not cache". The browser keeps the file and
    asks each time whether it changed; the answer is usually an empty 304,
    which costs a round trip and no download.

    Fonts are the exception. They do not change in practice, and asking again
    on every page makes the headings flash in the fallback typeface first.
    A week bounds how long an unlikely change could take to arrive.

    In development the browser must never serve a cached script or
    stylesheet, or a change appears not to have taken effect.
    """
    if path.startswith("/static/fonts/"):
        return "public, max-age=604800"
    if development:
        return "no-store, must-revalidate"
    return "no-cache"


class SecurityHeaders(BaseHTTPMiddleware):
    """Attach the headers above to every response."""

    def __init__(
        self, app: ASGIApp, hsts: bool = False, no_cache: bool = False
    ) -> None:
        super().__init__(app)
        self.hsts = hsts
        self.no_cache = no_cache

    async def dispatch(self, request, call_next):
        response = await call_next(request)
        for name, value in HEADERS.items():
            response.headers[name] = value

        if request.url.path.startswith("/static/"):
            response.headers["Cache-Control"] = static_cache_control(
                request.url.path, self.no_cache
            )

        # Only meaningful over HTTPS, and actively unhelpful in local
        # development, where it would pin localhost to HTTPS in your browser.
        if self.hsts:
            response.headers["Strict-Transport-Security"] = (
                "max-age=31536000; includeSubDomains"
            )

        return response
