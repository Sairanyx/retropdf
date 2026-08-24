"""Line drawings for each tool.

Thin stroked pages with folded corners, in the accent colour. The subject
is the product itself rather than a mascot: what each tool does to a
document is legible at a glance, which matters more than decoration for
someone deciding which tool they need.

Every page in every icon is the same shape at the same size, 14 by 18 with
a 5 unit fold, and the fold is drawn to meet the corner it turns rather than
being placed by eye. Drawing each one separately left the pages different
sizes from tool to tool and some folds not meeting their corner at all.
"""

ART = {
    "merge": """<svg width="52" height="40" viewBox="0 0 52 40" fill="none" stroke="currentColor" stroke-width="1.4">
  <path d="M3 6h9l5 5v13H3z"/><path d="M12 6v5h5"/><path d="M10 14h9l5 5v13H10z"/><path d="M19 14v5h5"/><path d="M28 20h7M35 20l-3 -3M35 20l-3 3" stroke-linecap="round"/><path d="M38 11h9l5 5v13H38z"/><path d="M47 11v5h5"/>
</svg>""",
    "remove": """<svg width="52" height="40" viewBox="0 0 52 40" fill="none" stroke="currentColor" stroke-width="1.4">
  <path d="M4 11h9l5 5v13H4z"/><path d="M13 11v5h5"/><path d="M7 17h8M7 22h8M7 27h5" stroke-linecap="round" opacity=".55"/><path d="M31 12h13v18H31z" stroke-dasharray="3 3"/><path d="M34 17l7 7M41 17l-7 7" stroke-linecap="round"/>
</svg>""",
    "extract": """<svg width="52" height="40" viewBox="0 0 52 40" fill="none" stroke="currentColor" stroke-width="1.4">
  <path d="M4 11h9l5 5v13H4z"/><path d="M13 11v5h5"/><path d="M7 17h8M7 22h8M7 27h5" stroke-linecap="round" opacity=".55"/><path d="M25 20h7M32 20l-3 -3M32 20l-3 3" stroke-linecap="round"/><path d="M36 11h9l5 5v13H36z"/><path d="M45 11v5h5"/>
</svg>""",
    "reorder": """<svg width="52" height="40" viewBox="0 0 52 40" fill="none" stroke="currentColor" stroke-width="1.4">
  <path d="M4 11h9l5 5v13H4z"/><path d="M13 11v5h5"/><path d="M23 15h6M29 15l-3 -3M29 15l-3 3" stroke-linecap="round"/><path d="M29 25h-6M23 25l3 -3M23 25l3 3" stroke-linecap="round"/><path d="M36 11h9l5 5v13H36z"/><path d="M45 11v5h5"/>
</svg>""",
    "rotate": """<svg width="52" height="40" viewBox="0 0 52 40" fill="none" stroke="currentColor" stroke-width="1.4">
  <path d="M13 11h9l5 5v13H13z" transform="rotate(-12 20 20)"/><path d="M22 11v5h5" transform="rotate(-12 20 20)"/><path d="M38 16a10 10 0 1 1-3 -7" stroke-linecap="round"/><path d="M35 5v5h-5" stroke-linecap="round" stroke-linejoin="round"/>
</svg>""",
    "split": """<svg width="52" height="40" viewBox="0 0 52 40" fill="none" stroke="currentColor" stroke-width="1.4">
  <path d="M4 11h9l5 5v13H4z"/><path d="M13 11v5h5"/><path d="M23 20h7" stroke-linecap="round" stroke-dasharray="2 3"/><path d="M34 2h9l5 5v13H34z"/><path d="M43 2v5h5"/><path d="M34 21h9l5 5v13H34z"/><path d="M43 21v5h5"/>
</svg>""",
    "frimages": """<svg width="52" height="40" viewBox="0 0 52 40" fill="none" stroke="currentColor" stroke-width="1.4">
  <rect x="4" y="11" width="14" height="18" rx="1.5"/><path d="M4 24l4 -4 3 3 3 -3 4 4" stroke-linejoin="round"/><circle cx="9" cy="16" r="1.6"/><path d="M25 20h7M32 20l-3 -3M32 20l-3 3" stroke-linecap="round"/><path d="M38 11h9l5 5v13H38z" transform="translate(-1,0)"/><path d="M47 11v5h5" transform="translate(-1,0)"/>
</svg>""",
    "toimages": """<svg width="52" height="40" viewBox="0 0 52 40" fill="none" stroke="currentColor" stroke-width="1.4">
  <path d="M4 11h9l5 5v13H4z"/><path d="M13 11v5h5"/><path d="M25 20h7M32 20l-3 -3M32 20l-3 3" stroke-linecap="round"/><rect x="34" y="11" width="14" height="18" rx="1.5"/><path d="M34 24l4 -4 3 3 3 -3 4 4" stroke-linejoin="round"/><circle cx="39" cy="16" r="1.6"/>
</svg>""",
}
