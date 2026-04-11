"""Tests for Authorization header-based API key extraction."""

import os
import pytest
from httpx import ASGITransport, AsyncClient

from main import app

TEST_PDF_PATH = os.path.join(os.path.dirname(__file__), "test_paper.pdf")


@pytest.mark.asyncio
async def test_extract_accepts_bearer_token_in_auth_header():
    transport = ASGITransport(app=app)
    async with AsyncClient(transport=transport, base_url="http://test") as client:
        with open(TEST_PDF_PATH, "rb") as f:
            response = await client.post(
                "/api/extract",
                files={"file": ("paper.pdf", f, "application/pdf")},
                headers={"Authorization": "Bearer sk-test-key"},
            )
    assert response.status_code == 200
    data = response.json()
    assert "text" in data


@pytest.mark.asyncio
async def test_extract_rejects_missing_auth_header():
    transport = ASGITransport(app=app)
    async with AsyncClient(transport=transport, base_url="http://test") as client:
        with open(TEST_PDF_PATH, "rb") as f:
            response = await client.post(
                "/api/extract",
                files={"file": ("paper.pdf", f, "application/pdf")},
            )
    # Should be 401 Unauthorized, not 422 validation error
    assert response.status_code == 401


@pytest.mark.asyncio
async def test_extract_rejects_malformed_auth_header():
    transport = ASGITransport(app=app)
    async with AsyncClient(transport=transport, base_url="http://test") as client:
        with open(TEST_PDF_PATH, "rb") as f:
            response = await client.post(
                "/api/extract",
                files={"file": ("paper.pdf", f, "application/pdf")},
                headers={"Authorization": "sk-test-key"},  # missing Bearer prefix
            )
    assert response.status_code == 401


@pytest.mark.asyncio
async def test_extract_rejects_empty_bearer_token():
    transport = ASGITransport(app=app)
    async with AsyncClient(transport=transport, base_url="http://test") as client:
        with open(TEST_PDF_PATH, "rb") as f:
            response = await client.post(
                "/api/extract",
                files={"file": ("paper.pdf", f, "application/pdf")},
                headers={"Authorization": "Bearer "},
            )
    assert response.status_code == 401


@pytest.mark.asyncio
async def test_generate_accepts_bearer_token_in_auth_header():
    """Generate endpoint should accept the API key via Authorization header."""
    from unittest.mock import AsyncMock, patch, MagicMock
    import json

    cells = [{"cell_type": "markdown", "source": "# Test"}]
    content = json.dumps({"cells": cells})
    mock_message = MagicMock()
    mock_message.content = content
    mock_choice = MagicMock()
    mock_choice.message = mock_message
    mock_response = MagicMock()
    mock_response.choices = [mock_choice]

    with patch("main.openai.AsyncOpenAI") as MockClient:
        instance = MockClient.return_value
        instance.chat = MagicMock()
        instance.chat.completions = MagicMock()
        instance.chat.completions.create = AsyncMock(return_value=mock_response)

        transport = ASGITransport(app=app)
        async with AsyncClient(transport=transport, base_url="http://test") as client:
            with open(TEST_PDF_PATH, "rb") as f:
                response = await client.post(
                    "/api/generate",
                    files={"file": ("paper.pdf", f, "application/pdf")},
                    headers={
                        "Authorization": "Bearer sk-test-key",
                        "Accept": "text/event-stream",
                    },
                )

        assert response.status_code == 200

        # Verify the API key was passed to the OpenAI client
        MockClient.assert_called_once()
        call_kwargs = MockClient.call_args[1]
        assert call_kwargs["api_key"] == "sk-test-key"


@pytest.mark.asyncio
async def test_generate_rejects_missing_auth_header():
    transport = ASGITransport(app=app)
    async with AsyncClient(transport=transport, base_url="http://test") as client:
        with open(TEST_PDF_PATH, "rb") as f:
            response = await client.post(
                "/api/generate",
                files={"file": ("paper.pdf", f, "application/pdf")},
                headers={"Accept": "text/event-stream"},
            )
    assert response.status_code == 401


@pytest.mark.asyncio
async def test_api_key_not_accepted_in_form_body():
    """Ensure the old form-body approach no longer works."""
    transport = ASGITransport(app=app)
    async with AsyncClient(transport=transport, base_url="http://test") as client:
        with open(TEST_PDF_PATH, "rb") as f:
            response = await client.post(
                "/api/extract",
                files={"file": ("paper.pdf", f, "application/pdf")},
                data={"api_key": "sk-test-key"},
                # No Authorization header
            )
    # Without Auth header, should be rejected even if api_key is in form body
    assert response.status_code == 401
