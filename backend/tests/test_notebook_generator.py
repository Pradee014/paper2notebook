import json
import pytest
from unittest.mock import AsyncMock, patch, MagicMock

from notebook_generator import generate_notebook_content
from prompts import build_system_prompt, build_user_prompt

# --- Prompt tests ---


def test_system_prompt_contains_notebook_structure():
    prompt = build_system_prompt()
    assert "Title" in prompt
    assert "Abstract" in prompt
    assert "Mathematical" in prompt or "mathematical" in prompt
    assert "synthetic data" in prompt.lower() or "Synthetic" in prompt
    assert "implementation" in prompt.lower()
    assert "ablation" in prompt.lower() or "Ablation" in prompt
    assert "visualization" in prompt.lower() or "Visualization" in prompt


def test_system_prompt_specifies_json_output():
    prompt = build_system_prompt()
    assert "json" in prompt.lower() or "JSON" in prompt


def test_user_prompt_includes_paper_text():
    paper_text = "We propose a novel attention mechanism."
    prompt = build_user_prompt(paper_text)
    assert "We propose a novel attention mechanism." in prompt


def test_user_prompt_has_reasonable_length():
    paper_text = "Short paper." * 100
    prompt = build_user_prompt(paper_text)
    assert len(prompt) > len(paper_text)


# --- Generator tests (mocked OpenAI) ---

MOCK_RESPONSE_CELLS = [
    {"cell_type": "markdown", "source": "# Attention Is All You Need\n\nPaper replication notebook."},
    {"cell_type": "code", "source": "import numpy as np\nimport matplotlib.pyplot as plt"},
    {"cell_type": "markdown", "source": "## Abstract\n\nWe propose the Transformer architecture."},
    {"cell_type": "code", "source": "# Synthetic data\nX = np.random.randn(100, 512)\nprint(X.shape)"},
]


def _make_mock_response(cells):
    """Create a mock OpenAI chat completion response."""
    content = json.dumps({"cells": cells})
    mock_message = MagicMock()
    mock_message.content = content
    mock_choice = MagicMock()
    mock_choice.message = mock_message
    mock_response = MagicMock()
    mock_response.choices = [mock_choice]
    mock_response.usage = MagicMock(prompt_tokens=1000, completion_tokens=5000, total_tokens=6000)
    return mock_response


@pytest.mark.asyncio
async def test_generate_notebook_content_returns_cells():
    mock_response = _make_mock_response(MOCK_RESPONSE_CELLS)

    with patch("notebook_generator.openai.AsyncOpenAI") as MockClient:
        instance = MockClient.return_value
        instance.chat = MagicMock()
        instance.chat.completions = MagicMock()
        instance.chat.completions.create = AsyncMock(return_value=mock_response)

        result = await generate_notebook_content(
            paper_text="We propose the Transformer...",
            api_key="sk-test-key",
        )

    assert "cells" in result
    assert len(result["cells"]) == 4
    assert result["cells"][0]["cell_type"] == "markdown"
    assert result["cells"][1]["cell_type"] == "code"


@pytest.mark.asyncio
async def test_generate_notebook_content_uses_correct_model():
    mock_response = _make_mock_response(MOCK_RESPONSE_CELLS)

    with patch("notebook_generator.openai.AsyncOpenAI") as MockClient:
        instance = MockClient.return_value
        instance.chat = MagicMock()
        instance.chat.completions = MagicMock()
        instance.chat.completions.create = AsyncMock(return_value=mock_response)

        await generate_notebook_content(
            paper_text="Some paper text",
            api_key="sk-test-key",
        )

        call_kwargs = instance.chat.completions.create.call_args[1]
        assert call_kwargs["model"] == "gpt-5.4"


@pytest.mark.asyncio
async def test_generate_notebook_content_passes_api_key():
    mock_response = _make_mock_response(MOCK_RESPONSE_CELLS)

    with patch("notebook_generator.openai.AsyncOpenAI") as MockClient:
        instance = MockClient.return_value
        instance.chat = MagicMock()
        instance.chat.completions = MagicMock()
        instance.chat.completions.create = AsyncMock(return_value=mock_response)

        await generate_notebook_content(
            paper_text="Some paper text",
            api_key="sk-my-secret-key",
        )

        MockClient.assert_called_once_with(api_key="sk-my-secret-key")


@pytest.mark.asyncio
async def test_generate_notebook_content_handles_api_error():
    with patch("notebook_generator.openai.AsyncOpenAI") as MockClient:
        instance = MockClient.return_value
        instance.chat = MagicMock()
        instance.chat.completions = MagicMock()
        instance.chat.completions.create = AsyncMock(
            side_effect=Exception("API rate limit exceeded")
        )

        with pytest.raises(RuntimeError, match="OpenAI API error"):
            await generate_notebook_content(
                paper_text="Some paper text",
                api_key="sk-test-key",
            )


@pytest.mark.asyncio
async def test_generate_notebook_content_handles_invalid_json():
    mock_message = MagicMock()
    mock_message.content = "This is not valid JSON at all"
    mock_choice = MagicMock()
    mock_choice.message = mock_message
    mock_response = MagicMock()
    mock_response.choices = [mock_choice]
    mock_response.usage = MagicMock(prompt_tokens=100, completion_tokens=200, total_tokens=300)

    with patch("notebook_generator.openai.AsyncOpenAI") as MockClient:
        instance = MockClient.return_value
        instance.chat = MagicMock()
        instance.chat.completions = MagicMock()
        instance.chat.completions.create = AsyncMock(return_value=mock_response)

        with pytest.raises(RuntimeError, match="parse"):
            await generate_notebook_content(
                paper_text="Some paper text",
                api_key="sk-test-key",
            )
