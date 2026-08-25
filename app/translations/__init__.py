"""The words of the site, in each language it is published in.

One file per language, each holding the same keys. Templates ask for a key
and get back the words, so a page is written once rather than eleven times
and a change to the layout does not have to be repeated everywhere.

A missing key falls back to English rather than showing a blank or a raw key
name. A half translated language is then a page with some English in it,
which is worse than a finished translation and much better than a broken one.
"""

import json
from functools import lru_cache
from pathlib import Path

HERE = Path(__file__).resolve().parent

# The language every other one falls back to, and the only one guaranteed
# complete.
BASE = "en"


@lru_cache(maxsize=None)
def _load(code: str) -> dict:
    """Read one language file, or nothing if it does not exist yet."""
    try:
        return json.loads((HERE / f"{code}.json").read_text(encoding="utf-8"))
    except (OSError, ValueError):
        # A language listed before its file is written, or a file with a typo
        # in it. English shows through rather than the page breaking.
        return {}


class Words:
    """The words of one language, with English behind it.

    Used from templates as `t("key")`, which reads better in the markup than
    a dictionary lookup and keeps the fallback in one place.
    """

    def __init__(self, code: str) -> None:
        self.code = code
        self._words = _load(code)
        self._base = _load(BASE) if code != BASE else self._words

    def __call__(self, key: str, **fields) -> str:
        """The words for this key, in this language if we have them.

        Any keyword arguments are substituted into the text, so a sentence
        with a number in it stays one translatable sentence rather than being
        glued together from pieces in an order that only suits English.
        """
        text = self._words.get(key) or self._base.get(key) or key
        if fields:
            try:
                return text.format(**fields)
            except (KeyError, IndexError):
                # A translation whose placeholders do not match the English.
                # Showing the untranslated line beats showing an error.
                return self._base.get(key, key).format(**fields)
        return text

    def has(self, key: str) -> bool:
        """Whether this language has its own words for this key."""
        return key in self._words


@lru_cache(maxsize=None)
def words_for(code: str) -> Words:
    """The Words for one language, built once and reused."""
    return Words(code)
