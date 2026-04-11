"""Tests for hardened prompt structure against injection."""

import pytest

from prompts import build_system_prompt, build_user_prompt


class TestSystemPromptHardening:
    def test_system_prompt_contains_anti_injection_clause(self):
        prompt = build_system_prompt()
        assert "ignore" in prompt.lower() or "override" in prompt.lower()
        # Should explicitly warn the model about injection attempts
        assert "instruction" in prompt.lower()

    def test_system_prompt_specifies_role_boundary(self):
        prompt = build_system_prompt()
        # Should tell the model to treat paper content as data, not instructions
        assert "data" in prompt.lower() or "content" in prompt.lower()

    def test_system_prompt_still_has_notebook_structure(self):
        """Hardening should not remove the original notebook instructions."""
        prompt = build_system_prompt()
        assert "cells" in prompt.lower()
        assert "markdown" in prompt.lower()
        assert "code" in prompt.lower()
        assert "json" in prompt.lower()


class TestUserPromptHardening:
    def test_user_prompt_wraps_text_in_xml_delimiters(self):
        text = "This is a sample paper about attention mechanisms."
        prompt = build_user_prompt(text)
        assert "<paper-content>" in prompt
        assert "</paper-content>" in prompt

    def test_paper_text_is_inside_delimiters(self):
        text = "Attention Is All You Need"
        prompt = build_user_prompt(text)
        start = prompt.index("<paper-content>")
        end = prompt.index("</paper-content>")
        content_between = prompt[start:end]
        assert "Attention Is All You Need" in content_between

    def test_has_post_content_instruction_anchor(self):
        """After the closing delimiter, there should be a reinforcement instruction."""
        text = "Some paper text"
        prompt = build_user_prompt(text)
        closing_tag_pos = prompt.index("</paper-content>")
        after_content = prompt[closing_tag_pos:]
        # Should have instruction text after the closing tag
        assert len(after_content) > len("</paper-content>") + 10

    def test_old_raw_interpolation_replaced(self):
        """The old f-string with raw {paper_text} between --- delimiters should be gone."""
        text = "Test paper"
        prompt = build_user_prompt(text)
        # Old format used --- delimiters
        lines = prompt.split("\n")
        # Should NOT have the old pattern of bare --- around the text
        bare_dashes = [l for l in lines if l.strip() == "---"]
        assert len(bare_dashes) == 0, "Old --- delimiters should be replaced with XML tags"
