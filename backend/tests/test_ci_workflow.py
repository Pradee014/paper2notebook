"""Validate the CI workflow YAML exists and has required jobs."""

import os
import yaml
import pytest


CI_WORKFLOW_PATH = os.path.join(
    os.path.dirname(__file__), "..", "..", ".github", "workflows", "ci.yml"
)


def test_ci_workflow_file_exists():
    assert os.path.isfile(CI_WORKFLOW_PATH), f"CI workflow not found at {CI_WORKFLOW_PATH}"


def test_ci_workflow_is_valid_yaml():
    with open(CI_WORKFLOW_PATH) as f:
        data = yaml.safe_load(f)
    assert isinstance(data, dict), "CI workflow is not a valid YAML mapping"


def test_ci_workflow_triggers_on_push_and_pr():
    with open(CI_WORKFLOW_PATH) as f:
        data = yaml.safe_load(f)
    # YAML parses "on:" as boolean True
    triggers = data.get("on") or data.get(True)
    assert triggers is not None, "No 'on' trigger key found"
    assert "push" in triggers
    assert "pull_request" in triggers


def test_ci_workflow_has_required_jobs():
    with open(CI_WORKFLOW_PATH) as f:
        data = yaml.safe_load(f)
    jobs = data.get("jobs", {})
    job_names = set(jobs.keys())
    required = {"backend-tests", "frontend-tests", "security-scan", "dependency-audit"}
    assert required.issubset(job_names), f"Missing jobs: {required - job_names}"


def test_backend_tests_job_runs_pytest():
    with open(CI_WORKFLOW_PATH) as f:
        data = yaml.safe_load(f)
    job = data["jobs"]["backend-tests"]
    steps_text = yaml.dump(job["steps"])
    assert "pytest" in steps_text


def test_frontend_tests_job_runs_vitest_and_playwright():
    with open(CI_WORKFLOW_PATH) as f:
        data = yaml.safe_load(f)
    job = data["jobs"]["frontend-tests"]
    steps_text = yaml.dump(job["steps"])
    assert "vitest" in steps_text or "test" in steps_text
    assert "playwright" in steps_text.lower()


def test_security_scan_job_runs_semgrep():
    with open(CI_WORKFLOW_PATH) as f:
        data = yaml.safe_load(f)
    job = data["jobs"]["security-scan"]
    steps_text = yaml.dump(job["steps"])
    assert "semgrep" in steps_text.lower()


def test_dependency_audit_job_runs_pip_audit_and_npm_audit():
    with open(CI_WORKFLOW_PATH) as f:
        data = yaml.safe_load(f)
    job = data["jobs"]["dependency-audit"]
    steps_text = yaml.dump(job["steps"])
    assert "pip-audit" in steps_text or "pip_audit" in steps_text
    assert "npm audit" in steps_text
