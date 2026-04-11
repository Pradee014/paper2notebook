import asyncio
import base64
import json
import logging

import openai
from fastapi import FastAPI, File, Form, Header, Request, UploadFile, HTTPException

logger = logging.getLogger("paper2notebook")
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import JSONResponse
from slowapi import Limiter
from slowapi.errors import RateLimitExceeded
from slowapi.util import get_remote_address
from starlette.middleware.base import BaseHTTPMiddleware
from sse_starlette.sse import EventSourceResponse

from pdf_parser import extract_text_from_pdf
from notebook_builder import build_notebook
from notebook_generator import generate_notebook_content
from prompts import build_system_prompt, build_user_prompt
from sanitizer import sanitize_text
from output_validator import validate_notebook_safety

limiter = Limiter(key_func=get_remote_address)

app = FastAPI(
    title="Paper2Notebook API",
    description="Convert research papers to structured Jupyter notebooks",
    version="0.1.0",
)

app.state.limiter = limiter


def _rate_limit_exceeded_handler(request: Request, exc: RateLimitExceeded) -> JSONResponse:
    return JSONResponse(
        status_code=429,
        content={"detail": "Rate limit exceeded. Please try again later."},
    )


app.add_exception_handler(RateLimitExceeded, _rate_limit_exceeded_handler)


class SecurityHeadersMiddleware(BaseHTTPMiddleware):
    async def dispatch(self, request: Request, call_next):
        response = await call_next(request)
        response.headers["X-Content-Type-Options"] = "nosniff"
        response.headers["X-Frame-Options"] = "DENY"
        response.headers["Referrer-Policy"] = "strict-origin-when-cross-origin"
        response.headers["Permissions-Policy"] = "camera=(), microphone=(), geolocation=()"
        return response


app.add_middleware(SecurityHeadersMiddleware)

app.add_middleware(
    CORSMiddleware,
    allow_origins=["http://localhost:3000"],
    allow_credentials=True,
    allow_methods=["GET", "POST", "OPTIONS"],
    allow_headers=["Content-Type", "Accept", "Authorization"],
)


@app.get("/api/health")
async def health_check():
    return {"status": "ok", "service": "paper2notebook"}


PROVIDER_CONFIG = {
    "openai": {
        "base_url": None,
        "model": "gpt-5.4",
        "label": "OpenAI",
    },
    "gemini": {
        "base_url": "https://generativelanguage.googleapis.com/v1beta/openai/",
        "model": "gemini-2.5-flash",
        "label": "Gemini",
    },
}


LLM_TIMEOUT_SECONDS = 120  # 2 minutes — max time to wait for LLM response

MIN_FILE_SIZE = 1024  # 1 KB — anything smaller is not a real paper PDF
MAX_FILE_SIZE = 50 * 1024 * 1024  # 50 MB
PDF_MAGIC_BYTES = b"%PDF"


def _validate_pdf_contents(contents: bytes) -> None:
    """Validate uploaded file is a real PDF by checking magic bytes and size."""
    if len(contents) < MIN_FILE_SIZE:
        raise HTTPException(status_code=400, detail="File is too small to be a valid PDF")
    if len(contents) > MAX_FILE_SIZE:
        raise HTTPException(status_code=400, detail="File exceeds 50 MB limit")
    if not contents[:4].startswith(PDF_MAGIC_BYTES):
        raise HTTPException(status_code=400, detail="File is not a valid PDF (invalid file signature)")


def _extract_api_key(authorization: str | None) -> str:
    """Extract API key from Authorization: Bearer <key> header."""
    if not authorization:
        raise HTTPException(status_code=401, detail="Missing Authorization header")
    if not authorization.startswith("Bearer "):
        raise HTTPException(status_code=401, detail="Authorization header must use Bearer scheme")
    key = authorization[len("Bearer "):]
    if not key.strip():
        raise HTTPException(status_code=401, detail="Empty API key")
    return key.strip()


def _friendly_api_error(label: str, exc: Exception) -> str:
    """Turn verbose SDK exceptions into short, actionable messages."""
    msg = str(exc)
    status = getattr(exc, "status_code", None)
    if status == 401 or "API key not valid" in msg or "Incorrect API key" in msg:
        return f"Invalid {label} API key. Please check and try again."
    if status == 429 or "quota" in msg.lower() or "rate" in msg.lower():
        return f"{label} quota exceeded. Check your plan and billing at your provider dashboard."
    if status == 404 or "model" in msg.lower() and "not found" in msg.lower():
        return f"{label} model not available. It may require a paid plan."
    return f"{label} API error: {msg[:200]}"


@app.post("/api/extract")
@limiter.limit("10/minute")
async def extract_pdf(
    request: Request,
    file: UploadFile = File(...),
    authorization: str | None = Header(None),
):
    api_key = _extract_api_key(authorization)
    if not file.filename or not file.filename.lower().endswith(".pdf"):
        raise HTTPException(status_code=400, detail="Only PDF files are accepted")

    contents = await file.read()
    _validate_pdf_contents(contents)

    try:
        result = extract_text_from_pdf(contents)
    except ValueError as e:
        raise HTTPException(status_code=400, detail=str(e))

    return result


@app.post("/api/generate")
@limiter.limit("5/minute")
async def generate_notebook(
    request: Request,
    file: UploadFile = File(...),
    provider: str = Form("openai"),
    authorization: str | None = Header(None),
):
    api_key = _extract_api_key(authorization)
    if provider not in PROVIDER_CONFIG:
        raise HTTPException(status_code=400, detail=f"Unsupported provider: {provider}")

    prov = PROVIDER_CONFIG[provider]

    # Validate file type before starting SSE stream
    if not file.filename or not file.filename.lower().endswith(".pdf"):
        raise HTTPException(status_code=400, detail="Only PDF files are accepted")

    contents = await file.read()
    _validate_pdf_contents(contents)

    async def event_stream():
        # Step 1: Extract text
        yield {"event": "progress", "data": "Extracting text from PDF..."}
        await asyncio.sleep(0)

        try:
            result = extract_text_from_pdf(contents)
        except ValueError as e:
            yield {"event": "error", "data": json.dumps({"message": str(e)})}
            return

        paper_text = sanitize_text(result["text"])
        page_count = result["pages"]

        yield {
            "event": "progress",
            "data": f"Extracted {len(paper_text):,} characters from {page_count} page(s).",
        }

        # Step 2: Analyze structure
        yield {"event": "progress", "data": "Analyzing paper structure..."}
        await asyncio.sleep(0)

        # Step 3: Call LLM
        yield {"event": "progress", "data": f"Sending to {prov['label']} ({prov['model']}) for notebook generation..."}
        yield {"event": "progress", "data": "Generating mathematical formulations..."}

        client_kwargs = {"api_key": api_key}
        if prov["base_url"]:
            client_kwargs["base_url"] = prov["base_url"]
        client = openai.AsyncOpenAI(**client_kwargs)

        try:
            response = await asyncio.wait_for(
                client.chat.completions.create(
                    model=prov["model"],
                    messages=[
                        {"role": "system", "content": build_system_prompt()},
                        {"role": "user", "content": build_user_prompt(paper_text)},
                    ],
                    temperature=0.3,
                    max_tokens=16000,
                ),
                timeout=LLM_TIMEOUT_SECONDS,
            )
        except asyncio.TimeoutError:
            logger.error("LLM call timed out after %d seconds", LLM_TIMEOUT_SECONDS)
            yield {"event": "error", "data": json.dumps({"message": "Request timed out. The paper may be too complex — please try again."})}
            return
        except openai.AuthenticationError as e:
            logger.error("LLM authentication error: %s", e)
            yield {"event": "error", "data": json.dumps({"message": f"Invalid {prov['label']} API key. Please check and try again."})}
            return
        except openai.RateLimitError as e:
            logger.error("LLM rate limit error: %s", e)
            yield {"event": "error", "data": json.dumps({"message": f"{prov['label']} quota exceeded. Check your plan and billing at your provider dashboard."})}
            return
        except openai.APIConnectionError as e:
            logger.error("LLM connection error: %s", e)
            yield {"event": "error", "data": json.dumps({"message": f"Could not connect to {prov['label']}. Please check your network and try again."})}
            return
        except openai.APIError as e:
            logger.error("LLM API error (status=%s): %s", getattr(e, "status_code", "?"), e)
            yield {"event": "error", "data": json.dumps({"message": f"{prov['label']} service error. Please try again later."})}
            return
        except Exception as e:
            logger.error("Unexpected LLM error: %s", e)
            yield {"event": "error", "data": json.dumps({"message": "An unexpected error occurred during generation. Please try again."})}
            return

        yield {"event": "progress", "data": "Generating implementation code..."}
        await asyncio.sleep(0)

        # Step 4: Parse response
        yield {"event": "progress", "data": "Parsing notebook structure..."}
        raw_content = response.choices[0].message.content

        try:
            from notebook_generator import _parse_json_response
            notebook_data = _parse_json_response(raw_content)
        except (json.JSONDecodeError, ValueError) as e:
            logger.error("Failed to parse LLM response: %s", e)
            yield {"event": "error", "data": json.dumps({"message": "Failed to parse the generated notebook. Please try again."})}
            return

        yield {"event": "progress", "data": f"Generated {len(notebook_data['cells'])} notebook cells."}

        # Step 4b: Validate output safety
        safety_warnings = validate_notebook_safety(notebook_data["cells"])
        if safety_warnings:
            notebook_data["safety_warnings"] = safety_warnings
            yield {
                "event": "progress",
                "data": f"Safety scan: {len(safety_warnings)} warning(s) found in generated code.",
            }

        # Step 5: Build .ipynb
        yield {"event": "progress", "data": "Building notebook..."}

        try:
            ipynb_str = build_notebook(notebook_data["cells"])
        except Exception as e:
            logger.error("Notebook assembly error: %s", e)
            yield {"event": "error", "data": json.dumps({"message": "Failed to assemble the notebook file. Please try again."})}
            return

        ipynb_base64 = base64.b64encode(ipynb_str.encode("utf-8")).decode("ascii")
        notebook_data["ipynb_base64"] = ipynb_base64

        yield {"event": "complete", "data": json.dumps(notebook_data)}

    return EventSourceResponse(event_stream())
