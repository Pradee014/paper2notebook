import pytest
from httpx import ASGITransport, AsyncClient

from main import app


@pytest.mark.asyncio
async def test_response_includes_x_content_type_options():
    transport = ASGITransport(app=app)
    async with AsyncClient(transport=transport, base_url="http://test") as client:
        response = await client.get("/api/health")
    assert response.headers.get("x-content-type-options") == "nosniff"


@pytest.mark.asyncio
async def test_response_includes_x_frame_options():
    transport = ASGITransport(app=app)
    async with AsyncClient(transport=transport, base_url="http://test") as client:
        response = await client.get("/api/health")
    assert response.headers.get("x-frame-options") == "DENY"


@pytest.mark.asyncio
async def test_response_includes_referrer_policy():
    transport = ASGITransport(app=app)
    async with AsyncClient(transport=transport, base_url="http://test") as client:
        response = await client.get("/api/health")
    assert response.headers.get("referrer-policy") == "strict-origin-when-cross-origin"


@pytest.mark.asyncio
async def test_response_includes_permissions_policy():
    transport = ASGITransport(app=app)
    async with AsyncClient(transport=transport, base_url="http://test") as client:
        response = await client.get("/api/health")
    assert response.headers.get("permissions-policy") == "camera=(), microphone=(), geolocation=()"


@pytest.mark.asyncio
async def test_cors_allows_only_get_post_options():
    transport = ASGITransport(app=app)
    async with AsyncClient(transport=transport, base_url="http://test") as client:
        response = await client.options(
            "/api/health",
            headers={
                "Origin": "http://localhost:3000",
                "Access-Control-Request-Method": "DELETE",
            },
        )
    # DELETE should not be in allowed methods
    allowed = response.headers.get("access-control-allow-methods", "")
    assert "DELETE" not in allowed


@pytest.mark.asyncio
async def test_cors_allows_specific_headers_only():
    transport = ASGITransport(app=app)
    async with AsyncClient(transport=transport, base_url="http://test") as client:
        response = await client.options(
            "/api/health",
            headers={
                "Origin": "http://localhost:3000",
                "Access-Control-Request-Method": "POST",
                "Access-Control-Request-Headers": "Content-Type, Authorization",
            },
        )
    allowed_headers = response.headers.get("access-control-allow-headers", "")
    assert "content-type" in allowed_headers.lower()
    assert "authorization" in allowed_headers.lower()


@pytest.mark.asyncio
async def test_cors_rejects_unknown_origin():
    transport = ASGITransport(app=app)
    async with AsyncClient(transport=transport, base_url="http://test") as client:
        response = await client.options(
            "/api/health",
            headers={
                "Origin": "http://evil.com",
                "Access-Control-Request-Method": "GET",
            },
        )
    # Should not reflect the evil origin
    origin = response.headers.get("access-control-allow-origin", "")
    assert "evil.com" not in origin
