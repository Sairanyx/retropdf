"""Tests for the pages the server hands out.

The server does no PDF work, so these check what it is actually responsible
for: that every tool has a reachable URL, that each page carries the title and
description search engines will show, and that the browser code is told which
tool it is running.
"""

import pytest
from fastapi.testclient import TestClient

from app.main import app
from app.tools import TOOLS

client = TestClient(app)


def test_home_page_loads():
    response = client.get("/")
    assert response.status_code == 200
    assert "Work with PDFs" in response.text


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
