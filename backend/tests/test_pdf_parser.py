import os
import pytest
from pdf_parser import extract_text_from_pdf

TEST_PDF_PATH = os.path.join(os.path.dirname(__file__), "test_paper.pdf")


def test_extract_text_returns_content():
    with open(TEST_PDF_PATH, "rb") as f:
        result = extract_text_from_pdf(f.read())
    assert "Attention Is All You Need" in result["text"]
    assert result["pages"] == 1


def test_extract_text_from_corrupt_pdf_raises():
    with pytest.raises(ValueError, match="parse"):
        extract_text_from_pdf(b"this is not a pdf")


def test_extract_text_preserves_multiline():
    with open(TEST_PDF_PATH, "rb") as f:
        result = extract_text_from_pdf(f.read())
    assert "Transformer" in result["text"]
    assert "attention mechanisms" in result["text"]
