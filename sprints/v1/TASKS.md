# Sprint v1 - Tasks

## Status: In Progress

- [x] Task 1: Initialize monorepo with Next.js frontend and FastAPI backend (P0)
  - Acceptance: `npm run dev` starts frontend on :3000, `uvicorn` starts backend on :8000, CORS configured between them
  - Files: frontend/package.json, frontend/next.config.ts, frontend/tailwind.config.ts, backend/main.py, backend/requirements.txt, backend/pyproject.toml
  - Completed: 2026-04-11 — Next.js 16 frontend + FastAPI backend scaffolded, Space Mono font configured, dark theme CSS vars, CORS for localhost:3000, health endpoint, Vitest + pytest test suites passing

- [x] Task 2: Build ARC Prize-inspired design system and layout shell (P0)
  - Acceptance: Dark theme with Space Mono font, yellow/magenta accent colors, global styles applied, responsive base layout with header and main content area
  - Files: frontend/app/layout.tsx, frontend/app/globals.css, frontend/app/page.tsx, frontend/components/header.tsx
  - Completed: 2026-04-11 — Dark theme (#0a0a0a), Space Mono font, yellow/magenta accents, header with brand, dashed yellow separator, responsive layout, blinking cursor animation, magenta text selection

- [x] Task 3: Build the landing page with API key input and PDF upload zone (P0)
  - Acceptance: Page shows hero text, API key input field (masked, stored in state only), drag-and-drop PDF upload zone with file validation (PDF only, max 50MB), upload triggers processing flow
  - Files: frontend/components/api-key-input.tsx, frontend/components/pdf-upload.tsx, frontend/app/page.tsx
  - Completed: 2026-04-11 — API key input with show/hide toggle, drag-and-drop PDF upload zone with file validation (type + 50MB limit), generate button enabled only when both inputs provided, "Remove" to clear file

- [x] Task 4: Implement backend PDF upload and text extraction endpoint (P0)
  - Acceptance: POST `/api/generate` accepts multipart form (PDF + API key), extracts full text from PDF using PyMuPDF, returns extracted text or error with proper status codes
  - Files: backend/main.py, backend/pdf_parser.py
  - Completed: 2026-04-11 — POST /api/extract endpoint with PyMuPDF text extraction, validates PDF type/size/parsability, returns {text, pages}, proper HTTP error codes for all failure modes

- [x] Task 5: Implement OpenAI GPT-5.4 notebook generation with structured prompt (P0)
  - Acceptance: Backend sends extracted paper text to GPT-5.4 with a detailed system prompt, receives structured notebook content (markdown cells + code cells with synthetic data), handles API errors gracefully
  - Files: backend/notebook_generator.py, backend/prompts.py
  - Completed: 2026-04-11 — Detailed system prompt covering all 11 notebook sections, JSON output format with cell validation, GPT-5.4 async call with error handling, markdown code-fence extraction fallback

- [x] Task 6: Implement SSE streaming endpoint for real-time progress updates (P0)
  - Acceptance: Backend streams progress events (e.g., "Extracting text...", "Analyzing paper structure...", "Generating implementation code...", "Building notebook...") via SSE, frontend connects and displays messages in real-time
  - Files: backend/main.py (SSE endpoint), frontend/hooks/use-generation-stream.ts
  - Completed: 2026-04-11 — POST /api/generate SSE endpoint with 9 progress steps, error/complete events, frontend useGenerationStream hook with abort support and state machine

- [x] Task 7: Build the processing status UI with live progress messages (P0)
  - Acceptance: After upload, UI transitions to a processing view showing animated progress messages as they stream in, retro terminal-style aesthetic with blinking cursor, elapsed time counter
  - Files: frontend/components/processing-view.tsx, frontend/components/progress-message.tsx
  - Completed: 2026-04-11 — ProcessingView with terminal-style progress messages (> prefix, latest highlighted), blinking yellow cursor, elapsed timer (MM:SS), error state with magenta "Try Again" button, page wired to useGenerationStream hook with state-driven view switching

- [ ] Task 8: Build notebook assembly and .ipynb file download (P0)
  - Acceptance: Backend assembles GPT-5.4 output into a valid .ipynb file using nbformat, frontend receives the file and offers a download button, downloaded file opens correctly in Jupyter/VS Code
  - Files: backend/notebook_builder.py, frontend/components/result-view.tsx

- [ ] Task 9: Add "Open in Colab" functionality (P1)
  - Acceptance: Result page shows "Open in Colab" button, clicking it opens the notebook in Google Colab (via base64 data URI or Gist upload approach), notebook loads and runs in Colab
  - Files: frontend/components/colab-button.tsx, frontend/lib/colab.ts

- [ ] Task 10: UI polish — animations, transitions, error states, and responsive design (P1)
  - Acceptance: Smooth page transitions between states (input → processing → result), error messages styled consistently, works on mobile/tablet, loading skeletons where appropriate, dashed yellow separator lines between sections (ARC Prize style)
  - Files: frontend/components/*.tsx (various updates), frontend/app/globals.css
