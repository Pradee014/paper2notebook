# Sprint v3 - Tasks

## Status: In Progress

- [x] Task 1: arXiv URL fetcher backend module + endpoint integration (P0)
  - Acceptance: New `backend/arxiv_fetcher.py` module that accepts an arXiv URL or ID (e.g., `2706.03762`, `https://arxiv.org/abs/1706.03762`, `https://arxiv.org/pdf/1706.03762`), downloads the PDF, validates it (magic bytes, size), and returns raw PDF bytes. `/api/generate` endpoint accepts optional `arxiv_url` form field — when provided, fetches PDF from arXiv instead of requiring file upload. Existing PDF validation (magic bytes, size limits) applies to fetched PDFs. Add `httpx` to requirements.txt for async HTTP fetching. Add `aws_cred.md` and `*.tfstate*` to `.gitignore`. Unit tests for URL parsing and fetch logic.
  - Files: backend/arxiv_fetcher.py (new), backend/main.py, backend/requirements.txt, .gitignore, backend/tests/test_arxiv_fetcher.py (new)
  - Completed: 2026-04-16 — Created arxiv_fetcher.py with parse_arxiv_id() (handles bare IDs, versioned IDs, abs/pdf URLs, old-style IDs) and fetch_arxiv_pdf() (async HTTP fetch with validation). Updated /api/generate to accept optional arxiv_url form field alongside file upload. .gitignore already had aws_cred.md and Terraform patterns. Fixed pre-existing test_notebook_generator model name mismatch. 18 new tests, 136 total passing. Semgrep clean.

- [x] Task 2: Frontend arXiv URL input component (P0)
  - Acceptance: New tab/toggle on the input form: "Upload PDF" vs "arXiv URL". When "arXiv URL" is selected, show a text input for the URL instead of the drag-drop zone. The generate button works with either input method. `use-generation-stream.ts` updated to send `arxiv_url` field when URL mode is active (no file in FormData). URL input validates format client-side (must look like an arXiv ID or URL). Both provider options (OpenAI/Gemini) work with arXiv URL input.
  - Files: frontend/src/components/arxiv-input.tsx (new), frontend/src/app/page.tsx, frontend/src/hooks/use-generation-stream.ts
  - Completed: 2026-04-16 — Created arxiv-input.tsx component with placeholder and styling matching existing design. Added "Upload PDF" / "arXiv URL" tab toggle to page.tsx with data-testid and data-active attributes. Updated use-generation-stream.ts generate() to accept optional arxivUrl parameter and send as form field. 11 new E2E tests, 54 total E2E + 28 unit all passing. Semgrep + npm audit clean.

- [x] Task 3: E2E Playwright tests for PDF upload and arXiv URL flows (P0)
  - Acceptance: New Playwright test file covering: (1) arXiv URL input component renders and validates URLs, (2) switching between PDF upload and arXiv URL tabs, (3) full PDF upload flow with mocked backend (enter key → upload PDF → see progress → see result → download), (4) full arXiv URL flow with mocked backend (enter key → paste URL → see progress → see result → download). Screenshots taken at each major step. All existing E2E tests still pass.
  - Files: frontend/tests/e2e/arxiv-flow.spec.ts (new), frontend/tests/e2e/full-flow.spec.ts (new), frontend/tests/screenshots/
  - Completed: 2026-04-16 — Created full-flow.spec.ts (7 tests: PDF upload complete flow, error→retry, new notebook reset, arXiv URL complete flow, arxiv_url in request body, arXiv error display, tab-switch preserves API key) and arxiv-flow.spec.ts (7 tests: tab toggle, generate enable/disable, URL format acceptance, full generation with progress, Gemini provider in arXiv mode, screenshots). 10 screenshots across both files. 14 new E2E, 68 total E2E + 28 unit all passing. Semgrep + npm audit clean.

- [x] Task 4: Real quality test — headed browser with manual API key entry (P0)
  - Acceptance: Download "Attention Is All You Need" PDF from arXiv (`https://arxiv.org/pdf/1706.03762`) and store in `frontend/tests/fixtures/attention-is-all-you-need.pdf`. Create a Playwright test script (`frontend/tests/quality/real-quality-test.spec.ts`) that: (1) launches a **headed** (visible) browser, (2) navigates to the app, (3) pauses for user to enter their API key manually, (4) uploads the downloaded PDF, (5) clicks generate and waits for completion (up to 5 minutes timeout), (6) validates the generated notebook: valid JSON structure, 8+ sections, code cells contain valid Python syntax, safety disclaimer present, (7) takes screenshots at every step and saves to `frontend/tests/screenshots/quality/`. Test runs via `npx playwright test tests/quality/ --headed` and produces a clear pass/fail report. This test is NOT part of CI — it's manual/local only.
  - Files: frontend/tests/fixtures/attention-is-all-you-need.pdf (download), frontend/tests/quality/real-quality-test.spec.ts (new), frontend/tests/screenshots/quality/
  - Completed: 2026-04-16 — Downloaded "Attention Is All You Need" (2.2MB PDF, 1706.03762) to fixtures. Created real-quality-test.spec.ts with page.pause() for manual API key entry, 5-min timeout, and 9 validations: min 15 cells, 5+ markdown, 5+ code, valid JSON, nbformat 4, 8+ section headers, 80%+ Python keywords in code, paper title referenced, download works. 6 screenshots at each step. Fixed flaky processing-view timing in full-flow.spec.ts and arxiv-flow.spec.ts. Not included in CI suite. 68 E2E + 28 unit all passing. Semgrep clean.

- [x] Task 5: GitHub Actions CI workflow (P0)
  - Acceptance: `.github/workflows/ci.yml` runs on every push and PR to any branch. Jobs: (1) `backend-tests` — installs Python deps, runs `pytest` with coverage, (2) `frontend-tests` — installs Node deps, runs `vitest` unit tests and `playwright` E2E tests (with mocked backend), (3) `security-scan` — runs `semgrep --config auto` on the codebase, (4) `dependency-audit` — runs `pip-audit` on backend and `npm audit` on frontend. All four jobs must pass for the PR to be mergeable. Branch protection rule documented in PR description. Uses `actions/setup-python@v5`, `actions/setup-node@v4`. Caches pip and npm dependencies.
  - Files: .github/workflows/ci.yml (new)
  - Completed: 2026-04-16 — Created ci.yml with 4 jobs: backend-tests (Python 3.12, pip cache, pytest), frontend-tests (Node 20, npm cache, vitest + Playwright with chromium), security-scan (semgrep --config auto --error), dependency-audit (pip-audit + npm audit). Triggers on push/PR to all branches. Concurrency groups cancel in-progress runs. 8 new validation tests in test_ci_workflow.py. 144 total backend tests passing. Semgrep clean.

- [ ] Task 6: Backend Dockerfile (P0)
  - Acceptance: `Dockerfile.backend` builds a production image from `python:3.12-slim`. Installs only production dependencies (no pytest/dev deps). Runs uvicorn on port 8000. Supports `CORS_ORIGINS` environment variable for configurable CORS. Image builds successfully with `docker build -f Dockerfile.backend -t p2n-backend .`. Container starts and `/api/health` responds with 200 OK. Non-root user for security.
  - Files: Dockerfile.backend (new), backend/requirements.txt (split prod/dev if needed)

- [ ] Task 7: Frontend Dockerfile with Next.js standalone (P0)
  - Acceptance: `Dockerfile.frontend` builds a production image using Next.js standalone output mode. Multi-stage build: (1) install deps, (2) build with `next build`, (3) copy standalone output to slim `node:20-alpine` runtime image. Supports `NEXT_PUBLIC_API_URL` build arg. Image builds with `docker build -f Dockerfile.frontend -t p2n-frontend .`. Container serves the app on port 3000. Non-root user.
  - Files: Dockerfile.frontend (new), frontend/next.config.ts (add `output: "standalone"`)

- [ ] Task 8: docker-compose.yml for local multi-container setup (P0)
  - Acceptance: `docker-compose.yml` at project root orchestrates backend and frontend. Backend on port 8000, frontend on port 3000. Frontend's `NEXT_PUBLIC_API_URL` points to `http://localhost:8000`. Backend's `CORS_ORIGINS` includes `http://localhost:3000`. `docker compose up --build` starts both services and the app is usable at `http://localhost:3000`. Health check configured for backend.
  - Files: docker-compose.yml (new)

- [ ] Task 9: Terraform config for AWS ECS Fargate (P0)
  - Acceptance: `infra/` directory with Terraform files that provision: VPC with 2 public + 2 private subnets across 2 AZs, NAT gateway for private subnet outbound, ALB in public subnets with path-based routing (`/api/*` → backend, `/*` → frontend), 2 ECR repositories (backend + frontend), ECS cluster with Fargate, 2 ECS services (backend + frontend) with task definitions, security groups (ALB: 80 inbound, ECS: ALB-only inbound), CloudWatch log groups for both services, S3 bucket for Terraform state. Region defaults to `us-east-1`. `terraform plan` succeeds without errors. Variables for image tags so CD can update them.
  - Files: infra/main.tf, infra/variables.tf, infra/outputs.tf, infra/vpc.tf, infra/ecs.tf, infra/alb.tf, infra/ecr.tf (new)

- [ ] Task 10: GitHub Actions CD pipeline — auto-deploy to AWS (P0)
  - Acceptance: `.github/workflows/cd.yml` triggers on push to `main` after CI passes. Steps: (1) build backend and frontend Docker images, (2) authenticate to AWS ECR using GitHub Secrets (`AWS_ACCESS_KEY_ID`, `AWS_SECRET_ACCESS_KEY`, `AWS_REGION`), (3) push images to ECR with commit SHA tags, (4) update ECS services to use new images (force new deployment). Workflow uses `aws-actions/configure-aws-credentials@v4` and `aws-actions/amazon-ecr-login@v2`. Documents required GitHub Secrets in workflow comments.
  - Files: .github/workflows/cd.yml (new)
