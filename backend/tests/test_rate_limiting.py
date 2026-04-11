"""Tests for rate limiting on API endpoints."""

import os
import pytest
from httpx import ASGITransport, AsyncClient

from main import app

TEST_PDF_PATH = os.path.join(os.path.dirname(__file__), "test_paper.pdf")

AUTH_HEADER = {"Authorization": "Bearer sk-test-key"}


@pytest.mark.asyncio
async def test_extract_allows_requests_under_limit():
    """Under the rate limit, requests should succeed normally."""
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
async def test_extract_returns_429_when_rate_exceeded():
    """Exceeding the rate limit on /api/extract should return 429."""
    transport = ASGITransport(app=app)
    async with AsyncClient(transport=transport, base_url="http://test") as client:
        # Send 11 requests (limit is 10/minute for extract)
        last_status = None
        for i in range(11):
            with open(TEST_PDF_PATH, "rb") as f:
                response = await client.post(
                    "/api/extract",
                    files={"file": ("paper.pdf", f, "application/pdf")},
                    headers=AUTH_HEADER,
                )
            last_status = response.status_code
            if last_status == 429:
                break

        assert last_status == 429


@pytest.mark.asyncio
async def test_generate_returns_429_when_rate_exceeded():
    """Exceeding the rate limit on /api/generate should return 429."""
    transport = ASGITransport(app=app)
    async with AsyncClient(transport=transport, base_url="http://test") as client:
        # Send 6 requests (limit is 5/minute for generate)
        last_status = None
        for i in range(6):
            with open(TEST_PDF_PATH, "rb") as f:
                response = await client.post(
                    "/api/generate",
                    files={"file": ("paper.pdf", f, "application/pdf")},
                    headers={**AUTH_HEADER, "Accept": "text/event-stream"},
                )
            last_status = response.status_code
            if last_status == 429:
                break

        assert last_status == 429


@pytest.mark.asyncio
async def test_rate_limit_response_has_clear_message():
    """Rate limit response should have a user-friendly message."""
    transport = ASGITransport(app=app)
    async with AsyncClient(transport=transport, base_url="http://test") as client:
        for i in range(11):
            with open(TEST_PDF_PATH, "rb") as f:
                response = await client.post(
                    "/api/extract",
                    files={"file": ("paper.pdf", f, "application/pdf")},
                    headers=AUTH_HEADER,
                )
            if response.status_code == 429:
                break

        assert response.status_code == 429
        data = response.json()
        assert "detail" in data or "error" in data
        message = data.get("detail", data.get("error", ""))
        assert "rate" in message.lower() or "limit" in message.lower() or "too many" in message.lower()


@pytest.mark.asyncio
async def test_health_endpoint_not_rate_limited():
    """Health endpoint should not be rate limited."""
    transport = ASGITransport(app=app)
    async with AsyncClient(transport=transport, base_url="http://test") as client:
        for _ in range(20):
            response = await client.get("/api/health")
            assert response.status_code == 200
