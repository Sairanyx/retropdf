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

    lamp: str = "#c8452a"
    """The lamp's colours in the picker, as a CSS gradient.

    Taken from the flag most associated with the language, so the lamp hints
    at which language a row is before you read the word. A gradient rather
    than an image: a real flag would not survive being drawn as a small
    circle in a pixel typeface, while its colours still read as themselves."""


# Ordered by how many people the language reaches, since that is the order a
# reader is most likely to find their own in.
# The gradients are written as hard stops rather than blends, so a tricolour
# reads as three bands rather than a smear. Vertical bands for flags that
# have them, horizontal for the rest, which is the quickest way to tell two
# similar palettes apart at this size.
LANGUAGES = (
    # Union flag: blue ground, white and red cross.
    Language("en", "English", "en",
             lamp="linear-gradient(135deg, #012169 0 38%, #ffffff 38% 50%, #c8102e 50% 62%, #012169 62%)"),
    # Red with the yellow stars reduced to a corner of gold.
    Language("zh", "中文", "zh-Hans",
             lamp="radial-gradient(circle at 32% 34%, #ffde00 0 26%, #de2910 26%)"),
    # Saffron, white, green.
    Language("hi", "हिन्दी", "hi",
             lamp="linear-gradient(#ff9933 0 33%, #ffffff 33% 67%, #138808 67%)"),
    # Red, gold, red.
    Language("es", "Español", "es",
             lamp="linear-gradient(#aa151b 0 27%, #f1bf00 27% 73%, #aa151b 73%)"),
    # Blue, white, red.
    Language("fr", "Français", "fr",
             lamp="linear-gradient(90deg, #0055a4 0 33%, #ffffff 33% 67%, #ef4135 67%)"),
    # Green and red, divided vertically.
    Language("pt", "Português", "pt",
             lamp="linear-gradient(90deg, #046a38 0 40%, #da291c 40%)"),
    # Black, red, gold.
    Language("de", "Deutsch", "de",
             lamp="linear-gradient(#000000 0 33%, #dd0000 33% 67%, #ffce00 67%)"),
    # White with the red disc.
    Language("ja", "日本語", "ja",
             lamp="radial-gradient(circle at 50% 50%, #bc002d 0 42%, #ffffff 42%)"),
    # White with the red and blue taegeuk.
    Language("ko", "한국어", "ko",
             lamp="linear-gradient(135deg, #cd2e3a 0 50%, #0047a0 50%)"),
    # Blue with the gold cross.
    Language("sv", "Svenska", "sv",
             lamp="linear-gradient(90deg, #005293 0 34%, #fecb00 34% 52%, #005293 52%)"),
    # White with the blue cross.
    Language("fi", "Suomi", "fi",
             lamp="linear-gradient(90deg, #ffffff 0 34%, #002f6c 34% 52%, #ffffff 52%)"),
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
# Only the ones where a wrong word costs something. Terms is a contract and
# says plainly that English governs it, so publishing eleven versions nobody
# can verify would create the exact ambiguity it exists to avoid. Security
# describes the policy header precisely enough that a loose translation would
# misstate what the site does.
#
# Privacy is the arguable one and it is translated: the GDPR asks for clear
# and plain language, which for a site aimed at Spanish and German readers
# means their language. The desktop page is marketing copy with nothing
# sensitive in it, so it is translated too.
ENGLISH_ONLY = frozenset({"terms", "security"})


def english_only(page: str) -> bool:
    """Whether this page is published in English alone."""
    return page.strip("/") in ENGLISH_ONLY

