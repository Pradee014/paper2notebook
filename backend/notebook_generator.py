import json
import re

import openai

from prompts import build_system_prompt, build_user_prompt

PROVIDER_CONFIG = {
    "openai": {
        "base_url": None,
        "model": "gpt-4o",
        "label": "OpenAI",
    },
    "gemini": {
        "base_url": "https://generativelanguage.googleapis.com/v1beta/openai/",
        "model": "gemini-2.0-flash",
        "label": "Gemini",
    },
}


async def generate_notebook_content(
    paper_text: str,
    api_key: str,
    provider: str = "openai",
) -> dict:
    """Call an LLM to generate structured notebook cells from paper text.

    Returns dict with 'cells' list, each having 'cell_type' and 'source'.
    Raises RuntimeError on API or parsing failures.
    """
    prov = PROVIDER_CONFIG.get(provider, PROVIDER_CONFIG["openai"])
    client_kwargs = {"api_key": api_key}
    if prov["base_url"]:
        client_kwargs["base_url"] = prov["base_url"]
    client = openai.AsyncOpenAI(**client_kwargs)

    try:
        response = await client.chat.completions.create(
            model=prov["model"],
            messages=[
                {"role": "system", "content": build_system_prompt()},
                {"role": "user", "content": build_user_prompt(paper_text)},
            ],
            temperature=0.3,
            max_tokens=16000,
        )
    except Exception as e:
        raise RuntimeError(f"{prov['label']} API error: {e}")

    raw_content = response.choices[0].message.content

    try:
        parsed = _parse_json_response(raw_content)
    except (json.JSONDecodeError, ValueError) as e:
        raise RuntimeError(f"Failed to parse model response as JSON: {e}")

    return parsed


def _parse_json_response(raw: str) -> dict:
    """Extract and parse JSON from the model response.

    Handles cases where the model wraps JSON in markdown code fences.
    """
    # Try direct parse first
    try:
        data = json.loads(raw)
        _validate_cells(data)
        return data
    except json.JSONDecodeError:
        pass

    # Try extracting from markdown code fences
    match = re.search(r"```(?:json)?\s*\n?(.*?)\n?```", raw, re.DOTALL)
    if match:
        data = json.loads(match.group(1))
        _validate_cells(data)
        return data

    raise ValueError("Response does not contain valid JSON")


def _validate_cells(data: dict) -> None:
    """Validate the parsed notebook structure."""
    if not isinstance(data, dict) or "cells" not in data:
        raise ValueError("Response missing 'cells' key")
    if not isinstance(data["cells"], list) or len(data["cells"]) == 0:
        raise ValueError("'cells' must be a non-empty list")
    for i, cell in enumerate(data["cells"]):
        if "cell_type" not in cell or "source" not in cell:
            raise ValueError(f"Cell {i} missing 'cell_type' or 'source'")
        if cell["cell_type"] not in ("markdown", "code"):
            raise ValueError(f"Cell {i} has invalid cell_type: {cell['cell_type']}")
