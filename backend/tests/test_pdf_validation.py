"""Tests for PDF magic byte validation and content-type verification."""

import os
import pytest
from httpx import ASGITransport, AsyncClient

from main import app

TEST_PDF_PATH = os.path.join(os.path.dirname(__file__), "test_paper.pdf")

AUTH_HEADER = {"Authorization": "Bearer sk-test-key"}


@pytest.mark.asyncio
async def test_valid_pdf_passes_magic_byte_check():
    transport = ASGITransport(app=app)
    async with AsyncClient(transport=transport, base_url="http://test") as client:
        with open(TEST_PDF_PATH, "rb") as f:
            response = await client.post(
                "/api/extract",
                files={"file": ("paper.pdf", f, "application/pdf")},
                headers=AUTH_HEADER,
            )
    assert response.status_code == 200


@pytest.mark.asyncio
async def test_txt_renamed_to_pdf_rejected_by_magic_bytes():
    """A .txt file renamed to .pdf should be rejected by magic byte check."""
    fake_pdf = b"This is just a text file, not a PDF at all."
    transport = ASGITransport(app=app)
    async with AsyncClient(transport=transport, base_url="http://test") as client:
        response = await client.post(
            "/api/extract",
            files={"file": ("fake.pdf", fake_pdf, "application/pdf")},
            headers=AUTH_HEADER,
        )
    assert response.status_code == 400
    assert "not a valid PDF" in response.json()["detail"].lower() or "pdf" in response.json()["detail"].lower()


@pytest.mark.asyncio
async def test_html_renamed_to_pdf_rejected():
    """An HTML file renamed to .pdf should be rejected."""
    fake_pdf = b"<html><body>Not a PDF</body></html>"
    transport = ASGITransport(app=app)
    async with AsyncClient(transport=transport, base_url="http://test") as client:
        response = await client.post(
            "/api/extract",
            files={"file": ("page.pdf", fake_pdf, "application/pdf")},
            headers=AUTH_HEADER,
        )
    assert response.status_code == 400


@pytest.mark.asyncio
async def test_exe_renamed_to_pdf_rejected():
    """A binary file with MZ header renamed to .pdf should be rejected."""
    exe_header = b"MZ" + b"\x00" * 1024  # Minimal PE header
    transport = ASGITransport(app=app)
    async with AsyncClient(transport=transport, base_url="http://test") as client:
        response = await client.post(
            "/api/extract",
            files={"file": ("malware.pdf", exe_header, "application/pdf")},
            headers=AUTH_HEADER,
        )
    assert response.status_code == 400


@pytest.mark.asyncio
async def test_file_below_minimum_size_rejected():
    """Files smaller than 1KB should be rejected."""
    tiny_pdf = b"%PDF-1.4 tiny"  # Valid magic bytes but too small
    assert len(tiny_pdf) < 1024
    transport = ASGITransport(app=app)
    async with AsyncClient(transport=transport, base_url="http://test") as client:
        response = await client.post(
            "/api/extract",
            files={"file": ("tiny.pdf", tiny_pdf, "application/pdf")},
            headers=AUTH_HEADER,
        )
    assert response.status_code == 400
    assert "too small" in response.json()["detail"].lower()


@pytest.mark.asyncio
async def test_generate_endpoint_also_validates_magic_bytes():
    """The /api/generate endpoint should also check magic bytes."""
    fake_pdf = b"Not a real PDF content here"
    transport = ASGITransport(app=app)
    async with AsyncClient(transport=transport, base_url="http://test") as client:
        response = await client.post(
            "/api/generate",
            files={"file": ("fake.pdf", fake_pdf, "application/pdf")},
            headers={**AUTH_HEADER, "Accept": "text/event-stream"},
        )
    assert response.status_code == 400


@pytest.mark.asyncio
async def test_generate_endpoint_rejects_tiny_file():
    """The /api/generate endpoint should also enforce minimum size."""
    tiny_pdf = b"%PDF-1.4 x"
    transport = ASGITransport(app=app)
    async with AsyncClient(transport=transport, base_url="http://test") as client:
        response = await client.post(
            "/api/generate",
            files={"file": ("tiny.pdf", tiny_pdf, "application/pdf")},
            headers={**AUTH_HEADER, "Accept": "text/event-stream"},
        )
    assert response.status_code == 400
