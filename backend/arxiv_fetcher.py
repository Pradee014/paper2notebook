"""Fetch PDFs from arXiv given a URL or paper ID.

Supports formats:
  - Bare ID: "1706.03762", "1706.03762v5"
  - Old-style ID: "hep-ph/9905221"
  - abs URL: "https://arxiv.org/abs/1706.03762"
  - pdf URL: "https://arxiv.org/pdf/1706.03762"
"""

import re

import httpx

ARXIV_PDF_BASE = "https://arxiv.org/pdf/"

# New-style: 1706.03762 or 1706.03762v5
_NEW_ID = re.compile(r"^(\d{4}\.\d{4,5})(v\d+)?$")

# Old-style: hep-ph/9905221
_OLD_ID = re.compile(r"^([a-z-]+/\d{7})(v\d+)?$")

# URL patterns: https://arxiv.org/(abs|pdf)/ID
_URL_PATTERN = re.compile(
    r"https?://arxiv\.org/(?:abs|pdf)/([a-z-]+/\d{7}|\d{4}\.\d{4,5})(v\d+)?(?:\.pdf)?$"
)


class ArxivFetchError(Exception):
    """Raised when arXiv ID parsing or PDF fetching fails."""


def parse_arxiv_id(raw: str) -> str:
    """Extract a canonical arXiv paper ID from a URL or bare ID.

    Returns the ID without version suffix (e.g., "1706.03762").
    Raises ArxivFetchError if the input cannot be parsed.
    """
    raw = raw.strip()

    # Try URL first
    m = _URL_PATTERN.match(raw)
    if m:
        return m.group(1)

    # Try bare new-style ID
    m = _NEW_ID.match(raw)
    if m:
        return m.group(1)

    # Try bare old-style ID
    m = _OLD_ID.match(raw)
    if m:
        return m.group(1)

    raise ArxivFetchError(f"Could not parse arXiv ID from: {raw!r}")


async def fetch_arxiv_pdf(arxiv_id_or_url: str) -> bytes:
    """Download a PDF from arXiv.

    Accepts a bare ID or full URL. Returns raw PDF bytes.
    Raises ArxivFetchError on network or validation failures.
    """
    paper_id = parse_arxiv_id(arxiv_id_or_url)
    url = f"{ARXIV_PDF_BASE}{paper_id}"

    try:
        async with httpx.AsyncClient(follow_redirects=True, timeout=60.0) as client:
            response = await client.get(url)
    except httpx.ConnectError:
        raise ArxivFetchError("Could not connect to arXiv. Please check your network.")
    except httpx.TimeoutException:
        raise ArxivFetchError("arXiv request timed out. Please try again.")
    except httpx.HTTPError:
        raise ArxivFetchError("Network error while fetching from arXiv.")

    if response.status_code == 404:
        raise ArxivFetchError(f"Paper {paper_id} not found on arXiv.")
    if response.status_code != 200:
        raise ArxivFetchError(f"arXiv returned HTTP {response.status_code}.")

    pdf_bytes = response.content
    if not pdf_bytes[:4].startswith(b"%PDF"):
        raise ArxivFetchError(
            "arXiv response is not a valid PDF. The paper may not exist or arXiv may be rate-limiting."
        )

    return pdf_bytes
