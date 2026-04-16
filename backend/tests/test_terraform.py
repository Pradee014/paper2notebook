"""Validate Terraform files exist and contain required resources."""

import os
import glob
import pytest


INFRA_DIR = os.path.join(os.path.dirname(__file__), "..", "..", "infra")


def _read_all_tf():
    """Read and concatenate all .tf files in the infra directory."""
    tf_files = glob.glob(os.path.join(INFRA_DIR, "*.tf"))
    content = ""
    for f in tf_files:
        with open(f) as fh:
            content += fh.read() + "\n"
    return content


def test_infra_directory_exists():
    assert os.path.isdir(INFRA_DIR)


def test_main_tf_exists():
    assert os.path.isfile(os.path.join(INFRA_DIR, "main.tf"))


def test_variables_tf_exists():
    assert os.path.isfile(os.path.join(INFRA_DIR, "variables.tf"))


def test_outputs_tf_exists():
    assert os.path.isfile(os.path.join(INFRA_DIR, "outputs.tf"))


def test_terraform_has_aws_provider():
    content = _read_all_tf()
    assert 'provider "aws"' in content


def test_terraform_has_vpc():
    content = _read_all_tf()
    assert "aws_vpc" in content


def test_terraform_has_public_and_private_subnets():
    content = _read_all_tf()
    assert "aws_subnet" in content
    # Should have both public and private
    assert "public" in content.lower()
    assert "private" in content.lower()


def test_terraform_has_alb():
    content = _read_all_tf()
    assert "aws_lb" in content or "aws_alb" in content


def test_terraform_has_ecs_cluster():
    content = _read_all_tf()
    assert "aws_ecs_cluster" in content


def test_terraform_has_ecs_services():
    content = _read_all_tf()
    assert "aws_ecs_service" in content
    assert "aws_ecs_task_definition" in content


def test_terraform_has_ecr_repositories():
    content = _read_all_tf()
    assert "aws_ecr_repository" in content


def test_terraform_has_security_groups():
    content = _read_all_tf()
    assert "aws_security_group" in content


def test_terraform_has_cloudwatch_log_groups():
    content = _read_all_tf()
    assert "aws_cloudwatch_log_group" in content


def test_terraform_has_nat_gateway():
    content = _read_all_tf()
    assert "aws_nat_gateway" in content


def test_terraform_has_image_tag_variables():
    content = _read_all_tf()
    assert "backend_image_tag" in content
    assert "frontend_image_tag" in content


def test_terraform_outputs_alb_dns():
    with open(os.path.join(INFRA_DIR, "outputs.tf")) as f:
        content = f.read()
    assert "alb" in content.lower() and "dns" in content.lower()


def test_terraform_defaults_to_us_east_1():
    content = _read_all_tf()
    assert "us-east-1" in content
