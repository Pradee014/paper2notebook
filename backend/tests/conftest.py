"""Shared test fixtures."""

import pytest
from main import limiter


@pytest.fixture(autouse=True)
def reset_rate_limiter():
    """Reset the rate limiter storage before each test to prevent cross-test interference."""
    limiter.reset()
    yield
