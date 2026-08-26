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
    # Red with the yellow stars reduced to a corner of gold.
    Language("zh", "中文", "zh-Hans"),
    # Saffron, white, green.
    Language("hi", "हिन्दी", "hi"),
    # Red, gold, red.
    Language("es", "Español", "es"),
    # Blue, white, red.
    Language("fr", "Français", "fr"),
    # Green and red, divided vertically.
    Language("pt", "Português", "pt"),
    # Black, red, gold.
    Language("de", "Deutsch", "de"),
    # White with the red disc.
    Language("ja", "日本語", "ja"),
    # White with the red and blue taegeuk.
    Language("ko", "한국어", "ko"),
    # Blue with the gold cross.
    Language("sv", "Svenska", "sv"),
    # White with the blue cross.
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
# The three pages where a wrong word costs something.
#
# Terms is a contract and says plainly that English governs it, so eleven
# versions nobody can verify would create the exact ambiguity it exists to
# avoid. Security describes the policy header precisely enough that a loose
# translation would misstate what the site does. Privacy names a person, a
# country and a set of rights, and a translation of it that nobody here can
# check is worse than an English one everybody can.
#
# The footer says so beside the link, in the reader's own language, rather
# than letting them find out after following it.
ENGLISH_ONLY = frozenset({"privacy", "terms", "security"})


def english_only(page: str) -> bool:
    """Whether this page is published in English alone."""
    return page.strip("/") in ENGLISH_ONLY

