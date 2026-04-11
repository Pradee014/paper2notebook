# Sprint v1 — Walkthrough

## Summary
Built a full-stack web application where researchers upload an academic paper (PDF) and receive a highly structured, production-quality Jupyter notebook that replicates the paper's methodology using synthetic data. The frontend is a Next.js 16 app with a dark, retro-computing aesthetic inspired by ARC Prize. The backend is a Python FastAPI server that extracts text from PDFs via PyMuPDF, calls OpenAI GPT-5.4 for notebook generation, assembles valid `.ipynb` files via nbformat, and streams real-time progress to the browser via Server-Sent Events. All 10 planned tasks were completed with 79 passing tests.

## Architecture Overview

```
┌──────────────────────────────────────────────────────────┐
│                    Browser (:3000)                         │
│                                                           │
│  ┌────────────┐   ┌────────────┐   ┌──────────────────┐  │
│  │  API Key   │ → │  PDF Upload│ → │  Processing View │  │
│  │  Input     │   │  Zone      │   │  (SSE messages)  │  │
│  └────────────┘   └────────────┘   └────────┬─────────┘  │
│                                              │            │
│                                    ┌─────────▼─────────┐  │
│                                    │  Result View      │  │
│                                    │  Download .ipynb  │  │
│                                    │  Open in Colab    │  │
│                                    └───────────────────┘  │
└──────────────────────┬────────────────────────────────────┘
                       │ POST /api/generate (multipart + SSE)
┌──────────────────────▼────────────────────────────────────┐
│                  FastAPI Backend (:8000)                    │
│                                                            │
│  ┌──────────────┐  ┌───────────────┐  ┌────────────────┐  │
│  │ pdf_parser   │→ │ prompts.py    │→ │ OpenAI GPT-5.4 │  │
│  │ (PyMuPDF)    │  │ (system+user) │  │ (async client) │  │
│  └──────────────┘  └───────────────┘  └───────┬────────┘  │
│                                               │           │
│  ┌──────────────┐  ┌───────────────┐  ┌───────▼────────┐  │
│  │ notebook_    │← │ notebook_     │← │ _parse_json    │  │
│  │ builder.py   │  │ generator.py  │  │ _response()    │  │
│  │ (nbformat)   │  │ (validation)  │  │ (JSON extract) │  │
│  └──────┬───────┘  └───────────────┘  └────────────────┘  │
│         │ base64-encoded .ipynb                            │
│         ▼                                                  │
│  SSE: event:complete → {cells, ipynb_base64}               │
└────────────────────────────────────────────────────────────┘
```

## Files Created/Modified

---

### backend/main.py
**Purpose**: FastAPI application with three endpoints — health check, PDF extraction, and notebook generation with SSE streaming.

**Key Functions**:
- `health_check()` — GET `/api/health`, returns `{"status": "ok"}`
- `extract_pdf()` — POST `/api/extract`, extracts text from uploaded PDF
- `generate_notebook()` — POST `/api/generate`, the main endpoint that orchestrates the full pipeline and streams progress via SSE

**How it works**:
The `/api/generate` endpoint accepts a multipart form with a PDF file and an OpenAI API key. Before starting the SSE stream, it validates the file type (must be `.pdf`) and size (max 50MB). Then it returns an `EventSourceResponse` wrapping an async generator that yields SSE events.

The generator follows a 5-step pipeline: (1) extract text from the PDF, (2) analyze paper structure, (3) call GPT-5.4 with the system and user prompts, (4) parse the JSON response, (5) assemble the `.ipynb` file. At each step, it yields `event: progress` messages so the frontend can show live updates. If any step fails, it yields an `event: error` with a JSON message and returns. On success, it yields `event: complete` with the notebook data including a base64-encoded `.ipynb` file.

```python
async def event_stream():
    yield {"event": "progress", "data": "Extracting text from PDF..."}
    result = extract_text_from_pdf(contents)
    # ... GPT-5.4 call, parsing, building ...
    ipynb_base64 = base64.b64encode(ipynb_str.encode("utf-8")).decode("ascii")
    notebook_data["ipynb_base64"] = ipynb_base64
    yield {"event": "complete", "data": json.dumps(notebook_data)}

return EventSourceResponse(event_stream())
```

CORS is configured to allow requests from `http://localhost:3000` only.

---

### backend/pdf_parser.py
**Purpose**: Extracts all text content from a PDF file using PyMuPDF.

**Key Functions**:
- `extract_text_from_pdf(pdf_bytes: bytes) -> dict` — Returns `{"text": "...", "pages": N}`

**How it works**:
Opens the PDF from raw bytes using `pymupdf.open(stream=..., filetype="pdf")`, iterates over every page calling `page.get_text()`, joins all pages with double newlines, and returns the full text plus page count. Raises `ValueError` for corrupt PDFs, empty PDFs, or image-only/scanned PDFs with no extractable text.

```python
doc = pymupdf.open(stream=pdf_bytes, filetype="pdf")
page_count = doc.page_count
pages = []
for page in doc:
    pages.append(page.get_text())
doc.close()
full_text = "\n\n".join(pages).strip()
return {"text": full_text, "pages": page_count}
```

---

### backend/prompts.py
**Purpose**: Contains the system and user prompts that instruct GPT-5.4 on how to generate the notebook.

**Key Functions**:
- `build_system_prompt() -> str` — Returns a detailed system prompt specifying the 11-section notebook structure and JSON output format
- `build_user_prompt(paper_text: str) -> str` — Wraps the extracted paper text with generation instructions

**How it works**:
The system prompt is the core of the product's quality. It instructs GPT-5.4 to respond with a JSON object containing a `cells` array where each cell has `cell_type` (markdown or code) and `source` (content). The prompt specifies 11 mandatory sections in order: Title & Metadata, Setup & Imports, Abstract & Contribution Summary, Background & Motivation, Mathematical Formulation (LaTeX), Algorithm Breakdown, Synthetic Data Generation, Full Implementation, Experiments & Visualization, Ablation Studies, and Discussion. It emphasizes that synthetic data must be realistic (not random noise), code must use numpy/torch idioms, and the target is 25-40 cells total. Temperature is set to 0.3 for deterministic output.

---

### backend/notebook_generator.py
**Purpose**: Async function that calls the OpenAI GPT-5.4 API and parses the structured JSON response.

**Key Functions**:
- `generate_notebook_content(paper_text, api_key) -> dict` — Calls GPT-5.4, returns parsed cells
- `_parse_json_response(raw: str) -> dict` — Extracts JSON from the model response, handling markdown code fences
- `_validate_cells(data: dict) -> None` — Validates cell structure (type + source keys, valid cell_type)

**How it works**:
Creates an `AsyncOpenAI` client with the user's API key, sends the system + user prompts, and awaits the response. The raw response text goes through `_parse_json_response()` which first tries direct `json.loads()`, then falls back to extracting JSON from markdown code fences (```json...```). The parsed data is validated to ensure it has a `cells` array where every cell has a valid `cell_type` and `source`. The generator is only used directly in the test suite — the SSE endpoint in `main.py` inlines the OpenAI call and reuses `_parse_json_response()` for parsing.

```python
# Handles model responses wrapped in code fences
match = re.search(r"```(?:json)?\s*\n?(.*?)\n?```", raw, re.DOTALL)
if match:
    data = json.loads(match.group(1))
    _validate_cells(data)
    return data
```

---

### backend/notebook_builder.py
**Purpose**: Converts the parsed cell array into a valid `.ipynb` file using nbformat.

**Key Functions**:
- `build_notebook(cells: list[dict]) -> str` — Returns a valid `.ipynb` JSON string

**How it works**:
Creates a new nbformat v4 notebook, sets the Python 3 kernel metadata, iterates over the input cells creating either `new_markdown_cell()` or `new_code_cell()` for each, then serializes the notebook to a JSON string via `nbformat.writes()`. Code cells automatically get `execution_count: null` and `outputs: []` from nbformat. The resulting string passes `nbformat.validate()` and opens correctly in Jupyter, VS Code, and Google Colab.

---

### frontend/src/app/layout.tsx
**Purpose**: Root layout — sets up Space Mono font, metadata, and renders the Header.

**How it works**:
Imports `Space_Mono` from `next/font/google` with weights 400 and 700. Sets the `--font-space-mono` CSS variable on `<html>`. Renders the `<Header />` component above page content. Sets page title to "Paper2Notebook" and description for SEO.

---

### frontend/src/app/globals.css
**Purpose**: Design system — CSS variables, Tailwind theme, and animations.

**Key styles**:
- Color palette: `--background: #0a0a0a`, `--foreground: #ededed`, `--accent-yellow: #ffd700`, `--accent-magenta: #e91e8c`, `--surface: #141414`, `--border: #2a2a2a`
- `@keyframes blink` — 1s step-end infinite for the terminal cursor
- `@keyframes fade-in` — 0.4s ease-out with 8px translateY for view transitions
- `::selection` — magenta highlight color
- `*:focus-visible` — yellow 2px outline for keyboard accessibility

The `@theme inline` block registers all CSS variables as Tailwind utility classes (e.g., `bg-accent-yellow`, `text-surface`, `border-border`).

---

### frontend/src/app/page.tsx
**Purpose**: Main page — orchestrates the three-state UI: input form, processing view, and result view.

**Key logic**:
- Uses `useGenerationStream()` hook for state management
- Three conditional renders based on `status`: `idle` → input form, `uploading/processing/error` → processing view, `complete` → result view
- Generate button is disabled until both API key and file are provided
- All view sections have `animate-fade-in` for smooth transitions
- Footer at bottom with tagline

```tsx
const showInput = status === "idle";
const showProcessing = status === "uploading" || status === "processing" || status === "error";
const showResult = status === "complete" && notebook !== null;
```

---

### frontend/src/components/header.tsx
**Purpose**: Top navigation bar with brand name and version badge.

Renders "PAPER2NOTEBOOK" in yellow uppercase with tracking-widest, and "v1" in muted text on the right. Full-width with a subtle bottom border.

---

### frontend/src/components/separator.tsx
**Purpose**: ARC Prize-style dashed yellow horizontal line.

Uses a CSS `repeating-linear-gradient` to create a dashed pattern: 8px yellow, 8px transparent, repeating. Applied as a `background-image` on a 1px-tall div.

---

### frontend/src/components/api-key-input.tsx
**Purpose**: Password-masked input field for the OpenAI API key with show/hide toggle.

**How it works**:
A controlled input with `type` toggling between `password` and `text` based on local `visible` state. The toggle button shows "show" or "hide" text. A privacy notice below reads: "Your key stays in browser memory only — never stored or sent to our servers." The key is held in React state in the parent component and passed directly in the API request — it never touches localStorage, cookies, or any persistent storage.

---

### frontend/src/components/pdf-upload.tsx
**Purpose**: Drag-and-drop file upload zone with PDF validation.

**How it works**:
Supports both click-to-browse (via hidden file input) and drag-and-drop (via `onDrop`/`onDragOver` events). Validates files in `validateAndSet()`: checks MIME type `application/pdf` or `.pdf` extension, and enforces a 50MB size limit. When a file is selected, shows a checkmark, filename, file size in MB, and a magenta "Remove" link. Error messages (wrong type, too large) appear below the zone in magenta text. The `dragOver` state adds a yellow border glow effect.

---

### frontend/src/components/processing-view.tsx
**Purpose**: Terminal-style live progress display during notebook generation.

**How it works**:
Two modes — progress and error. In progress mode, shows a yellow "GENERATING NOTEBOOK..." label with an elapsed time counter (MM:SS format, updated every second via `setInterval`). Progress messages render via `<ProgressMessage>` components, each prefixed with `>`. The latest message is fully opaque; older ones are dimmed to 40%. A blinking yellow block cursor (`&#x2588;` with `cursor-blink` animation) sits at the bottom.

In error mode, shows a magenta `✗ ERROR` header, the error message text, and a magenta "TRY AGAIN" button that calls `onRetry()` to reset to the idle state.

---

### frontend/src/components/progress-message.tsx
**Purpose**: Single progress message line with `>` prefix.

Takes `message` and `isLatest` props. Latest message gets full foreground color; older messages get `text-foreground/40` (40% opacity). The `>` prefix is always in accent yellow.

---

### frontend/src/components/result-view.tsx
**Purpose**: Post-generation view with download and Colab buttons.

**How it works**:
Shows a yellow checkmark with "NOTEBOOK READY" header and a cell count summary (e.g., "Generated 35 cells — 18 markdown, 17 code"). Three actions:

1. **Download .ipynb** (magenta button) — Decodes the base64 `ipynb_base64` string, creates a `Uint8Array`, wraps it in a `Blob` with MIME type `application/x-ipynb+json`, creates an object URL, programmatically clicks a temporary `<a>` element with `download="paper2notebook_output.ipynb"`, then revokes the URL.

2. **Open in Colab** (yellow-bordered link) — Calls `buildColabUrl()` to construct a Colab URL with the notebook content, opens in a new tab via `target="_blank"`.

3. **New Notebook** (subtle bordered button) — Calls `onNewNotebook()` which resets the hook state back to idle.

---

### frontend/src/hooks/use-generation-stream.ts
**Purpose**: Custom React hook that manages the entire generation lifecycle and SSE communication.

**State machine**:
```
idle → uploading → processing → complete
                              → error
```

**How it works**:
The `generate(apiKey, file)` function creates a `FormData` with the PDF and API key, POSTs to `/api/generate`, then reads the SSE response body as a stream. It parses the stream line-by-line, looking for `event:` and `data:` prefixes. Three event types are handled:

- `progress` — Appends the message to the `messages[]` array
- `complete` — Parses the JSON data (contains `cells` + `ipynb_base64`), sets `status: "complete"` and stores the notebook object
- `error` — Parses the JSON error message, sets `status: "error"`

An `AbortController` is stored in a ref so the request can be cancelled (e.g., when the user clicks "Try Again"). The `reset()` function aborts any in-flight request and resets all state to idle.

```typescript
const reader = response.body?.getReader();
const decoder = new TextDecoder();
let buffer = "";
while (true) {
    const { done, value } = await reader.read();
    if (done) break;
    buffer += decoder.decode(value, { stream: true });
    // parse SSE lines from buffer...
}
```

---

### frontend/src/lib/config.ts
**Purpose**: Exports the backend API URL, configurable via environment variable.

```typescript
export const API_URL = process.env.NEXT_PUBLIC_API_URL || "http://localhost:8000";
```

---

### frontend/src/lib/colab.ts
**Purpose**: Builds a Google Colab URL that can open a notebook directly from base64 content.

**How it works**:
Takes the base64-encoded `.ipynb` string and constructs a Colab URL using a data URI format: `https://colab.research.google.com/notebooks/data:application/x-ipynb+json;base64,{content}`. For notebooks larger than 32KB (which would make the URL impractically long), falls back to `https://colab.research.google.com/#create=true&language=python` which opens Colab's upload page.

---

## Data Flow

1. **User opens app** → Next.js renders the landing page with API key input and PDF upload zone
2. **User enters API key** → Stored in React state only (never persisted or sent to our servers)
3. **User uploads PDF** → Client-side validation (PDF type, 50MB max), file stored in React state
4. **User clicks "Generate Notebook"** → `useGenerationStream.generate()` fires
5. **Frontend POSTs to `/api/generate`** → Multipart form with PDF file + API key
6. **Backend validates** → Checks file extension and size before starting SSE stream
7. **Backend extracts text** → PyMuPDF reads all pages → SSE: `"Extracted 15,200 characters from 8 page(s)."`
8. **Backend calls GPT-5.4** → Sends system prompt (11-section structure) + user prompt (paper text) → SSE progress events stream to frontend
9. **GPT-5.4 responds** → JSON with `cells` array (markdown + code cells)
10. **Backend parses response** → Validates cell structure, handles markdown code fences
11. **Backend builds .ipynb** → nbformat assembles valid notebook with Python 3 kernel
12. **Backend base64-encodes** → Attaches `ipynb_base64` to the notebook data
13. **SSE: `event: complete`** → Frontend receives full notebook data
14. **Frontend shows result view** → Download button (blob URL) + Open in Colab (data URI) + New Notebook (reset)

## Test Coverage

### Backend (pytest) — 31 tests
- **Health endpoint** (2 tests): GET `/api/health` returns OK, CORS headers present for localhost:3000
- **PDF extraction endpoint** (5 tests): Extracts text from valid PDF, rejects missing file, rejects missing API key, rejects non-PDF files, rejects corrupt PDFs
- **PDF parser unit** (3 tests): Returns text content, raises on corrupt PDF, preserves multiline text
- **Notebook generator** (9 tests): System prompt contains all sections, specifies JSON output, user prompt includes paper text, GPT-5.4 model used, API key passed correctly, handles API errors, handles invalid JSON, returns valid cells
- **Notebook builder** (8 tests): Returns valid ipynb JSON, correct cell count, preserves cell types, preserves source content, passes nbformat validation, code cells have execution_count, Python 3 kernel set, empty cells raises error
- **SSE generate endpoint** (4 tests): Streams progress events, final event contains notebook, streams error on API failure, rejects non-PDF files

### Frontend Unit (Vitest) — 7 tests
- **Config** (2 tests): Backend API URL configured correctly
- **Colab URL builder** (3 tests): Returns valid Colab URL, includes notebook content, uses HTTPS
- **Generation stream hook** (2 tests): API URL and endpoint path correct

### Frontend E2E (Playwright) — 41 tests
- **Design system** (9 tests): Dark background, Space Mono font, header visible, yellow brand color, main content area, hero tagline, dashed separator, full-page screenshot, mobile responsive
- **Landing page** (11 tests): API key input visible, accepts text masked, visibility toggle, upload zone visible, PDF-only validation, file name display, generate button disabled/enabled states, clear file button, screenshots
- **Processing view** (6 tests): Transitions to processing, shows progress messages, elapsed timer, blinking cursor, error state with retry, input form hidden during processing
- **Result view** (4 tests): Shows result after generation, download button visible, cell count summary, new notebook resets to input
- **Colab button** (3 tests): Colab button visible, has Colab URL href, target=_blank
- **UI polish** (8 tests): Fade-in on input form, processing view, result view; mobile views at 375px (input, processing, result); footer visible; desktop final screenshots

## Security Measures
- **API key handling**: User's OpenAI API key is held in React state only — never persisted to localStorage, cookies, or any server-side storage. Passed directly in the multipart form body over the local connection.
- **CORS**: Backend restricts origins to `http://localhost:3000` only (not wildcard `*`)
- **File validation**: PDF type check (extension) and 50MB size limit enforced server-side before any processing
- **Error isolation**: PDF parsing errors, API failures, and JSON parse errors are all caught and returned as structured error events — no stack traces leak to the client
- **Focus accessibility**: All interactive elements have `focus-visible` yellow outline rings for keyboard navigation
- **Link safety**: Colab button uses `rel="noopener noreferrer"` on external links
- **Dependency audits**: Both `npm audit` and `pip-audit` pass with 0 vulnerabilities

## Known Limitations
- **No authentication**: Any user with the URL can use the app. API key is the only gate.
- **No rate limiting**: A user could spam the generate endpoint. The user's own OpenAI rate limits are the only throttle.
- **No persistent storage**: Generated notebooks exist only in browser memory. Refreshing the page loses them.
- **Colab integration is indirect**: For large notebooks (>32KB base64), the Colab button opens the upload page rather than loading the notebook directly. Users need to upload the downloaded file.
- **Single-model dependency**: Hardcoded to `gpt-5.4`. No fallback if the model is unavailable or the user's key lacks access.
- **No arXiv URL support**: Users must manually download the PDF first — no URL-to-PDF fetching.
- **Scanned/image PDFs not supported**: PyMuPDF extracts text only — scanned papers with no embedded text will fail with a clear error message but no OCR fallback.
- **No notebook preview**: Users can't preview the generated notebook in the browser — they must download it or open in Colab.
- **SSE not resumable**: If the browser connection drops mid-generation, the entire process must restart.
- **CORS is localhost-only**: Deploying to a real domain requires updating the CORS origins.

## What's Next
Sprint v2 should prioritize deployment and production readiness:

1. **Docker + deployment** — Containerize frontend and backend, deploy to a cloud provider
2. **CORS configuration** — Environment-variable driven origins for production domains
3. **arXiv URL input** — Let users paste an arXiv URL instead of downloading PDFs manually
4. **User authentication** — Email/OAuth login to track usage and enable notebook history
5. **Usage tracking** — Log generation events, token usage, and error rates
6. **Notebook preview** — Render a preview of the generated notebook in the browser before download
7. **OCR fallback** — For scanned PDFs, add Tesseract or a cloud OCR service
8. **Streaming generation** — Stream GPT-5.4's response token-by-token so users see the notebook being built in real-time
