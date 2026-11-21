"""Tests for the pages the server hands out.

The server does no PDF work, so these check what it is actually responsible
for: that every tool has a reachable URL, that each page carries the title and
description search engines will show, and that the browser code is told which
tool it is running.
"""

import pytest
from fastapi.testclient import TestClient

from app.main import app
from app import interest
from app.tools import TOOLS
from app.translations import words_for

client = TestClient(app)

# What a browser sends when a person clicks a link on this site. The desktop
# app counter only counts a request carrying these, so a crawler cannot.
CLICK = {"sec-fetch-site": "same-origin", "sec-fetch-user": "?1"}


def test_home_page_loads():
    """The home page renders and carries a heading.

    Checking for a heading rather than its wording, so rewriting the copy
    does not break the test. What matters is that the page has one.
    """
    response = client.get("/")
    assert response.status_code == 200
    assert "<h1" in response.text


def test_home_links_to_every_tool():
    response = client.get("/")
    for tool in TOOLS:
        assert f'href="/{tool.slug}"' in response.text


@pytest.mark.parametrize("tool", TOOLS, ids=lambda tool: tool.slug)
def test_tool_page_loads(tool):
    response = client.get(f"/{tool.slug}")
    assert response.status_code == 200


@pytest.mark.parametrize("tool", TOOLS, ids=lambda tool: tool.slug)
def test_tool_page_has_its_own_title_and_description(tool):
    """Each page must be distinct, or search engines have nothing to rank."""
    response = client.get(f"/{tool.slug}")
    words = words_for("en")
    assert f"<title>{words(f'tool.{tool.slug}.title')}</title>" in response.text
    assert words(f"tool.{tool.slug}.description") in response.text


@pytest.mark.parametrize("tool", TOOLS, ids=lambda tool: tool.slug)
def test_tool_page_tells_the_browser_which_tool_it_is(tool):
    """The page states its mode so the script cannot disagree with the URL."""
    response = client.get(f"/{tool.slug}")
    assert f'data-mode="{tool.mode}"' in response.text


@pytest.mark.parametrize("tool", TOOLS, ids=lambda tool: tool.slug)
def test_tool_page_has_a_canonical_url(tool):
    response = client.get(f"/{tool.slug}")
    assert f'rel="canonical"' in response.text
    assert f"/{tool.slug}" in response.text


def test_every_tool_page_has_a_different_title():
    titles = {words_for("en")(f"tool.{tool.slug}.title") for tool in TOOLS}
    assert len(titles) == len(TOOLS)


def test_workspace_offers_every_tool():
    response = client.get("/workspace")
    assert response.status_code == 200
    for tool in TOOLS:
        assert f'value="{tool.mode}"' in response.text


def test_unknown_page_is_not_found():
    assert client.get("/no-such-tool").status_code == 404


def test_robots_points_at_the_sitemap():
    response = client.get("/robots.txt")
    assert response.status_code == 200
    assert "Sitemap:" in response.text


def test_sitemap_lists_every_page():
    response = client.get("/sitemap.xml")
    assert response.status_code == 200
    for tool in TOOLS:
        assert f"/{tool.slug}</loc>" in response.text


# --- security headers --------------------------------------------------


def test_pages_forbid_all_outbound_requests():
    """connect-src 'none' is what makes the privacy claim enforceable."""
    csp = client.get("/").headers["content-security-policy"]
    assert "connect-src 'none'" in csp


def test_pages_allow_no_third_party_scripts_or_eval():
    csp = client.get("/").headers["content-security-policy"]
    assert "script-src 'self'" in csp
    assert "unsafe-eval" not in csp
    assert "unsafe-inline" not in csp


def test_pages_cannot_be_framed():
    headers = client.get("/").headers
    assert "frame-ancestors 'none'" in headers["content-security-policy"]
    assert headers["x-frame-options"] == "DENY"


def test_pages_do_not_sniff_content_types():
    assert client.get("/").headers["x-content-type-options"] == "nosniff"


def test_hsts_is_off_without_https():
    """Pinning localhost to HTTPS would break local development."""
    assert "strict-transport-security" not in client.get("/").headers


def test_every_tool_page_carries_the_headers():
    for tool in TOOLS:
        headers = client.get(f"/{tool.slug}").headers
        assert "connect-src 'none'" in headers["content-security-policy"]


# --- the pages that say what the site does with your files ---------------
#
# These matter as much as the tools. A site handling documents with no
# privacy policy reads as one that has not thought about privacy, whatever
# the code does, so a broken route here is not a cosmetic problem.


def test_the_legal_pages_are_reachable():
    for path in ("privacy", "terms", "security"):
        assert client.get(f"/{path}").status_code == 200


def test_the_legal_pages_carry_the_headers():
    """They are ordinary pages of the site, not an exception to it."""
    for path in ("privacy", "terms", "security"):
        headers = client.get(f"/{path}").headers
        assert "connect-src 'none'" in headers["content-security-policy"]


def test_the_privacy_page_says_what_is_stored():
    """If the wording drifts away from the facts, this should fail."""
    body = client.get("/privacy").text
    assert "connect-src" not in body or "security" in body
    for phrase in ("never sent to us", "No cookies", "hello@retropdf.com"):
        assert phrase in body


@pytest.fixture(autouse=True)
def _counter_in_a_temporary_file(tmp_path, monkeypatch):
    """Keep the tests off the real tally.

    Counting is a file write, and a test run should not leave a number behind
    or add to a real one.
    """
    monkeypatch.setattr(interest, "COUNT_FILE", tmp_path / "interest.count")


def test_only_pressing_the_button_counts():
    """Reading the page must not add to the number.

    The button links to ?ask=1 and nothing else does, so a reload, a shared
    link or a search engine looking at the page all leave the count alone.
    Without this, the number would follow how long somebody held F5 rather
    than how many people wanted the thing.
    """
    before = interest.read()

    client.get("/desktop")
    client.get("/desktop")
    assert interest.read() == before, "reading the page counted somebody"

    client.get("/desktop?ask=1", headers=CLICK)
    assert interest.read() == before + 1, "pressing the button did not count"


def test_the_desktop_page_shows_the_number():
    """The number is on the page rather than only in a file somewhere, which
    is what lets a reader check the claim the privacy page makes.

    Asked twice, since one is written out as a word rather than a figure.
    """
    client.get("/desktop?ask=1", headers=CLICK)
    client.get("/desktop?ask=1", headers=CLICK)
    body = client.get("/desktop").text
    assert 'class="tally"' in body
    assert "2" in body


def test_the_desktop_page_sends_nothing():
    """The whole design rests on the page being an ordinary read.

    No form, no upload, and the same refusal to make requests that every
    other page carries. If a form ever appears here, this fails.
    """
    page = client.get("/desktop")
    assert "connect-src 'none'" in page.headers["content-security-policy"]
    assert "<form" not in page.text
    assert "<input" not in page.text


def test_the_privacy_page_points_at_the_counted_page():
    """The site's argument is that anything kept is named and checkable."""
    body = client.get("/privacy").text
    assert 'href="/desktop"' in body


def test_the_security_page_quotes_the_real_policy():
    """The page tells people to check a header, so it has to name the one
    the server actually sends."""
    quoted = "connect-src 'none'"
    assert quoted in client.get("/security").text
    assert quoted in client.get("/security").headers["content-security-policy"]


def test_the_icon_is_served_from_the_root():
    """Browsers ask for /favicon.ico whatever the markup says, so serving it
    there saves a 404 on every visit from an older one."""
    response = client.get("/favicon.ico")
    assert response.status_code == 200
    assert response.headers["content-type"] == "image/x-icon"


def test_pages_carry_a_share_image():
    """A link with no image draws a blank grey box in most apps, which reads
    as broken. This site asks people to trust it with documents, so a link to
    it should not look untrustworthy."""
    body = client.get("/").text
    assert 'property="og:image"' in body
    assert 'name="twitter:card"' in body
    # Absolute, since a scraper has no page to resolve a relative one against.
    assert 'content="http' in body.split('og:image"')[1][:60]


def test_the_share_image_is_our_own():
    """Served from here like everything else, not from an image host."""
    assert client.get("/static/share.png").status_code == 200
    assert "/static/share.png" in client.get("/").text


def test_the_sitemap_lists_every_page():
    body = client.get("/sitemap.xml").text
    for path in ("workspace", "privacy", "terms", "security", "desktop"):
        assert f"/{path}<" in body
    for tool in TOOLS:
        assert f"/{tool.slug}<" in body


def test_the_bench_page_stays_out_of_the_sitemap():
    """A development tool has no business in search results."""
    assert "/bench<" not in client.get("/sitemap.xml").text


def test_the_footer_links_to_the_legal_pages():
    """Reachable in the browser, not merely present on the server."""
    body = client.get("/").text
    for path in ("privacy", "terms", "security"):
        assert f'href="/{path}"' in body


# --- the counter cannot be inflated by machines -------------------------


@pytest.mark.parametrize(
    "headers",
    [
        {},  # a crawler or curl: no fetch metadata at all
        {"sec-fetch-site": "cross-site", "sec-fetch-user": "?1"},  # linked from elsewhere
        {"sec-fetch-site": "none", "sec-fetch-user": "?1"},  # typed or bookmarked
        {"sec-fetch-site": "same-origin"},  # not activated by a person
    ],
)
def test_only_a_click_on_this_site_counts(headers):
    before = interest.read()
    page = client.get("/desktop?ask=1", headers=headers)
    assert page.status_code == 200
    assert interest.read() == before
    assert 'data-counted="1"' not in page.text


def test_a_click_counts_in_every_language():
    before = interest.read()
    client.get("/es/desktop?ask=1", headers=CLICK)
    assert interest.read() == before + 1


def test_head_never_counts():
    before = interest.read()
    client.head("/desktop?ask=1", headers=CLICK)
    assert interest.read() == before


def test_crawlers_are_asked_not_to_follow_the_button():
    assert "Disallow: /*?ask=" in client.get("/robots.txt").text
    body = client.get("/").text
    assert 'href="/desktop?ask=1" rel="nofollow"' in body


# --- HEAD ---------------------------------------------------------------


@pytest.mark.parametrize(
    "path",
    ["/", "/merge-pdf", "/es/merge-pdf", "/workspace", "/privacy", "/desktop",
     "/robots.txt", "/sitemap.xml", "/favicon.ico", "/static/css/app.css"],
)
def test_head_is_answered_like_get(path):
    """curl -I, uptime monitors and some crawlers ask with HEAD."""
    response = client.head(path)
    assert response.status_code == 200
    assert response.content == b""
    if not path.startswith("/static/") and path != "/favicon.ico":
        assert "connect-src 'none'" in response.headers["content-security-policy"]


# --- caching ------------------------------------------------------------


def test_scripts_are_checked_for_changes_on_every_visit():
    """File names do not change between deploys, so a long cache would keep
    visitors on old code. no-cache keeps the file but asks first."""
    for path in ("/static/js/app.js", "/static/css/app.css", "/static/js/vendor/pdf.min.mjs"):
        assert client.get(path).headers["cache-control"] == "no-cache"


def test_an_unchanged_script_is_not_downloaded_again():
    """What makes no-cache cheap: the browser asks, and gets an empty 304."""
    first = client.get("/static/js/app.js")
    again = client.get("/static/js/app.js", headers={"if-none-match": first.headers["etag"]})
    assert again.status_code == 304


def test_fonts_are_cached_for_a_bounded_time():
    headers = client.get("/static/fonts/ibm-plex-mono-latin-400-normal.woff2").headers
    assert headers["cache-control"] == "public, max-age=604800"


def test_the_privacy_page_lists_everything_the_browser_keeps():
    """The scripts keep four things. If one is added, the page must say so."""
    body = client.get("/privacy").text
    assert "Four small notes" in body
    for phrase in ("opening animation", "tabs of this site", "scrolled to", "desktop app"):
        assert phrase in body


# --- error pages --------------------------------------------------------


def test_a_missing_page_is_a_page_of_the_site():
    response = client.get("/no-such-tool")
    assert response.status_code == 404
    assert response.headers["content-type"].startswith("text/html")
    assert "This page is not here." in response.text
    assert 'name="robots" content="noindex"' in response.text
    assert 'rel="canonical"' not in response.text
    assert "connect-src 'none'" in response.headers["content-security-policy"]


def test_a_missing_page_speaks_the_language_of_its_address():
    from app.translations import words_for

    body = client.get("/fi/no-such-tool").text
    assert words_for("fi")("error.404.heading") in body
    assert 'lang="fi"' in body


def test_sending_to_a_page_says_it_accepts_nothing():
    response = client.post("/merge-pdf", content=b"x")
    assert response.status_code == 405
    assert "GET" in response.headers["allow"]
    assert "This address only hands out pages." in response.text


def test_head_of_a_missing_page_is_empty():
    response = client.head("/no-such-tool")
    assert response.status_code == 404
    assert response.content == b""


def test_a_missing_script_is_not_answered_with_a_whole_page():
    response = client.get("/static/js/no-such-file.js")
    assert response.status_code == 404
    assert "<html" not in response.text


def test_a_crash_still_carries_the_security_headers():
    """The 500 handler runs outside the middleware that adds them."""

    def boom():
        raise RuntimeError("deliberate")

    app.add_api_route("/__boom-for-tests", boom)
    try:
        crashing = TestClient(app, raise_server_exceptions=False)
        response = crashing.get("/__boom-for-tests")
    finally:
        app.router.routes.pop()
    assert response.status_code == 500
    assert "Something went wrong on our side." in response.text
    assert "deliberate" not in response.text
    assert "connect-src 'none'" in response.headers["content-security-policy"]
