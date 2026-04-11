import json
import os
import pytest
from unittest.mock import AsyncMock, patch, MagicMock

from httpx import ASGITransport, AsyncClient

from main import app

TEST_PDF_PATH = os.path.join(os.path.dirname(__file__), "test_paper.pdf")

MOCK_CELLS = [
    {"cell_type": "markdown", "source": "# Test Notebook"},
    {"cell_type": "code", "source": "import numpy as np"},
]


def _make_mock_openai_response(cells):
    content = json.dumps({"cells": cells})
    mock_message = MagicMock()
    mock_message.content = content
    mock_choice = MagicMock()
    mock_choice.message = mock_message
    mock_response = MagicMock()
    mock_response.choices = [mock_choice]
    mock_response.usage = MagicMock(prompt_tokens=500, completion_tokens=2000, total_tokens=2500)
    return mock_response


@pytest.mark.asyncio
async def test_sse_generate_streams_progress_events():
    mock_response = _make_mock_openai_response(MOCK_CELLS)

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
                    data={"api_key": "sk-test-key"},
                    headers={"Accept": "text/event-stream"},
                )

        assert response.status_code == 200
        assert "text/event-stream" in response.headers.get("content-type", "")

        # Parse SSE events
        events = _parse_sse(response.text)
        event_types = [e["event"] for e in events if "event" in e]

        # Must have progress events
        assert "progress" in event_types
        # Must have a final 'complete' or 'done' event
        assert "complete" in event_types or "done" in event_types


@pytest.mark.asyncio
async def test_sse_generate_final_event_contains_notebook():
    mock_response = _make_mock_openai_response(MOCK_CELLS)

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
                    data={"api_key": "sk-test-key"},
                    headers={"Accept": "text/event-stream"},
                )

        events = _parse_sse(response.text)
        complete_events = [e for e in events if e.get("event") == "complete"]
        assert len(complete_events) == 1

        data = json.loads(complete_events[0]["data"])
        assert "cells" in data
        assert len(data["cells"]) == 2


@pytest.mark.asyncio
async def test_sse_generate_streams_error_on_api_failure():
    with patch("main.openai.AsyncOpenAI") as MockClient:
        instance = MockClient.return_value
        instance.chat = MagicMock()
        instance.chat.completions = MagicMock()
        instance.chat.completions.create = AsyncMock(
            side_effect=Exception("rate limit exceeded")
        )

        transport = ASGITransport(app=app)
        async with AsyncClient(transport=transport, base_url="http://test") as client:
            with open(TEST_PDF_PATH, "rb") as f:
                response = await client.post(
                    "/api/generate",
                    files={"file": ("paper.pdf", f, "application/pdf")},
                    data={"api_key": "sk-test-key"},
                    headers={"Accept": "text/event-stream"},
                )

        events = _parse_sse(response.text)
        error_events = [e for e in events if e.get("event") == "error"]
        assert len(error_events) >= 1


@pytest.mark.asyncio
async def test_sse_generate_rejects_non_pdf():
    transport = ASGITransport(app=app)
    async with AsyncClient(transport=transport, base_url="http://test") as client:
        response = await client.post(
            "/api/generate",
            files={"file": ("notes.txt", b"hello", "text/plain")},
            data={"api_key": "sk-test-key"},
            headers={"Accept": "text/event-stream"},
        )
    assert response.status_code == 400


def _parse_sse(text: str) -> list[dict]:
    """Parse SSE text into a list of event dicts with 'event' and 'data' keys."""
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
