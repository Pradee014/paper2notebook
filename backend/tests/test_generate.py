import os
import pytest
from httpx import ASGITransport, AsyncClient

from main import app

TEST_PDF_PATH = os.path.join(os.path.dirname(__file__), "test_paper.pdf")


@pytest.mark.asyncio
async def test_generate_extracts_text_from_pdf():
    transport = ASGITransport(app=app)
    async with AsyncClient(transport=transport, base_url="http://test") as client:
        with open(TEST_PDF_PATH, "rb") as f:
            response = await client.post(
                "/api/extract",
                files={"file": ("paper.pdf", f, "application/pdf")},
                data={"api_key": "sk-test-key"},
            )
    assert response.status_code == 200
    data = response.json()
    assert "text" in data
    assert "Attention Is All You Need" in data["text"]
    assert "Transformer" in data["text"]
    assert data["pages"] == 1


@pytest.mark.asyncio
async def test_generate_rejects_missing_file():
    transport = ASGITransport(app=app)
    async with AsyncClient(transport=transport, base_url="http://test") as client:
        response = await client.post(
            "/api/extract",
            data={"api_key": "sk-test-key"},
        )
    assert response.status_code == 422


@pytest.mark.asyncio
async def test_generate_rejects_missing_api_key():
    transport = ASGITransport(app=app)
    async with AsyncClient(transport=transport, base_url="http://test") as client:
        with open(TEST_PDF_PATH, "rb") as f:
            response = await client.post(
                "/api/extract",
                files={"file": ("paper.pdf", f, "application/pdf")},
            )
    assert response.status_code == 422


@pytest.mark.asyncio
async def test_generate_rejects_non_pdf_file():
    transport = ASGITransport(app=app)
    async with AsyncClient(transport=transport, base_url="http://test") as client:
        response = await client.post(
            "/api/extract",
            files={"file": ("notes.txt", b"just some text", "text/plain")},
            data={"api_key": "sk-test-key"},
        )
    assert response.status_code == 400
    data = response.json()
    assert "pdf" in data["detail"].lower()


@pytest.mark.asyncio
async def test_generate_rejects_corrupt_pdf():
    transport = ASGITransport(app=app)
    async with AsyncClient(transport=transport, base_url="http://test") as client:
        response = await client.post(
            "/api/extract",
            files={"file": ("bad.pdf", b"not a real pdf", "application/pdf")},
            data={"api_key": "sk-test-key"},
        )
    assert response.status_code == 400
    data = response.json()
    assert "detail" in data
