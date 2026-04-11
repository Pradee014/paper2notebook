import pymupdf


def extract_text_from_pdf(pdf_bytes: bytes) -> dict:
    """Extract all text from a PDF file.

    Returns dict with 'text' (full extracted text) and 'pages' (page count).
    Raises ValueError if the PDF cannot be parsed.
    """
    try:
        doc = pymupdf.open(stream=pdf_bytes, filetype="pdf")
    except Exception as e:
        raise ValueError(f"Could not parse PDF: {e}")

    if doc.page_count == 0:
        raise ValueError("PDF has no pages")

    page_count = doc.page_count
    pages = []
    for page in doc:
        pages.append(page.get_text())

    doc.close()

    full_text = "\n\n".join(pages).strip()
    if not full_text:
        raise ValueError("PDF contains no extractable text (may be scanned/image-only)")

    return {"text": full_text, "pages": page_count}
