"""The tools RetroPDF offers: one address and one mode each.

Adding a tool means one entry here and its words in app/translations/*.json
(tool.<slug>.name, heading, blurb, steps, title, description).
"""

from dataclasses import dataclass


@dataclass(frozen=True)
class Tool:
    slug: str
    """The URL path, matching what people search for."""

    mode: str
    """The identifier the browser code uses for this tool."""


TOOLS: tuple[Tool, ...] = (
    Tool("merge-pdf", "merge"),
    Tool("remove-pdf-pages", "remove"),
    Tool("extract-pdf-pages", "extract"),
    Tool("reorder-pdf", "reorder"),
    Tool("rotate-pdf", "rotate"),
    Tool("split-pdf", "split"),
    Tool("jpg-to-pdf", "frimages"),
    Tool("pdf-to-jpg", "toimages"),
)

BY_SLUG = {tool.slug: tool for tool in TOOLS}
