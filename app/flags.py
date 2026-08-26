"""The flag on each language's lamp in the picker.

Drawn rather than approximated with gradients. A gradient can only make
stripes, so France and Germany came out right while the Union Flag lost one
of its two crosses and the Swedish cross became a vertical band. At sixteen
pixels a flag is already a hint rather than a rendering, but a wrong hint is
worse than a plain lamp.

Each is a circle of the flag's centre, since that is what a round lamp can
hold. Simplified deliberately: the Korean taegeuk is two curves rather than
the full spiral with its four trigrams, and China keeps the large star and
drops the four small ones. Both still read as themselves at this size.

A flag stands for a country and a language rarely does, which is why the
name is always written beside the lamp. The flag is the glance, the word is
the answer.
"""

# Every flag is drawn in a 32 by 32 box and clipped to a circle by the CSS,
# so each one only has to fill the square.
FLAGS = {
    # Union Flag: blue ground, white saltire, red saltire, white cross, red
    # cross. Both crosses, in the order they are actually layered.
    "en": """<svg viewBox="0 0 32 32" preserveAspectRatio="xMidYMid slice">
  <rect width="32" height="32" fill="#012169"/>
  <path d="M0 0l32 32M32 0L0 32" stroke="#fff" stroke-width="7"/>
  <path d="M0 0l32 32M32 0L0 32" stroke="#c8102e" stroke-width="4"/>
  <path d="M16 0v32M0 16h32" stroke="#fff" stroke-width="11"/>
  <path d="M16 0v32M0 16h32" stroke="#c8102e" stroke-width="6"/>
</svg>""",
    # Red ground with the large gold star. The four small ones are dropped:
    # at this size they close up into a smudge.
    "zh": """<svg viewBox="0 0 32 32" preserveAspectRatio="xMidYMid slice">
  <rect width="32" height="32" fill="#de2910"/>
  <path d="M16 7l2.6 8h8.4l-6.8 4.9 2.6 8-6.8-4.9-6.8 4.9 2.6-8L4.9 15h8.4z" fill="#ffde00"/>
</svg>""",
    # Saffron, white, green, with the navy chakra.
    "hi": """<svg viewBox="0 0 32 32" preserveAspectRatio="xMidYMid slice">
  <rect width="32" height="32" fill="#ff9933"/>
  <rect y="10.7" width="32" height="10.6" fill="#fff"/>
  <rect y="21.3" width="32" height="10.7" fill="#138808"/>
  <circle cx="16" cy="16" r="4" fill="none" stroke="#000080" stroke-width="1.4"/>
</svg>""",
    # Red, gold, red. The arms are left off: they are unreadable this small.
    "es": """<svg viewBox="0 0 32 32" preserveAspectRatio="xMidYMid slice">
  <rect width="32" height="32" fill="#aa151b"/>
  <rect y="8" width="32" height="16" fill="#f1bf00"/>
</svg>""",
    # Blue, white, red, upright.
    "fr": """<svg viewBox="0 0 32 32" preserveAspectRatio="xMidYMid slice">
  <rect width="32" height="32" fill="#fff"/>
  <rect width="10.7" height="32" fill="#0055a4"/>
  <rect x="21.3" width="10.7" height="32" fill="#ef4135"/>
</svg>""",
    # Green and red divided at two fifths, with the armillary sphere reduced
    # to a gold ring on the join.
    "pt": """<svg viewBox="0 0 32 32" preserveAspectRatio="xMidYMid slice">
  <rect width="32" height="32" fill="#da291c"/>
  <rect width="13" height="32" fill="#046a38"/>
  <circle cx="13" cy="16" r="5" fill="none" stroke="#ffe900" stroke-width="1.6"/>
</svg>""",
    # Black, red, gold.
    "de": """<svg viewBox="0 0 32 32" preserveAspectRatio="xMidYMid slice">
  <rect width="32" height="32" fill="#000"/>
  <rect y="10.7" width="32" height="10.6" fill="#dd0000"/>
  <rect y="21.3" width="32" height="10.7" fill="#ffce00"/>
</svg>""",
    # White with the red disc.
    "ja": """<svg viewBox="0 0 32 32" preserveAspectRatio="xMidYMid slice">
  <rect width="32" height="32" fill="#fff"/>
  <circle cx="16" cy="16" r="9" fill="#bc002d"/>
</svg>""",
    # White with the taegeuk: two halves, each curving into the other.
    "ko": """<svg viewBox="0 0 32 32" preserveAspectRatio="xMidYMid slice">
  <rect width="32" height="32" fill="#fff"/>
  <path d="M7 16a9 9 0 0 1 18 0 4.5 4.5 0 0 0-9 0 4.5 4.5 0 0 1-9 0z" fill="#cd2e3a"/>
  <path d="M7 16a4.5 4.5 0 0 1 9 0 4.5 4.5 0 0 0 9 0 9 9 0 0 1-18 0z" fill="#0047a0"/>
</svg>""",
    # Blue with the gold cross, set left of centre as it really is.
    "sv": """<svg viewBox="0 0 32 32" preserveAspectRatio="xMidYMid slice">
  <rect width="32" height="32" fill="#005293"/>
  <path d="M12 0v32M0 16h32" stroke="#fecb00" stroke-width="7"/>
</svg>""",
    # White with the blue cross, in the same place.
    "fi": """<svg viewBox="0 0 32 32" preserveAspectRatio="xMidYMid slice">
  <rect width="32" height="32" fill="#fff"/>
  <path d="M12 0v32M0 16h32" stroke="#002f6c" stroke-width="7"/>
</svg>""",
}
