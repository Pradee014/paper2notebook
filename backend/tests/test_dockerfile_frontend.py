"""Validate the frontend Dockerfile exists and follows best practices."""

import os
import pytest


DOCKERFILE_PATH = os.path.join(
    os.path.dirname(__file__), "..", "..", "Dockerfile.frontend"
)

NEXT_CONFIG_PATH = os.path.join(
    os.path.dirname(__file__), "..", "..", "frontend", "next.config.ts"
)


def test_dockerfile_exists():
    assert os.path.isfile(DOCKERFILE_PATH)


def test_dockerfile_uses_node_20_alpine():
    with open(DOCKERFILE_PATH) as f:
        content = f.read()
    assert "node:20-alpine" in content


def test_dockerfile_is_multi_stage():
    with open(DOCKERFILE_PATH) as f:
        content = f.read()
    # Should have at least 2 FROM statements (multi-stage build)
    from_count = content.count("FROM ")
    assert from_count >= 2, f"Expected multi-stage build, found {from_count} FROM"


def test_dockerfile_has_non_root_user():
    with open(DOCKERFILE_PATH) as f:
        content = f.read()
    assert "nextjs" in content.lower() or "appuser" in content.lower() or "adduser" in content


def test_dockerfile_exposes_port_3000():
    with open(DOCKERFILE_PATH) as f:
        content = f.read()
    assert "3000" in content


def test_dockerfile_uses_standalone():
    with open(DOCKERFILE_PATH) as f:
        content = f.read()
    assert "standalone" in content


def test_dockerfile_supports_api_url_build_arg():
    with open(DOCKERFILE_PATH) as f:
        content = f.read()
    assert "NEXT_PUBLIC_API_URL" in content


def test_next_config_has_standalone_output():
    with open(NEXT_CONFIG_PATH) as f:
        content = f.read()
    assert "standalone" in content
