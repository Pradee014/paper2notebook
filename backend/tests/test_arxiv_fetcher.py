"""Tests for arXiv URL/ID parsing and PDF fetching."""

import pytest

from arxiv_fetcher import parse_arxiv_id, fetch_arxiv_pdf, ArxivFetchError


class TestParseArxivId:
    """Test extraction of arXiv paper IDs from various URL formats."""

    def test_bare_new_format_id(self):
        assert parse_arxiv_id("1706.03762") == "1706.03762"

    def test_bare_new_format_id_with_version(self):
        assert parse_arxiv_id("1706.03762v5") == "1706.03762"

    def test_abs_url(self):
        assert parse_arxiv_id("https://arxiv.org/abs/1706.03762") == "1706.03762"

    def test_pdf_url(self):
        assert parse_arxiv_id("https://arxiv.org/pdf/1706.03762") == "1706.03762"

    def test_pdf_url_with_extension(self):
        assert parse_arxiv_id("https://arxiv.org/pdf/1706.03762.pdf") == "1706.03762"

    def test_abs_url_with_version(self):
        assert parse_arxiv_id("https://arxiv.org/abs/1706.03762v5") == "1706.03762"

    def test_http_url(self):
        assert parse_arxiv_id("http://arxiv.org/abs/1706.03762") == "1706.03762"

    def test_old_format_id(self):
        """Old arXiv IDs like hep-ph/9905221."""
        assert parse_arxiv_id("hep-ph/9905221") == "hep-ph/9905221"

    def test_old_format_abs_url(self):
        assert parse_arxiv_id("https://arxiv.org/abs/hep-ph/9905221") == "hep-ph/9905221"

    def test_whitespace_stripped(self):
        assert parse_arxiv_id("  1706.03762  ") == "1706.03762"

    def test_invalid_url_raises(self):
        with pytest.raises(ArxivFetchError, match="Could not parse arXiv"):
            parse_arxiv_id("https://google.com/paper.pdf")

    def test_empty_string_raises(self):
        with pytest.raises(ArxivFetchError, match="Could not parse arXiv"):
            parse_arxiv_id("")

    def test_random_text_raises(self):
        with pytest.raises(ArxivFetchError, match="Could not parse arXiv"):
            parse_arxiv_id("not a real id")


class TestFetchArxivPdf:
    """Test PDF fetching from arXiv (uses mocked HTTP)."""

    @pytest.mark.asyncio
    async def test_successful_fetch_returns_pdf_bytes(self, monkeypatch):
        """Valid arXiv ID returns PDF bytes starting with %PDF."""
        fake_pdf = b"%PDF-1.4 " + b"x" * 2000

        async def mock_get(self, url, **kwargs):
            class MockResponse:
                status_code = 200
                content = fake_pdf
            return MockResponse()

        import httpx
        monkeypatch.setattr(httpx.AsyncClient, "get", mock_get)
        result = await fetch_arxiv_pdf("1706.03762")
        assert result[:4] == b"%PDF"
        assert len(result) > 1024

    @pytest.mark.asyncio
    async def test_404_raises_error(self, monkeypatch):
        """Non-existent paper returns a clear error."""

        async def mock_get(self, url, **kwargs):
            class MockResponse:
                status_code = 404
                content = b"Not Found"
            return MockResponse()

        import httpx
        monkeypatch.setattr(httpx.AsyncClient, "get", mock_get)
        with pytest.raises(ArxivFetchError, match="not found"):
            await fetch_arxiv_pdf("9999.99999")

    @pytest.mark.asyncio
    async def test_non_pdf_response_raises_error(self, monkeypatch):
        """If arXiv returns HTML instead of PDF, raise an error."""

        async def mock_get(self, url, **kwargs):
            class MockResponse:
                status_code = 200
                content = b"<html>rate limited</html>"
            return MockResponse()

        import httpx
        monkeypatch.setattr(httpx.AsyncClient, "get", mock_get)
        with pytest.raises(ArxivFetchError, match="not a valid PDF"):
            await fetch_arxiv_pdf("1706.03762")

    @pytest.mark.asyncio
    async def test_connection_error_raises(self, monkeypatch):
        """Network errors are wrapped in ArxivFetchError."""
        import httpx

        async def mock_get(self, url, **kwargs):
            raise httpx.ConnectError("Connection refused")

        monkeypatch.setattr(httpx.AsyncClient, "get", mock_get)
        with pytest.raises(ArxivFetchError, match="connect to arXiv"):
            await fetch_arxiv_pdf("1706.03762")

    @pytest.mark.asyncio
    async def test_fetch_uses_correct_pdf_url(self, monkeypatch):
        """Verify the fetcher hits the correct arXiv PDF URL."""
        captured_url = None
        fake_pdf = b"%PDF-1.4 " + b"x" * 2000

        async def mock_get(self, url, **kwargs):
            nonlocal captured_url
            captured_url = url

            class MockResponse:
                status_code = 200
                content = fake_pdf
            return MockResponse()

        import httpx
        monkeypatch.setattr(httpx.AsyncClient, "get", mock_get)
        await fetch_arxiv_pdf("1706.03762")
        assert captured_url == "https://arxiv.org/pdf/1706.03762"
