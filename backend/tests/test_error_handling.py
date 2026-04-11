"""Tests for timeout, specific exception handling, and generic error responses."""

import json
import logging
import os
import pytest
from unittest.mock import AsyncMock, patch, MagicMock

from httpx import ASGITransport, AsyncClient

from main import app, LLM_TIMEOUT_SECONDS

TEST_PDF_PATH = os.path.join(os.path.dirname(__file__), "test_paper.pdf")

AUTH_HEADER = {"Authorization": "Bearer sk-test-key"}


def _parse_sse(text: str) -> list[dict]:
    events = []
    current: dict = {}
    for line in text.replace("\r\n", "\n").split("\n"):
        if line.startswith("event:"):
            current["event"] = line[len("event:"):].strip()
        elif line.startswith("data:"):
            current["data"] = line[len("data:"):].strip()
        elif line.strip() == "" and current:
            events.append(current)
            current = {}
    if current:
        events.append(current)
    return events


class TestTimeoutConfiguration:
    def test_timeout_constant_is_defined(self):
        assert LLM_TIMEOUT_SECONDS == 120

    @pytest.mark.asyncio
    async def test_timeout_produces_user_friendly_error(self):
        """When the LLM call times out, user gets a generic timeout message."""
        with patch("main.openai.AsyncOpenAI") as MockClient:
            instance = MockClient.return_value
            instance.chat = MagicMock()
            instance.chat.completions = MagicMock()
            # Simulate a timeout by making create() hang
            async def slow_create(**kwargs):
                await asyncio.sleep(999)
            instance.chat.completions.create = slow_create

            # We also need to patch asyncio.wait_for to timeout quickly for the test
            import asyncio
            original_wait_for = asyncio.wait_for

            async def fast_timeout(coro, timeout):
                return await original_wait_for(coro, timeout=0.01)

            with patch("main.asyncio.wait_for", side_effect=asyncio.TimeoutError):
                transport = ASGITransport(app=app)
                async with AsyncClient(transport=transport, base_url="http://test") as client:
                    with open(TEST_PDF_PATH, "rb") as f:
                        response = await client.post(
                            "/api/generate",
                            files={"file": ("paper.pdf", f, "application/pdf")},
                            headers={**AUTH_HEADER, "Accept": "text/event-stream"},
                        )

                events = _parse_sse(response.text)
                error_events = [e for e in events if e.get("event") == "error"]
                assert len(error_events) >= 1
                error_data = json.loads(error_events[0]["data"])
                assert "timeout" in error_data["message"].lower() or "timed out" in error_data["message"].lower()


class TestSpecificExceptionHandling:
    @pytest.mark.asyncio
    async def test_auth_error_gives_friendly_message(self):
        """openai.AuthenticationError should produce a friendly API key message."""
        import openai as openai_mod

        with patch("main.openai.AsyncOpenAI") as MockClient:
            instance = MockClient.return_value
            instance.chat = MagicMock()
            instance.chat.completions = MagicMock()
            instance.chat.completions.create = AsyncMock(
                side_effect=openai_mod.AuthenticationError(
                    message="Incorrect API key provided",
                    response=MagicMock(status_code=401),
                    body=None,
                )
            )

            transport = ASGITransport(app=app)
            async with AsyncClient(transport=transport, base_url="http://test") as client:
                with open(TEST_PDF_PATH, "rb") as f:
                    response = await client.post(
                        "/api/generate",
                        files={"file": ("paper.pdf", f, "application/pdf")},
                        headers={**AUTH_HEADER, "Accept": "text/event-stream"},
                    )

            events = _parse_sse(response.text)
            error_events = [e for e in events if e.get("event") == "error"]
            assert len(error_events) >= 1
            error_data = json.loads(error_events[0]["data"])
            # Should be user-friendly, not raw exception
            assert "api key" in error_data["message"].lower() or "invalid" in error_data["message"].lower()

    @pytest.mark.asyncio
    async def test_rate_limit_error_gives_friendly_message(self):
        """openai.RateLimitError should produce a quota exceeded message."""
        import openai as openai_mod

        with patch("main.openai.AsyncOpenAI") as MockClient:
            instance = MockClient.return_value
            instance.chat = MagicMock()
            instance.chat.completions = MagicMock()
            instance.chat.completions.create = AsyncMock(
                side_effect=openai_mod.RateLimitError(
                    message="You exceeded your current quota",
                    response=MagicMock(status_code=429),
                    body=None,
                )
            )

            transport = ASGITransport(app=app)
            async with AsyncClient(transport=transport, base_url="http://test") as client:
                with open(TEST_PDF_PATH, "rb") as f:
                    response = await client.post(
                        "/api/generate",
                        files={"file": ("paper.pdf", f, "application/pdf")},
                        headers={**AUTH_HEADER, "Accept": "text/event-stream"},
                    )

            events = _parse_sse(response.text)
            error_events = [e for e in events if e.get("event") == "error"]
            error_data = json.loads(error_events[0]["data"])
            assert "quota" in error_data["message"].lower() or "rate" in error_data["message"].lower()


class TestGenericErrorResponses:
    @pytest.mark.asyncio
    async def test_parse_error_does_not_leak_raw_content(self):
        """JSON parse errors should not include the raw LLM response."""
        with patch("main.openai.AsyncOpenAI") as MockClient:
            mock_message = MagicMock()
            mock_message.content = "This is NOT valid JSON at all with internal secrets"
            mock_choice = MagicMock()
            mock_choice.message = mock_message
            mock_response = MagicMock()
            mock_response.choices = [mock_choice]

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
                        headers={**AUTH_HEADER, "Accept": "text/event-stream"},
                    )

            events = _parse_sse(response.text)
            error_events = [e for e in events if e.get("event") == "error"]
            assert len(error_events) >= 1
            error_data = json.loads(error_events[0]["data"])
            # Should NOT contain "internal secrets" or raw LLM output
            assert "internal secrets" not in error_data["message"]
            # Should be a generic message
            assert "parse" in error_data["message"].lower() or "failed" in error_data["message"].lower()

    @pytest.mark.asyncio
    async def test_notebook_assembly_error_is_generic(self):
        """Notebook build errors should not leak internal paths."""
        cells = [
            {"cell_type": "markdown", "source": "# Test"},
            {"cell_type": "code", "source": "x = 1"},
        ]
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

            with patch("main.build_notebook", side_effect=Exception("/usr/local/lib/python3.13/nbformat/v4/error")):
                transport = ASGITransport(app=app)
                async with AsyncClient(transport=transport, base_url="http://test") as client:
                    with open(TEST_PDF_PATH, "rb") as f:
                        response = await client.post(
                            "/api/generate",
                            files={"file": ("paper.pdf", f, "application/pdf")},
                            headers={**AUTH_HEADER, "Accept": "text/event-stream"},
                        )

                events = _parse_sse(response.text)
                error_events = [e for e in events if e.get("event") == "error"]
                assert len(error_events) >= 1
                error_data = json.loads(error_events[0]["data"])
                # Should NOT leak the internal path
                assert "/usr/local" not in error_data["message"]
                assert "python3.13" not in error_data["message"]


class TestLogging:
    @pytest.mark.asyncio
    async def test_api_error_is_logged_server_side(self, caplog):
        """Errors should be logged at ERROR level even though client gets a generic message."""
        with patch("main.openai.AsyncOpenAI") as MockClient:
            instance = MockClient.return_value
            instance.chat = MagicMock()
            instance.chat.completions = MagicMock()
            instance.chat.completions.create = AsyncMock(
                side_effect=Exception("detailed internal error: secret_key=abc123")
            )

            with caplog.at_level(logging.ERROR, logger="paper2notebook"):
                transport = ASGITransport(app=app)
                async with AsyncClient(transport=transport, base_url="http://test") as client:
                    with open(TEST_PDF_PATH, "rb") as f:
                        response = await client.post(
                            "/api/generate",
                            files={"file": ("paper.pdf", f, "application/pdf")},
                            headers={**AUTH_HEADER, "Accept": "text/event-stream"},
                        )

                # The detailed error should appear in logs
                assert any("detailed internal error" in r.message for r in caplog.records)
