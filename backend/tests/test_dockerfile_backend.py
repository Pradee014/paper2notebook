"""Validate the backend Dockerfile exists and follows best practices."""

import os
import pytest


DOCKERFILE_PATH = os.path.join(
    os.path.dirname(__file__), "..", "..", "Dockerfile.backend"
)


def test_dockerfile_exists():
    assert os.path.isfile(DOCKERFILE_PATH), f"Dockerfile.backend not found at {DOCKERFILE_PATH}"


def test_dockerfile_uses_python_312_slim():
    with open(DOCKERFILE_PATH) as f:
        content = f.read()
    assert "python:3.12-slim" in content


def test_dockerfile_has_non_root_user():
    with open(DOCKERFILE_PATH) as f:
        content = f.read()
    # Should create and switch to a non-root user
    assert "useradd" in content or "adduser" in content or "USER" in content


def test_dockerfile_exposes_port_8000():
    with open(DOCKERFILE_PATH) as f:
        content = f.read()
    assert "8000" in content


def test_dockerfile_runs_uvicorn():
    with open(DOCKERFILE_PATH) as f:
        content = f.read()
    assert "uvicorn" in content


def test_dockerfile_does_not_include_test_deps():
    """Production image should not install pytest or dev dependencies."""
    with open(DOCKERFILE_PATH) as f:
        content = f.read()
    # Should reference requirements-prod.txt or filter out test deps
    assert "pytest" not in content.lower()


def test_cors_origins_env_var_supported():
    """main.py should read CORS_ORIGINS from environment."""
    main_path = os.path.join(os.path.dirname(__file__), "..", "main.py")
    with open(main_path) as f:
        content = f.read()
    assert "CORS_ORIGINS" in content
