"""The tools RetroPDF offers, and the URLs they live at.

One definition drives the routes, the home page listing, and the page titles,
so adding a tool means adding one entry here.

Wording matters. People arriving from a search have often not used a tool like
this before, so headings say what the tool does in plain words rather than
naming the operation.
"""

from dataclasses import dataclass


@dataclass(frozen=True)
class Tool:
    """One tool, as both a page and an entry on the home page."""

    slug: str
    """The URL path, without the leading slash. Chosen to match what people
    actually search for, not internal naming."""

    mode: str
    """The identifier the browser code uses for this tool."""

    name: str
    """Short label, for the home page and the tool switcher."""

    heading: str
    """The h1 on the tool's own page."""

    blurb: str
    """One sentence explaining the tool, used on the home page.

    This is for someone choosing between the eight tools. On the tool's own
    page they have already chosen, so `steps` is shown there instead.
    """

    steps: str
    """What to do, in order, shown under the heading on the tool's page.

    Every one follows the same shape: select, do the thing, download. The
    repetition is deliberate, since learning the pattern once carries across
    all eight tools.
    """

    title: str
    """The browser tab and search result title."""

    description: str
    """The meta description shown under the title in search results."""


TOOLS: tuple[Tool, ...] = (
    Tool(
        slug="merge-pdf",
        mode="merge",
        name="Merge PDF",
        heading="Combine PDFs into one file",
        blurb="Put several PDFs together in the order you choose.",
        steps="Select two or more PDFs, drag them into order, then download.",
        title="Merge PDF files in your browser",
        description=(
            "Combine PDF files into one document. Nothing is uploaded: the "
            "merge happens on your own device, so your files stay private."
        ),
    ),
    Tool(
        slug="remove-pdf-pages",
        mode="remove",
        name="Delete PDF pages",
        heading="Delete pages from a PDF",
        blurb="Pick the pages you do not want and keep the rest.",
        steps="Select a PDF, click the pages you want gone, then download the rest.",
        title="Delete pages from a PDF in your browser",
        description=(
            "Delete pages from a PDF without uploading it. The file never "
            "leaves your device, so private documents stay private."
        ),
    ),
    Tool(
        slug="extract-pdf-pages",
        mode="extract",
        name="Extract PDF pages",
        heading="Save some pages as a new PDF",
        blurb="Pick the pages you want and save them as a new file.",
        steps="Select a PDF, click the pages you want to keep, then download them.",
        title="Extract pages from a PDF in your browser",
        description=(
            "Save selected pages of a PDF as a new file. Everything happens "
            "in your browser, with no upload and no account."
        ),
    ),
    Tool(
        slug="reorder-pdf",
        mode="reorder",
        name="Reorder PDF pages",
        heading="Change the order of PDF pages",
        blurb="Drag pages into the order you want.",
        steps="Select a PDF, drag the pages into the order you want, then download.",
        title="Reorder PDF pages in your browser",
        description=(
            "Rearrange the pages of a PDF. Nothing is uploaded, so the "
            "document stays on your own device."
        ),
    ),
    Tool(
        slug="rotate-pdf",
        mode="rotate",
        name="Rotate PDF",
        heading="Turn sideways pages upright",
        blurb="Turn pages that are sideways or upside down.",
        steps="Select a PDF, turn any page that is sideways, then download.",
        title="Rotate PDF pages in your browser",
        description=(
            "Turn PDF pages the right way up, one page or all of them. "
            "Runs entirely in your browser with no upload."
        ),
    ),
    Tool(
        slug="split-pdf",
        mode="split",
        name="Split PDF",
        heading="Cut one PDF into several files",
        blurb="Cut one PDF into several smaller files.",
        steps="Select a PDF, pick where to cut, then download the parts as a zip.",
        title="Split a PDF in your browser",
        description=(
            "Cut a PDF into separate files and download them as a zip. "
            "The file is never uploaded anywhere."
        ),
    ),
    Tool(
        slug="jpg-to-pdf",
        mode="frimages",
        name="Images to PDF",
        heading="Turn photos into a PDF",
        blurb="Put your JPG or PNG images into one PDF.",
        steps="Select your JPG or PNG images, drag them into order, then download one PDF.",
        title="Convert JPG images to PDF in your browser",
        description=(
            "Turn JPG and PNG images into one PDF. The pictures stay on your "
            "device, which matters for photos of documents and ID."
        ),
    ),
    Tool(
        slug="pdf-to-jpg",
        mode="toimages",
        name="PDF to images",
        heading="Save PDF pages as pictures",
        blurb="Save every page as a separate PNG or JPG.",
        steps="Select a PDF, pick a size, then download every page as an image.",
        title="Convert PDF pages to images in your browser",
        description=(
            "Save each page of a PDF as a PNG image. Runs on your own "
            "device, so nothing is uploaded."
        ),
    ),
)

BY_SLUG = {tool.slug: tool for tool in TOOLS}
BY_MODE = {tool.mode: tool for tool in TOOLS}
