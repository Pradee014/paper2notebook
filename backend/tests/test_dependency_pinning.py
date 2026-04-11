"""Tests for dependency version pinning — ensures all deps have upper bounds."""

import os
import re


REQUIREMENTS_PATH = os.path.join(
    os.path.dirname(__file__), "..", "requirements.txt"
)


def test_all_dependencies_have_upper_bounds():
    """Every dependency in requirements.txt must have an upper bound (<N.0.0)."""
    with open(REQUIREMENTS_PATH) as f:
        lines = [l.strip() for l in f if l.strip() and not l.startswith("#")]

    for line in lines:
        # Each line should contain either < or ~= (compatible release) for an upper bound
        assert "<" in line or "~=" in line or "==" in line, (
            f"Dependency '{line}' has no upper bound. "
            f"Add a constraint like '<2.0.0' to prevent breaking changes."
        )


def test_no_open_ended_gte_without_ceiling():
    """No dependency should use >= without also having <."""
    with open(REQUIREMENTS_PATH) as f:
        lines = [l.strip() for l in f if l.strip() and not l.startswith("#")]

    for line in lines:
        if ">=" in line:
            assert "<" in line, (
                f"Dependency '{line}' uses >= without <. "
                f"Add an upper bound like ',<2.0.0'."
            )
