"""The languages the site is published in.

Each language gets its own set of addresses, because that is what search
engines index and what people link to. English keeps the plain addresses it
already has, so nothing that exists today moves:

    /merge-pdf          English
    /es/merge-pdf       Spanish
    /zh/merge-pdf       Chinese

Keeping English where it is matters more than tidiness. Addresses that have
been linked to or indexed should not change, and moving them all under /en/
would break every one of them for no gain.
"""

from dataclasses import dataclass


@dataclass(frozen=True)
class Language:
    """One language the site is published in."""

    code: str
    """The short code used in addresses and in the html lang attribute."""

    name: str
    """What the language calls itself, which is what a reader looking for it
    will recognise. A Spanish speaker scanning a list wants "Espanol", not
    "Spanish"."""

    locale: str
    """The full code for hreflang, which wants a region for some languages."""

    rtl: bool = False
    """Written right to left. None of the current languages are, but the flag
    is here so adding Arabic later is a data change rather than a code one."""


# Ordered by how many people the language reaches, since that is the order a
# reader is most likely to find their own in.
LANGUAGES = (
    Language("en", "English", "en"),
    Language("zh", "中文", "zh-Hans"),
    Language("hi", "हिन्दी", "hi"),
    Language("es", "Español", "es"),
    Language("fr", "Français", "fr"),
    Language("pt", "Português", "pt"),
    Language("de", "Deutsch", "de"),
    Language("ja", "日本語", "ja"),
    Language("ko", "한국어", "ko"),
    Language("sv", "Svenska", "sv"),
    Language("fi", "Suomi", "fi"),
)

BY_CODE = {language.code: language for language in LANGUAGES}

DEFAULT = LANGUAGES[0]

# Every code except English, which is the one without a prefix.
PREFIXED = tuple(language for language in LANGUAGES if language.code != DEFAULT.code)


def path_for(code: str, path: str = "") -> str:
    """The address of a page in one language.

    English keeps the bare address and everything else is prefixed, so this is
    the single place that rule is written down.
    """
    path = path.lstrip("/")
    if code == DEFAULT.code:
        return f"/{path}" if path else "/"
    return f"/{code}/{path}" if path else f"/{code}"


# Pages that stay in English whatever language the reader is in.
#
# Two reasons, and they are different. The legal pages carry weight: a
# mistranslated privacy policy or set of terms is a liability, and publishing
# eleven versions nobody can verify is worse than publishing one that is
# right. The rest simply gain nothing, since nobody arrives at a privacy
# policy from a search engine.
#
# Translating the tools, the home page and the interface captures nearly all
# the search value for about a third of the words.
ENGLISH_ONLY = frozenset({"privacy", "terms", "security", "desktop"})


def english_only(page: str) -> bool:
    """Whether this page is published in English alone."""
    return page.strip("/") in ENGLISH_ONLY

