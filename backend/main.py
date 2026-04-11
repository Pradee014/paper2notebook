import asyncio
import json

import openai
from fastapi import FastAPI, File, Form, UploadFile, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from sse_starlette.sse import EventSourceResponse

from pdf_parser import extract_text_from_pdf
from notebook_generator import generate_notebook_content
from prompts import build_system_prompt, build_user_prompt

app = FastAPI(
    title="Paper2Notebook API",
    description="Convert research papers to structured Jupyter notebooks",
    version="0.1.0",
)

app.add_middleware(
    CORSMiddleware,
    allow_origins=["http://localhost:3000"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)


@app.get("/api/health")
async def health_check():
    return {"status": "ok", "service": "paper2notebook"}


@app.post("/api/extract")
async def extract_pdf(
    file: UploadFile = File(...),
    api_key: str = Form(...),
):
    if not file.filename or not file.filename.lower().endswith(".pdf"):
        raise HTTPException(status_code=400, detail="Only PDF files are accepted")

    contents = await file.read()

    if len(contents) > 50 * 1024 * 1024:
        raise HTTPException(status_code=400, detail="File exceeds 50 MB limit")

    try:
        result = extract_text_from_pdf(contents)
    except ValueError as e:
        raise HTTPException(status_code=400, detail=str(e))

    return result


@app.post("/api/generate")
async def generate_notebook(
    file: UploadFile = File(...),
    api_key: str = Form(...),
):
    # Validate file type before starting SSE stream
    if not file.filename or not file.filename.lower().endswith(".pdf"):
        raise HTTPException(status_code=400, detail="Only PDF files are accepted")

    contents = await file.read()

    if len(contents) > 50 * 1024 * 1024:
        raise HTTPException(status_code=400, detail="File exceeds 50 MB limit")

    async def event_stream():
        # Step 1: Extract text
        yield {"event": "progress", "data": "Extracting text from PDF..."}
        await asyncio.sleep(0)

        try:
            result = extract_text_from_pdf(contents)
        except ValueError as e:
            yield {"event": "error", "data": json.dumps({"message": str(e)})}
            return

        paper_text = result["text"]
        page_count = result["pages"]

        yield {
            "event": "progress",
            "data": f"Extracted {len(paper_text):,} characters from {page_count} page(s).",
        }

        # Step 2: Analyze structure
        yield {"event": "progress", "data": "Analyzing paper structure..."}
        await asyncio.sleep(0)

        # Step 3: Call GPT-5.4
        yield {"event": "progress", "data": "Sending to GPT-5.4 for notebook generation..."}
        yield {"event": "progress", "data": "Generating mathematical formulations..."}

        client = openai.AsyncOpenAI(api_key=api_key)

        try:
            response = await client.chat.completions.create(
                model="gpt-5.4",
                messages=[
                    {"role": "system", "content": build_system_prompt()},
                    {"role": "user", "content": build_user_prompt(paper_text)},
                ],
                temperature=0.3,
                max_tokens=16000,
            )
        except Exception as e:
            yield {"event": "error", "data": json.dumps({"message": f"OpenAI API error: {e}"})}
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
            yield {"event": "error", "data": json.dumps({"message": f"Failed to parse response: {e}"})}
            return

        yield {"event": "progress", "data": f"Generated {len(notebook_data['cells'])} notebook cells."}

        # Step 5: Complete
        yield {"event": "progress", "data": "Building notebook..."}
        yield {"event": "complete", "data": json.dumps(notebook_data)}

    return EventSourceResponse(event_stream())
