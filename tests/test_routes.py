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

client = TestClient(app)


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
    assert f"<title>{tool.title}</title>" in response.text
    assert tool.description in response.text


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
    titles = {tool.title for tool in TOOLS}
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

    client.get("/desktop?ask=1")
    assert interest.read() == before + 1, "pressing the button did not count"


def test_the_desktop_page_shows_the_number():
    """The number is on the page rather than only in a file somewhere, which
    is what lets a reader check the claim the privacy page makes.

    Asked twice, since one is written out as a word rather than a figure.
    """
    client.get("/desktop?ask=1")
    client.get("/desktop?ask=1")
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
