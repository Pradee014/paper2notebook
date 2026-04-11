# Sprint v2 - Tasks

## Status: In Progress

- [x] Task 1: Remove Colab feature and clean up dead code (P0)
  - Acceptance: `colab.ts` deleted, Colab button removed from result view, Colab-related tests removed/updated, all remaining tests pass, no dead imports
  - Files: frontend/src/lib/colab.ts (delete), frontend/src/components/result-view.tsx, frontend/tests/
  - Completed: 2026-04-11 — Deleted colab.ts, removed Colab button and imports from result-view.tsx, deleted colab.test.ts and colab-button.spec.ts. All 38 E2E + 4 unit + 31 backend tests pass. Zero colab references remain in src/.

- [x] Task 2: Add security headers middleware and tighten CORS configuration (P0)
  - Acceptance: All responses include `X-Content-Type-Options: nosniff`, `X-Frame-Options: DENY`, `Referrer-Policy: strict-origin-when-cross-origin`. CORS `allow_methods` restricted to `["GET", "POST", "OPTIONS"]`, `allow_headers` restricted to `["Content-Type", "Accept", "Authorization"]`. Tests verify headers.
  - Files: backend/main.py, backend/tests/
  - Completed: 2026-04-11 — Added SecurityHeadersMiddleware (X-Content-Type-Options, X-Frame-Options, Referrer-Policy, Permissions-Policy). Tightened CORS: allow_methods to GET/POST/OPTIONS, allow_headers to Content-Type/Accept/Authorization. 7 new tests, 38 total backend tests passing.

- [x] Task 3: Move API key from form body to Authorization header (P0)
  - Acceptance: Backend reads API key from `Authorization: Bearer <key>` header. Frontend sends key in header, not FormData. Both `/api/extract` and `/api/generate` updated. Existing tests updated. Key no longer appears in request body.
  - Files: backend/main.py, frontend/src/hooks/use-generation-stream.ts, backend/tests/, frontend/tests/
  - Completed: 2026-04-11 — Added _extract_api_key() helper for Bearer token parsing. Both endpoints now read from Authorization header. Frontend sends key in header. 7 new auth tests + 8 existing tests updated. 45 backend + 4 unit + 38 E2E all passing.

- [x] Task 4: Add PDF magic byte validation and content-type verification (P0)
  - Acceptance: Backend checks uploaded file starts with `%PDF` magic bytes before processing. Rejects files that pass extension check but are not valid PDFs. Test with a `.txt` file renamed to `.pdf`. Minimum file size enforced (1KB).
  - Files: backend/pdf_parser.py or backend/main.py, backend/tests/
  - Completed: 2026-04-11 — Added _validate_pdf_contents() checking %PDF magic bytes, 1KB min size, 50MB max size. Both endpoints use it. 7 new tests (txt/html/exe renamed to pdf, tiny file, both endpoints). 52 backend tests passing.

- [x] Task 5: Implement prompt injection input defenses — sanitization and hardened prompt structure (P0)
  - Acceptance: New `sanitize_text()` function strips null bytes, control characters, and truncates to 100K chars. System prompt includes explicit anti-injection instructions. User prompt wraps paper text in XML-style delimiters with post-content instruction anchor. Unit tests cover sanitization edge cases.
  - Files: backend/prompts.py, backend/sanitizer.py (new), backend/tests/
  - Completed: 2026-04-11 — Created sanitizer.py with sanitize_text() (null byte/control char stripping, unicode cleanup, 100K truncation, whitespace normalization). Hardened prompts.py: system prompt has anti-injection clause, user prompt uses <paper-content> XML delimiters with post-content anchor. main.py wired to sanitize before LLM call. 22 new tests (15 sanitizer + 7 prompt), 74 total passing.

- [x] Task 6: Implement prompt injection output defenses — notebook safety validation (P0)
  - Acceptance: New `validate_notebook_safety()` scans code cells for dangerous patterns (`os.system`, `subprocess`, `eval`, `exec`, `__import__`, network calls to hardcoded URLs). Returns a list of warnings per cell. Warnings are included in the SSE `complete` event so frontend can display them. Tests cover detection of each pattern.
  - Files: backend/output_validator.py (new), backend/main.py, backend/tests/
  - Completed: 2026-04-11 — Created output_validator.py scanning 14 dangerous patterns (os.system, subprocess, eval, exec, __import__, open-write, requests, urllib, shutil, socket, ctypes, os.environ, os.popen, os.exec*). Flags but doesn't block. Warnings added to SSE complete event as safety_warnings. 18 new tests, 92 total passing.

- [x] Task 7: Add rate limiting with slowapi (P0)
  - Acceptance: `/api/generate` limited to 5 requests/minute per IP. `/api/extract` limited to 10 requests/minute per IP. Rate limit exceeded returns HTTP 429 with clear message. `slowapi` added to requirements.txt. Tests verify rate limiting triggers.
  - Files: backend/main.py, backend/requirements.txt, backend/tests/
  - Completed: 2026-04-11 — Added slowapi with per-IP rate limiting: /api/extract 10/min, /api/generate 5/min. Custom 429 handler with user-friendly message. Health endpoint unaffected. conftest.py resets limiter between tests. 5 new tests, 97 total passing.

- [x] Task 8: Add request timeouts, specific exception handling, and generic error responses (P0)
  - Acceptance: OpenAI API call has 120-second timeout. Broad `except Exception` replaced with specific catches (`openai.APIError`, `openai.RateLimitError`, `openai.APIConnectionError`, `asyncio.TimeoutError`). All client-facing error messages are generic (no internal details). Python `logging` module configured with structured output. Server logs contain full error details.
  - Files: backend/main.py, backend/notebook_generator.py, backend/tests/
  - Completed: 2026-04-11 — LLM call wrapped in asyncio.wait_for(timeout=120s). Exception handling: TimeoutError, AuthenticationError, RateLimitError, APIConnectionError, APIError, and fallback Exception — each with user-friendly message. All error SSE events now generic (no raw exceptions/paths). Python logging at ERROR level preserves full details server-side. 7 new tests, 104 total passing.

- [x] Task 9: Pin dependency versions with upper bounds (P1)
  - Acceptance: All dependencies in `requirements.txt` have upper bounds (e.g., `>=1.60.0,<2.0.0`). Frontend `package.json` dependencies use exact versions or tilde ranges. No open-ended `>=` without ceiling.
  - Files: backend/requirements.txt, frontend/package.json
  - Completed: 2026-04-11 — All 11 Python deps pinned with upper bounds (e.g., openai>=1.60.0,<2.0.0). Frontend: ^ ranges replaced with ~ (tilde) for patch-level updates only, devDeps pinned to specific minor versions. 2 new tests enforce pinning policy. 106 backend + 4 unit all passing.

- [x] Task 10: Add Zod schema validation for all frontend API responses (P1)
  - Acceptance: Zod schemas defined for SSE event payloads (progress, complete, error). `use-generation-stream.ts` validates parsed JSON through Zod before storing in state. Invalid responses trigger a user-friendly error. Zod added to package.json. Unit tests cover valid and invalid payloads.
  - Files: frontend/src/lib/schemas.ts (new), frontend/src/hooks/use-generation-stream.ts, frontend/package.json, frontend/tests/
  - Completed: 2026-04-11 — Created schemas.ts with NotebookCompleteSchema (cells, ipynb_base64, safety_warnings), SSEErrorSchema, SafetyWarningSchema. handleEvent() validates complete/error payloads via safeParse. Invalid data triggers user-friendly error. Zod ~3.25.23 added. 12 new unit tests, 16 total unit + 4 E2E passing.

- [ ] Task 11: Add generation history with localStorage (P1)
  - Acceptance: After successful generation, notebook metadata (timestamp, first markdown cell title, cell count, ipynb_base64) is saved to localStorage. New history panel below main content shows past generations (max 20). User can re-download any past notebook. "Clear history" button available. History persists across page refreshes.
  - Files: frontend/src/lib/history.ts (new), frontend/src/components/history-panel.tsx (new), frontend/src/app/page.tsx, frontend/tests/

- [ ] Task 12: Update all tests for v2 security changes and add security-focused test cases (P1)
  - Acceptance: All existing tests updated to work with new auth header, removed Colab references, etc. New tests added: malformed PDF rejection, oversized input handling, rate limit verification, sanitizer edge cases, output validator coverage. Full test suite passes (`pytest` + `vitest` + `playwright`).
  - Files: backend/tests/, frontend/tests/
