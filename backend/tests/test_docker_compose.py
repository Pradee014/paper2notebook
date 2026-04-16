"""Validate docker-compose.yml exists and has correct service configuration."""

import os
import yaml
import pytest


COMPOSE_PATH = os.path.join(
    os.path.dirname(__file__), "..", "..", "docker-compose.yml"
)


def test_compose_file_exists():
    assert os.path.isfile(COMPOSE_PATH)


def test_compose_is_valid_yaml():
    with open(COMPOSE_PATH) as f:
        data = yaml.safe_load(f)
    assert isinstance(data, dict)


def test_compose_has_backend_and_frontend_services():
    with open(COMPOSE_PATH) as f:
        data = yaml.safe_load(f)
    services = set(data.get("services", {}).keys())
    assert "backend" in services
    assert "frontend" in services


def test_backend_service_on_port_8000():
    with open(COMPOSE_PATH) as f:
        data = yaml.safe_load(f)
    backend = data["services"]["backend"]
    ports_str = str(backend.get("ports", []))
    assert "8000" in ports_str


def test_frontend_service_on_port_3000():
    with open(COMPOSE_PATH) as f:
        data = yaml.safe_load(f)
    frontend = data["services"]["frontend"]
    ports_str = str(frontend.get("ports", []))
    assert "3000" in ports_str


def test_backend_has_cors_origins_env():
    with open(COMPOSE_PATH) as f:
        data = yaml.safe_load(f)
    backend = data["services"]["backend"]
    env = backend.get("environment", {})
    env_str = str(env)
    assert "CORS_ORIGINS" in env_str


def test_frontend_has_api_url_env():
    with open(COMPOSE_PATH) as f:
        data = yaml.safe_load(f)
    frontend = data["services"]["frontend"]
    # Could be build arg or environment
    compose_str = str(frontend)
    assert "NEXT_PUBLIC_API_URL" in compose_str


def test_backend_has_health_check():
    with open(COMPOSE_PATH) as f:
        data = yaml.safe_load(f)
    backend = data["services"]["backend"]
    assert "healthcheck" in backend
    health_str = str(backend["healthcheck"])
    assert "health" in health_str
