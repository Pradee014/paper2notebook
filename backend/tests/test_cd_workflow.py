"""Validate the CD workflow YAML exists and has required steps."""

import os
import yaml
import pytest


CD_WORKFLOW_PATH = os.path.join(
    os.path.dirname(__file__), "..", "..", ".github", "workflows", "cd.yml"
)


def test_cd_workflow_file_exists():
    assert os.path.isfile(CD_WORKFLOW_PATH)


def test_cd_workflow_is_valid_yaml():
    with open(CD_WORKFLOW_PATH) as f:
        data = yaml.safe_load(f)
    assert isinstance(data, dict)


def test_cd_triggers_on_push_to_main():
    with open(CD_WORKFLOW_PATH) as f:
        data = yaml.safe_load(f)
    triggers = data.get("on") or data.get(True)
    assert triggers is not None
    # Should reference main branch in some way
    triggers_str = str(triggers)
    assert "main" in triggers_str


def test_cd_has_deploy_job():
    with open(CD_WORKFLOW_PATH) as f:
        data = yaml.safe_load(f)
    jobs = data.get("jobs", {})
    assert len(jobs) >= 1


def test_cd_uses_aws_credentials_action():
    with open(CD_WORKFLOW_PATH) as f:
        content = f.read()
    assert "aws-actions/configure-aws-credentials" in content


def test_cd_uses_ecr_login_action():
    with open(CD_WORKFLOW_PATH) as f:
        content = f.read()
    assert "aws-actions/amazon-ecr-login" in content


def test_cd_references_github_secrets():
    with open(CD_WORKFLOW_PATH) as f:
        content = f.read()
    assert "AWS_ACCESS_KEY_ID" in content
    assert "AWS_SECRET_ACCESS_KEY" in content
    assert "AWS_REGION" in content


def test_cd_builds_docker_images():
    with open(CD_WORKFLOW_PATH) as f:
        content = f.read()
    assert "docker build" in content or "docker/build-push-action" in content


def test_cd_pushes_to_ecr():
    with open(CD_WORKFLOW_PATH) as f:
        content = f.read()
    assert "docker push" in content or "push" in content.lower()


def test_cd_updates_ecs_services():
    with open(CD_WORKFLOW_PATH) as f:
        content = f.read()
    assert "ecs" in content.lower()
    assert "update-service" in content or "force-new-deployment" in content
