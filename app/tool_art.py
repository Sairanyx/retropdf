"""Line drawings for each tool.

Thin stroked pages with folded corners, in the accent colour. The subject
is the product itself rather than a mascot: what each tool does to a
document is legible at a glance, which matters more than decoration for
someone deciding which tool they need.
"""

ART = {
    "merge": """<svg width="52" height="40" viewBox="0 0 52 40" fill="none" stroke="currentColor" stroke-width="1.4">
  <path d="M4 6h9l4 4v14H4z"/><path d="M13 6v4h4"/>
  <path d="M11 16h9l4 4v14H11z"/><path d="M20 16v4h4"/>
  <path d="M30 22h6M36 22l-3-3M36 22l-3 3" stroke-linecap="round"/>
  <path d="M40 8h8l4 4v20H40z" transform="translate(-2,4)"/><path d="M46 12v4h4" transform="translate(-2,4)"/>
</svg>""",
    "remove": """<svg width="52" height="40" viewBox="0 0 52 40" fill="none" stroke="currentColor" stroke-width="1.4">
  <path d="M6 6h11l5 5v23H6z"/><path d="M17 6v5h5"/>
  <path d="M10 16h9M10 21h9M10 26h6" stroke-linecap="round" opacity=".55"/>
  <path d="M31 12h13v20H31z" stroke-dasharray="3 3"/>
  <path d="M34 18l7 7M41 18l-7 7" stroke-linecap="round"/>
</svg>""",
    "extract": """<svg width="52" height="40" viewBox="0 0 52 40" fill="none" stroke="currentColor" stroke-width="1.4">
  <path d="M4 6h11l5 5v23H4z"/><path d="M15 6v5h5"/>
  <path d="M8 16h8M8 21h8M8 26h5" stroke-linecap="round" opacity=".55"/>
  <path d="M26 20h7M33 20l-3-3M33 20l-3 3" stroke-linecap="round"/>
  <path d="M38 10h9l4 4v18h-13z"/><path d="M47 10v4h4"/>
</svg>""",
    "reorder": """<svg width="52" height="40" viewBox="0 0 52 40" fill="none" stroke="currentColor" stroke-width="1.4">
  <path d="M4 8h10l4 4v20H4z"/><path d="M14 8v4h4"/>
  <path d="M24 13h6M30 13l-3-3M30 13l-3 3" stroke-linecap="round"/>
  <path d="M30 27h-6M24 27l3-3M24 27l3 3" stroke-linecap="round"/>
  <path d="M36 8h10l4 4v20H36z"/><path d="M46 8v4h4"/>
</svg>""",
    "rotate": """<svg width="52" height="40" viewBox="0 0 52 40" fill="none" stroke="currentColor" stroke-width="1.4">
  <path d="M14 10h12l4 4v16H14z" transform="rotate(-12 22 20)"/>
  <path d="M26 10v4h4" transform="rotate(-12 22 20)"/>
  <path d="M36 14a10 10 0 1 1-3-7" stroke-linecap="round"/>
  <path d="M33 3v5h-5" stroke-linecap="round" stroke-linejoin="round"/>
</svg>""",
    "split": """<svg width="52" height="40" viewBox="0 0 52 40" fill="none" stroke="currentColor" stroke-width="1.4">
  <path d="M4 10h10l4 4v16H4z"/><path d="M14 10v4h4"/>
  <path d="M23 20h6" stroke-linecap="round" stroke-dasharray="2 3"/>
  <path d="M34 4h8l4 4v12H34z"/><path d="M42 4v4h4"/>
  <path d="M34 22h8l4 4v10H34z"/><path d="M42 22v4h4"/>
</svg>""",
    "frimages": """<svg width="52" height="40" viewBox="0 0 52 40" fill="none" stroke="currentColor" stroke-width="1.4">
  <rect x="4" y="9" width="16" height="13" rx="1.5"/>
  <path d="M4 18l4-4 4 4 3-3 5 5" stroke-linejoin="round"/>
  <circle cx="15" cy="13" r="1.6"/>
  <rect x="8" y="17" width="16" height="13" rx="1.5" opacity=".5"/>
  <path d="M30 20h6M36 20l-3-3M36 20l-3 3" stroke-linecap="round"/>
  <path d="M40 8h8l4 4v20H40z" transform="translate(-1,2)"/><path d="M48 8v4h4" transform="translate(-1,2)"/>
</svg>""",
    "toimages": """<svg width="52" height="40" viewBox="0 0 52 40" fill="none" stroke="currentColor" stroke-width="1.4">
  <path d="M4 8h10l4 4v20H4z"/><path d="M14 8v4h4"/>
  <path d="M24 20h6M30 20l-3-3M30 20l-3 3" stroke-linecap="round"/>
  <rect x="34" y="10" width="16" height="13" rx="1.5"/>
  <path d="M34 19l4-4 4 4 3-3 5 5" stroke-linejoin="round"/>
  <circle cx="45" cy="14" r="1.6"/>
  <rect x="38" y="18" width="14" height="12" rx="1.5" opacity=".5"/>
</svg>""",
}
