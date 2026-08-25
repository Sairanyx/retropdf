"""The language list and the translation store.

These are the foundation the translated pages sit on: if a key falls through
or an address is built wrongly, every page in that language is affected.
"""

import json
from pathlib import Path

import pytest

from app import languages
from app.translations import HERE, words_for


def test_english_keeps_the_plain_addresses():
    """Addresses that already exist must not move.

    They have been linked to and indexed. Putting English under /en/ would
    break every one of them for no gain.
    """
    assert languages.path_for("en", "merge-pdf") == "/merge-pdf"
    assert languages.path_for("en") == "/"


def test_other_languages_are_prefixed():
    assert languages.path_for("es", "merge-pdf") == "/es/merge-pdf"
    assert languages.path_for("zh") == "/zh"


def test_every_language_has_a_distinct_code():
    codes = [language.code for language in languages.LANGUAGES]
    assert len(codes) == len(set(codes))


def test_english_is_the_default():
    assert languages.DEFAULT.code == "en"
    assert "en" not in [language.code for language in languages.PREFIXED]


def test_a_language_names_itself():
    """A reader scanning the list looks for their own language's name for
    itself, not the English word for it."""
    assert languages.BY_CODE["de"].name == "Deutsch"
    assert languages.BY_CODE["es"].name == "Español"


def test_words_come_back_for_a_known_key():
    assert words_for("en")("nav.tools") == "Tools"


def test_a_missing_language_falls_back_to_english():
    """A language listed before its file exists shows English rather than
    breaking every page in it."""
    assert words_for("xx")("nav.tools") == "Tools"


def test_numbers_are_substituted_into_the_sentence():
    """The number sits inside a translatable sentence rather than being glued
    on, since word order differs by language."""
    said = words_for("en")("desktop.how_many", count="42")
    assert "42" in said


def test_every_translation_file_is_valid_json():
    for path in HERE.glob("*.json"):
        json.loads(path.read_text(encoding="utf-8"))


def test_no_translation_has_keys_english_does_not():
    """A key only in a translation is a typo: nothing will ever read it."""
    english = set(json.loads((HERE / "en.json").read_text(encoding="utf-8")))
    for path in HERE.glob("*.json"):
        if path.stem == "en":
            continue
        extra = set(json.loads(path.read_text(encoding="utf-8"))) - english
        assert not extra, f"{path.name} has keys English does not: {sorted(extra)}"


# --- the pages themselves ------------------------------------------------


from fastapi.testclient import TestClient  # noqa: E402

from app.main import app  # noqa: E402

client = TestClient(app)


def test_english_addresses_still_work():
    """The addresses that existed before the translations must not move."""
    for path in ("/", "/merge-pdf", "/workspace", "/privacy", "/desktop"):
        assert client.get(path).status_code == 200, path


def test_every_language_serves_every_page():
    for language in languages.PREFIXED:
        for page in ("", "merge-pdf", "workspace", "privacy"):
            path = languages.path_for(language.code, page)
            assert client.get(path).status_code == 200, path


def test_a_translated_page_declares_its_language():
    """The lang attribute is how a browser and a screen reader know which
    language they are reading, and how a search engine confirms it."""
    assert '<html lang="es"' in client.get("/es/merge-pdf").text
    assert '<html lang="ja"' in client.get("/ja/merge-pdf").text


def test_pages_point_at_their_other_languages():
    """Without hreflang a search engine treats the eleven versions as rival
    copies of one page and shows only one of them."""
    body = client.get("/es/merge-pdf").text
    assert body.count('rel="alternate"') == len(languages.LANGUAGES) + 1
    assert 'hreflang="x-default"' in body
    # Each one points at the same page, not at the home page.
    assert "/merge-pdf" in body
    assert "/zh/merge-pdf" in body


def test_untranslated_words_fall_back_to_english():
    """A language with no file yet reads as English rather than as blanks."""
    body = client.get("/sv/merge-pdf").text
    assert "Tools" in body or "Workspace" in body


def test_the_sitemap_lists_every_language():
    body = client.get("/sitemap.xml").text
    for language in languages.LANGUAGES:
        path = languages.path_for(language.code, "merge-pdf")
        assert f"{path}<" in body, path
