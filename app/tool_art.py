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
  <path d="M1 8h9l5 5v13H1z" opacity=".45"/><path d="M10 8v5h5" opacity=".45"/><path d="M5 14h9l5 5v13H5z"/><path d="M14 14v5h5"/><path d="M23 20h8M31 20l-3 -3M31 20l-3 3" stroke-linecap="round"/><path d="M36 11h9l5 5v13H36z"/><path d="M45 11v5h5"/>
</svg>""",
    "remove": """<svg width="52" height="40" viewBox="0 0 52 40" fill="none" stroke="currentColor" stroke-width="1.4">
  <path d="M4 11h9l5 5v13H4z"/><path d="M13 11v5h5"/><path d="M23 20h8M31 20l-3 -3M31 20l-3 3" stroke-linecap="round"/><path d="M36 11h14v18H36z" stroke-dasharray="3 3"/><path d="M39 16l8 8M47 16l-8 8" stroke-linecap="round"/>
</svg>""",
    "extract": """<svg width="52" height="40" viewBox="0 0 52 40" fill="none" stroke="currentColor" stroke-width="1.4">
  <path d="M4 11h9l5 5v13H4z"/><path d="M13 11v5h5"/><path d="M23 20h8M31 20l-3 -3M31 20l-3 3" stroke-linecap="round"/><path d="M36 11h9l5 5v13H36z"/><path d="M45 11v5h5"/>
</svg>""",
    "reorder": """<svg width="52" height="40" viewBox="0 0 52 40" fill="none" stroke="currentColor" stroke-width="1.4">
  <path d="M4 11h9l5 5v13H4z"/><path d="M13 11v5h5"/><path d="M23 15h8M31 15l-3 -3M31 15l-3 3" stroke-linecap="round"/><path d="M31 25h-8M23 25l3 -3M23 25l3 3" stroke-linecap="round"/><path d="M36 11h9l5 5v13H36z"/><path d="M45 11v5h5"/>
</svg>""",
    "rotate": """<svg width="52" height="40" viewBox="0 0 52 40" fill="none" stroke="currentColor" stroke-width="1.4">
  <path d="M13 11h9l5 5v13H13z" transform="rotate(-12 20 20)"/><path d="M22 11v5h5" transform="rotate(-12 20 20)"/><path d="M38 16a10 10 0 1 1-3 -7" stroke-linecap="round"/><path d="M35 5v5h-5" stroke-linecap="round" stroke-linejoin="round"/>
</svg>""",
    "split": """<svg width="52" height="40" viewBox="0 0 52 40" fill="none" stroke="currentColor" stroke-width="1.4">
  <path d="M4 11h9l5 5v13H4z"/><path d="M13 11v5h5"/><path d="M23 20h8M31 20l-3 -3M31 20l-3 3" stroke-linecap="round"/><path d="M34 2h9l5 5v13H34z"/><path d="M43 2v5h5"/><path d="M34 21h9l5 5v13H34z"/><path d="M43 21v5h5"/>
</svg>""",
    "frimages": """<svg width="52" height="40" viewBox="0 0 52 40" fill="none" stroke="currentColor" stroke-width="1.4">
  <rect x="4" y="11" width="14" height="18" rx="1.5"/><path d="M4 24l4 -4 3 3 3 -3 4 4" stroke-linejoin="round"/><circle cx="9" cy="16" r="1.6"/><path d="M23 20h8M31 20l-3 -3M31 20l-3 3" stroke-linecap="round"/><path d="M36 11h9l5 5v13H36z"/><path d="M45 11v5h5"/>
</svg>""",
    "toimages": """<svg width="52" height="40" viewBox="0 0 52 40" fill="none" stroke="currentColor" stroke-width="1.4">
  <path d="M4 11h9l5 5v13H4z"/><path d="M13 11v5h5"/><path d="M23 20h8M31 20l-3 -3M31 20l-3 3" stroke-linecap="round"/><rect x="36" y="11" width="14" height="18" rx="1.5"/><path d="M36 24l4 -4 3 3 3 -3 4 4" stroke-linejoin="round"/><circle cx="41" cy="16" r="1.6"/>
</svg>""",
}
