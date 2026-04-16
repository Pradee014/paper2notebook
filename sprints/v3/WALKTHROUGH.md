# Sprint v3 — Walkthrough

## Summary
Made Paper2Notebook production-ready across three pillars: (1) added arXiv URL input so users can paste a link instead of downloading PDFs, (2) built a CI/CD pipeline with GitHub Actions covering tests, security scans, and automated deployment, and (3) containerized both services with Docker and created Terraform infrastructure-as-code for AWS ECS Fargate. Also created comprehensive E2E tests for both input flows and a real quality test that validates notebook output against "Attention Is All You Need." All 10 tasks completed with 290 tests passing (194 backend + 68 E2E + 28 unit).

## Architecture Overview

```
┌─────────────────────────────────────────────────────────────┐
│                      Browser (:3000)                         │
│                                                              │
│  ┌──────────────┐  ┌──────────────────────────────────────┐  │
│  │ API Key      │  │ Input Mode Tabs                      │  │
│  │ OpenAI/Gemini│  │ ┌─────────────┐  ┌───────────────┐  │  │
│  └──────────────┘  │ │ Upload PDF  │  │ [v3] arXiv URL│  │  │
│                    │ │ (drag-drop) │  │ (text input)  │  │  │
│                    │ └─────────────┘  └───────────────┘  │  │
│                    └──────────────────────────────────────┘  │
│  ┌──────────────┐  ┌──────────────┐  ┌──────────────────┐   │
│  │ Processing   │→ │ Result View  │  │ History Panel    │   │
│  │ (SSE stream) │  │ Download     │  │ (localStorage)   │   │
│  └──────────────┘  └──────────────┘  └──────────────────┘   │
│  Zod schema validation on all SSE responses                  │
└───────────────────────┬──────────────────────────────────────┘
                        │ Authorization: Bearer <key>
                        │ + provider + (file OR arxiv_url)
┌───────────────────────▼──────────────────────────────────────┐
│                  FastAPI Backend (:8000)                       │
│  Security headers • Rate limiting • CORS (env var)            │
│                                                               │
│  ┌──────────────┐    ┌──────────────┐    ┌────────────────┐  │
│  │ [v3] arXiv   │    │ PDF Upload   │    │ LLM Call       │  │
│  │ Fetcher      │ OR │ + magic byte │ →  │ OpenAI/Gemini  │  │
│  │ (httpx)      │    │ validation   │    │ + 120s timeout │  │
│  └──────┬───────┘    └──────┬───────┘    └───────┬────────┘  │
│         └────────┬──────────┘                    │           │
│           sanitize → hardened prompt → LLM → validate output │
│                                                  │           │
│                               build .ipynb → base64 → SSE   │
└──────────────────────────────────────────────────────────────┘

┌─────────────────── CI/CD (GitHub Actions) ───────────────────┐
│                                                               │
│  Push/PR → CI: pytest │ vitest+Playwright │ semgrep │ audit   │
│                                                               │
│  Push main → CD: docker build → ECR push → ECS force-deploy  │
└───────────────────────────────────────────────────────────────┘

┌──────────────── AWS ECS Fargate (Terraform) ─────────────────┐
│                                                               │
│  VPC (10.0.0.0/16)                                           │
│  ├── Public subnets (2 AZs) → ALB                            │
│  │   └── /api/* → backend TG    /* → frontend TG             │
│  ├── Private subnets (2 AZs) → ECS Fargate tasks             │
│  │   ├── backend (uvicorn:8000)                               │
│  │   └── frontend (node:3000)                                 │
│  ├── NAT Gateway (outbound for ECS)                           │
│  ├── ECR (backend + frontend repos, IMMUTABLE tags)           │
│  └── CloudWatch Logs (14-day retention)                       │
└───────────────────────────────────────────────────────────────┘
```

## Files Created/Modified

---

### backend/arxiv_fetcher.py (NEW)
**Purpose**: Fetch PDFs from arXiv given a URL or paper ID.

**Key Functions**:
- `parse_arxiv_id(raw: str) -> str` — Extracts canonical arXiv ID from various formats
- `fetch_arxiv_pdf(arxiv_id_or_url: str) -> bytes` — Downloads PDF, validates it's real

**How it works**:
The parser handles 5 input formats using regex: bare new-style IDs (`1706.03762`), versioned IDs (`1706.03762v5`), old-style category IDs (`hep-ph/9905221`), abs URLs (`https://arxiv.org/abs/...`), and pdf URLs (`https://arxiv.org/pdf/...`). Version suffixes are stripped to get the canonical ID.

The fetcher constructs `https://arxiv.org/pdf/{id}`, downloads via `httpx.AsyncClient` with redirect following and 60-second timeout, then validates the response: checks HTTP status (404 → "not found"), and verifies the response starts with `%PDF` magic bytes (arXiv sometimes returns HTML rate-limit pages). All errors are wrapped in `ArxivFetchError` with user-friendly messages.

```python
_NEW_ID = re.compile(r"^(\d{4}\.\d{4,5})(v\d+)?$")
_URL_PATTERN = re.compile(
    r"https?://arxiv\.org/(?:abs|pdf)/([a-z-]+/\d{7}|\d{4}\.\d{4,5})(v\d+)?(?:\.pdf)?$"
)

async def fetch_arxiv_pdf(arxiv_id_or_url: str) -> bytes:
    paper_id = parse_arxiv_id(arxiv_id_or_url)
    url = f"{ARXIV_PDF_BASE}{paper_id}"
    async with httpx.AsyncClient(follow_redirects=True, timeout=60.0) as client:
        response = await client.get(url)
    if not response.content[:4].startswith(b"%PDF"):
        raise ArxivFetchError("arXiv response is not a valid PDF.")
    return response.content
```

---

### backend/main.py (MODIFIED)
**Purpose**: FastAPI application — now accepts arXiv URLs alongside file uploads and reads CORS from environment.

**Key Changes in v3**:

**arXiv URL support**: The `/api/generate` endpoint now accepts an optional `arxiv_url` form field. When provided, it calls `fetch_arxiv_pdf()` instead of reading from the uploaded file. The existing PDF validation (magic bytes, size limits) applies to both paths. If neither a file nor an arXiv URL is provided, a 400 error is returned.

```python
@app.post("/api/generate")
async def generate_notebook(
    file: UploadFile | None = File(None),
    arxiv_url: str | None = Form(None),
    provider: str = Form("openai"),
    ...
):
    if arxiv_url and arxiv_url.strip():
        contents = await fetch_arxiv_pdf(arxiv_url.strip())
    elif file and file.filename:
        contents = await file.read()
    else:
        raise HTTPException(400, "Provide either a PDF file or an arXiv URL")
```

**CORS from environment**: CORS origins are now read from the `CORS_ORIGINS` environment variable (comma-separated), defaulting to `http://localhost:3000`. This allows Docker and cloud deployments to configure allowed origins without code changes.

```python
CORS_ORIGINS = os.environ.get("CORS_ORIGINS", "http://localhost:3000").split(",")
```

**SSE progress label**: When using arXiv, the progress messages show the source: `"Extracting text from arXiv (1706.03762)..."` instead of `"Extracting text from uploaded PDF..."`.

---

### frontend/src/components/arxiv-input.tsx (NEW)
**Purpose**: Text input for arXiv URL or paper ID, matching the existing design system.

**How it works**:
A controlled input with monospace font, placeholder text (`"e.g. 1706.03762 or https://arxiv.org/abs/1706.03762"`), and a helper message explaining that the PDF will be fetched automatically. Styled identically to the API key input (dark surface background, yellow focus border, muted placeholder). Uses `data-testid="arxiv-url-input"` for Playwright selectors.

---

### frontend/src/app/page.tsx (MODIFIED)
**Purpose**: Main page — now has input mode tabs for switching between PDF upload and arXiv URL.

**Key Changes in v3**:

**Input mode tabs**: Two tab buttons ("Upload PDF" / "arXiv URL") with `data-testid="input-tab-pdf"` and `data-testid="input-tab-arxiv"`. The active tab gets a yellow background. Switching tabs swaps between `PdfUpload` and `ArxivInput` components.

**Dual-mode state**: New state variables `inputMode` (`"pdf"` | `"arxiv"`) and `arxivUrl` (string). The `canGenerate` logic checks both modes: in PDF mode, a file must be selected; in arXiv mode, the URL must be non-empty.

**Dual-mode generation**: `handleGenerate()` calls `generate(apiKey, file, provider)` for PDF mode or `generate(apiKey, null, provider, arxivUrl)` for arXiv mode.

---

### frontend/src/hooks/use-generation-stream.ts (MODIFIED)
**Purpose**: SSE stream hook — now supports arXiv URL as an alternative to file upload.

**Key Change**: The `generate()` function signature changed from `(apiKey, file, provider)` to `(apiKey, file | null, provider, arxivUrl?)`. When `arxivUrl` is provided, it's added to the FormData as `arxiv_url` and no file is appended.

```typescript
const generate = useCallback(async (
  apiKey: string, file: File | null,
  provider: string = "openai", arxivUrl?: string
) => {
    const formData = new FormData();
    if (arxivUrl) {
      formData.append("arxiv_url", arxivUrl);
    } else if (file) {
      formData.append("file", file);
    }
    formData.append("provider", provider);
    // ... fetch with Authorization header
```

---

### frontend/tests/e2e/arxiv-input.spec.ts (NEW)
**Purpose**: 11 E2E tests for the arXiv URL input component.

Covers: tabs visible with correct labels, PDF tab selected by default, clicking arXiv tab shows URL input and hides upload zone, switching back restores upload zone, URL input has placeholder, accepts valid URLs, generate enables with API key + URL, generate disabled with empty URL, switching tabs clears generate state, screenshots for both modes.

---

### frontend/tests/e2e/full-flow.spec.ts (NEW)
**Purpose**: 7 E2E tests covering complete user flows with mocked backend.

Covers: complete PDF upload flow (key → upload → progress → result → download), error → retry returns to input, new notebook button resets state, complete arXiv URL flow (key → URL → progress → result → download), arXiv request body verification (confirms `arxiv_url` field is sent), arXiv error from backend, switching tabs preserves API key.

Uses mocked SSE responses via `page.route("**/api/generate", ...)` to test the full UI lifecycle without a real backend.

---

### frontend/tests/e2e/arxiv-flow.spec.ts (NEW)
**Purpose**: 7 E2E tests for arXiv-specific flows.

Covers: tab toggle hides/shows correct input, generate disabled/enabled with URL, URL format acceptance (bare ID, abs URL, pdf URL), full generation with progress messages, Gemini provider works in arXiv mode (verifies `gemini` in request body), screenshots.

---

### frontend/tests/quality/real-quality-test.spec.ts (NEW)
**Purpose**: Interactive quality test that validates a real notebook generated from "Attention Is All You Need."

**How it works**:
This is NOT a CI test — it runs in a headed browser with a 5-minute timeout. The test uses `page.pause()` to let you manually enter your API key, then uploads the downloaded paper, clicks Generate, and waits for the LLM to produce a notebook. Once complete, it runs 9 validations:

1. Minimum 15 cells total
2. At least 5 markdown cells
3. At least 5 code cells
4. Downloaded file is valid JSON
5. nbformat version is 4
6. At least 8 section headers (markdown cells starting with `#`)
7. 80%+ of code cells contain Python keywords (`import`, `def`, `class`, etc.)
8. Paper title referenced ("attention" + "transformer")
9. Download button triggers a file download

Takes 6 screenshots at each step and prints a formatted report to the console.

```
╔══════════════════════════════════════════════════════╗
║              QUALITY TEST REPORT                    ║
╠══════════════════════════════════════════════════════╣
║  Paper: Attention Is All You Need (1706.03762)      ║
║  Total cells: 35                                    ║
║  Sections (headers): 11                             ║
║  Python code cells: 16/17                           ║
║  RESULT: ALL CHECKS PASSED                          ║
╚══════════════════════════════════════════════════════╝
```

Run: `cd frontend && npx playwright test tests/quality/ --headed --timeout 600000`

---

### frontend/tests/fixtures/attention-is-all-you-need.pdf (NEW)
**Purpose**: "Attention Is All You Need" (Vaswani et al., 2017) downloaded from arXiv (1706.03762). 2.2MB, 15 pages. Used by the real quality test.

---

### .github/workflows/ci.yml (NEW)
**Purpose**: CI pipeline — runs on every push and PR to any branch.

**Jobs** (4, running in parallel):

1. **backend-tests**: Python 3.12 + pip cache → `pytest -v --tb=short`
2. **frontend-tests**: Node 20 + npm cache → `vitest run` + `playwright test` (with chromium install)
3. **security-scan**: `semgrep --config auto backend/ frontend/src/ --quiet --error`
4. **dependency-audit**: `pip-audit -r backend/requirements.txt` + `npm audit`

Uses concurrency groups (`ci-${{ github.ref }}`) to cancel in-progress runs on the same branch. All jobs must pass for a PR to be mergeable.

---

### .github/workflows/cd.yml (NEW)
**Purpose**: CD pipeline — auto-deploys to AWS ECS Fargate on push to main.

**Steps** (sequential, in a single `deploy` job):

1. Checkout code
2. Configure AWS credentials from GitHub Secrets (`AWS_ACCESS_KEY_ID`, `AWS_SECRET_ACCESS_KEY`, `AWS_REGION`)
3. Login to Amazon ECR via `aws-actions/amazon-ecr-login@v2`
4. Build backend Docker image, tag with commit SHA
5. Push backend image to ECR
6. Build frontend Docker image (with `NEXT_PUBLIC_API_URL` pointing to ALB DNS)
7. Push frontend image to ECR
8. `aws ecs update-service --force-new-deployment` on both backend and frontend services
9. Write deployment summary to GitHub Step Summary

Uses concurrency group `cd-main` with `cancel-in-progress: false` — deployments queue rather than cancel each other.

---

### Dockerfile.backend (NEW)
**Purpose**: Production Docker image for the FastAPI backend.

Single-stage build from `python:3.12-slim`. Installs only production dependencies from `requirements-prod.txt` (no pytest, httpx, or dev tools). Copies `backend/*.py` into `/app`. Runs as non-root `appuser`. Exposes port 8000 and starts uvicorn on `0.0.0.0:8000`.

```dockerfile
FROM python:3.12-slim
COPY backend/requirements-prod.txt requirements.txt
RUN pip install --no-cache-dir -r requirements.txt
COPY backend/*.py .
RUN useradd --create-home appuser
USER appuser
EXPOSE 8000
CMD ["uvicorn", "main:app", "--host", "0.0.0.0", "--port", "8000"]
```

---

### backend/requirements-prod.txt (NEW)
**Purpose**: Production-only Python dependencies — excludes pytest, pytest-asyncio, and httpx (which is only used for testing in the backend, though also used by arxiv_fetcher in prod).

Note: `httpx` is included here because `arxiv_fetcher.py` uses it for HTTP requests to arXiv.

---

### Dockerfile.frontend (NEW)
**Purpose**: Production Docker image for the Next.js frontend, using standalone output mode.

3-stage multi-stage build:
1. **deps**: `node:20-alpine`, copies `package.json` + `package-lock.json`, runs `npm ci`
2. **builder**: Copies deps + source, accepts `NEXT_PUBLIC_API_URL` as build arg, runs `next build`
3. **runner**: `node:20-alpine`, copies `.next/standalone`, `.next/static`, and `public`. Runs as non-root `nextjs` user on port 3000.

```dockerfile
FROM node:20-alpine AS runner
COPY --from=builder /app/.next/standalone ./
COPY --from=builder /app/.next/static ./.next/static
USER nextjs
CMD ["node", "server.js"]
```

---

### frontend/next.config.ts (MODIFIED)
**Purpose**: Added `output: "standalone"` to enable Next.js standalone build mode for Docker.

This makes `next build` produce a self-contained `server.js` + `.next/standalone` directory that can run with just `node server.js` — no `node_modules` needed in the production image.

---

### docker-compose.yml (NEW)
**Purpose**: Orchestrates backend and frontend for local development with Docker.

**Services**:
- **backend**: Builds from `Dockerfile.backend`, port 8000, `CORS_ORIGINS=http://localhost:3000`, healthcheck on `/api/health` (10s interval, 3 retries)
- **frontend**: Builds from `Dockerfile.frontend`, port 3000, `NEXT_PUBLIC_API_URL=http://localhost:8000` as build arg, `depends_on: backend (service_healthy)`

Run: `docker compose up --build`

---

### infra/main.tf (NEW)
**Purpose**: Terraform provider configuration and backend state storage.

Configures AWS provider with variable region (defaults to `us-east-1`). Uses S3 backend (`paper2notebook-tfstate` bucket) for remote state storage. Requires Terraform >= 1.5.0 and AWS provider ~> 5.0.

---

### infra/variables.tf (NEW)
**Purpose**: Terraform input variables.

Defines: `aws_region` (default `us-east-1`), `project_name` (default `paper2notebook`), `backend_image_tag` and `frontend_image_tag` (both default `latest` — CD pipeline overrides with commit SHA), `backend_cpu`/`backend_memory` and `frontend_cpu`/`frontend_memory` (256 CPU / 512 MB each).

---

### infra/vpc.tf (NEW)
**Purpose**: VPC, subnets, gateways, and routing for the ECS deployment.

Creates: VPC (10.0.0.0/16), 2 public subnets (10.0.0.0/24, 10.0.1.0/24) with auto-assign public IPs, 2 private subnets (10.0.10.0/24, 10.0.11.0/24) without public IPs, Internet Gateway for public subnets, single NAT Gateway in the first public subnet for private subnet outbound traffic, route tables associating public subnets → IGW and private subnets → NAT Gateway.

---

### infra/ecr.tf (NEW)
**Purpose**: ECR repositories for Docker images.

Creates 2 repositories (`paper2notebook-backend`, `paper2notebook-frontend`) with IMMUTABLE image tags (per semgrep security finding — prevents tag overwriting) and scan-on-push enabled.

---

### infra/alb.tf (NEW)
**Purpose**: Application Load Balancer with path-based routing.

Creates: ALB security group (port 80 inbound from anywhere), ALB in public subnets, backend target group (port 8000, health check on `/api/health`), frontend target group (port 3000, health check on `/`), HTTP listener with default action → frontend, listener rule: `/api/*` → backend (priority 100).

---

### infra/ecs.tf (NEW)
**Purpose**: ECS cluster, services, task definitions, IAM, logging, and security groups.

Creates: ECS security group (only ALB can reach ports 8000 and 3000), ECS cluster with Container Insights enabled, IAM execution role with `AmazonECSTaskExecutionRolePolicy`, 2 CloudWatch log groups (14-day retention), 2 Fargate task definitions (each referencing its ECR image + tag, with log configuration), 2 ECS services (1 desired count, private subnets, ALB target group registration).

The backend task definition includes a `CORS_ORIGINS` environment variable set to the ALB's DNS name, so the backend accepts requests from the ALB-fronted frontend.

---

### infra/outputs.tf (NEW)
**Purpose**: Terraform outputs for use by CD pipeline and operators.

Outputs: `alb_dns_name` (the public URL), `backend_ecr_url` and `frontend_ecr_url` (for `docker push`), `ecs_cluster_name`, `backend_service_name`, `frontend_service_name` (for `aws ecs update-service`).

---

### frontend/vitest.config.ts (MODIFIED)
**Purpose**: Excludes `tests/quality/**` from Vitest scan.

The real quality test uses Playwright's `test.describe()` which conflicts with Vitest's test runner. Adding `"tests/quality/**"` to the exclude list prevents Vitest from trying to parse it.

---

### .gitignore (MODIFIED)
**Purpose**: Added `aws_cred.md` (credentials file), `*.tfstate` and `.terraform/` (Terraform state), and `test-results/` (Playwright output).

---

## Data Flow

### arXiv URL Flow (new in v3)
1. User selects "arXiv URL" tab → types `1706.03762` or full arXiv URL
2. User enters API key (OpenAI or Gemini) and clicks "Generate Notebook"
3. Frontend sends POST `/api/generate` with `arxiv_url` field in FormData + `Authorization: Bearer <key>`
4. Backend parses arXiv ID from URL via `parse_arxiv_id()` (regex matching)
5. Backend downloads PDF from `https://arxiv.org/pdf/{id}` via `httpx.AsyncClient`
6. Backend validates PDF (magic bytes `%PDF`, size 1KB-50MB)
7. Existing pipeline: extract text → sanitize → hardened prompt → LLM → validate output → build .ipynb
8. SSE stream: `event: progress` messages → `event: complete` with notebook data
9. Frontend Zod-validates the response → displays result view → saves to localStorage history

### CI/CD Flow (new in v3)
1. Developer pushes to any branch → CI workflow triggers
2. 4 parallel jobs: backend pytest, frontend vitest+Playwright, semgrep, pip-audit+npm-audit
3. All must pass for PR to be mergeable
4. Developer merges to `main` → CD workflow triggers
5. CD builds both Docker images, tags with commit SHA, pushes to ECR
6. CD calls `aws ecs update-service --force-new-deployment` on both services
7. ECS pulls new images from ECR and performs rolling deployment

### Docker Local Flow (new in v3)
1. Developer runs `docker compose up --build`
2. Backend image built from `Dockerfile.backend` (python:3.12-slim + uvicorn)
3. Frontend image built from `Dockerfile.frontend` (node:20-alpine + standalone Next.js)
4. Backend starts first, health check passes on `/api/health`
5. Frontend starts after backend is healthy
6. App available at `http://localhost:3000` → API calls go to `http://localhost:8000`

## Test Coverage

### Backend (pytest) — 194 tests
- **arXiv fetcher** (18 tests): ID parsing (new-style, versioned, old-style, abs/pdf URLs, whitespace, invalid), fetch success, 404, non-PDF response, connection error, correct URL construction
- **CI workflow validation** (8 tests): YAML valid, triggers on push/PR, has required 4 jobs, backend runs pytest, frontend runs vitest+Playwright, semgrep job, pip-audit+npm-audit job
- **CD workflow validation** (10 tests): YAML valid, triggers on main, has deploy job, uses AWS credentials action, uses ECR login, references GitHub Secrets, builds Docker images, pushes to ECR, updates ECS services
- **Dockerfile.backend validation** (7 tests): Exists, uses python:3.12-slim, non-root user, exposes 8000, runs uvicorn, no test deps, CORS_ORIGINS env var in main.py
- **Dockerfile.frontend validation** (8 tests): Exists, uses node:20-alpine, multi-stage (2+ FROM), non-root user, exposes 3000, uses standalone, NEXT_PUBLIC_API_URL build arg, next.config has standalone
- **docker-compose validation** (8 tests): Exists, valid YAML, has backend+frontend services, correct ports, CORS env on backend, API URL on frontend, backend health check
- **Terraform validation** (17 tests): infra/ exists, main.tf/variables.tf/outputs.tf exist, AWS provider, VPC, subnets, ALB, ECS cluster, ECS services, ECR repos, security groups, CloudWatch logs, NAT gateway, image tag variables, ALB DNS output, us-east-1 default
- **All v1/v2 tests** (118 tests): Health, PDF extraction, parsing, auth, sanitizer, prompts, output validator, rate limiting, error handling, security headers, dependency pinning, security integration

### Frontend Unit (Vitest) — 28 tests
- **Config** (2 tests): API URL configuration
- **Schemas** (12 tests): Zod validation for notebook, error, safety warning
- **History** (12 tests): localStorage save/load/delete/clear, title extraction
- **Generation stream** (2 tests): API URL, endpoint path

### Frontend E2E (Playwright) — 68 tests
- **arXiv input** (11 tests): Tabs visible, PDF default, tab toggle shows/hides, URL placeholder, URL acceptance, generate enable/disable, tab switch clears state, screenshots
- **Full flow - PDF** (3 tests): Complete flow, error→retry, new notebook reset
- **Full flow - arXiv** (4 tests): Complete flow, request body verification, error display, tab preserves API key
- **arXiv-specific** (7 tests): Tab toggle, generate states, URL formats, progress messages, Gemini provider, screenshots
- **All v1/v2 E2E** (43 tests): Design system, landing page, processing view, result view, history panel, UI polish

### Quality Test (manual) — 1 test, 9 validations
- Real notebook generation from "Attention Is All You Need" with headed browser
- Validates: cell count, sections, Python syntax, JSON structure, nbformat, paper title

**Total: 290 automated tests + 1 manual quality test**

## Security Measures

1. **AWS credentials in GitHub Secrets only**: Access keys stored as `AWS_ACCESS_KEY_ID`, `AWS_SECRET_ACCESS_KEY`, `AWS_REGION` — never in files or code. `aws_cred.md` gitignored.
2. **ECR IMMUTABLE tags**: Docker images cannot be overwritten once pushed — prevents supply chain attacks via tag mutation.
3. **Non-root Docker users**: Backend runs as `appuser`, frontend runs as `nextjs` — no root processes in production.
4. **Private subnets for ECS**: Fargate tasks run in private subnets with no public IPs — only accessible through ALB.
5. **Security groups**: ALB allows port 80 inbound; ECS only allows traffic from ALB security group on ports 8000/3000.
6. **CI security scanning**: Semgrep runs on every push/PR with `--error` flag — blocks merges on findings.
7. **Dependency auditing**: `pip-audit` and `npm audit` run on every push/PR — catches known vulnerabilities.
8. **CORS from environment**: No hardcoded origins — production CORS configured via `CORS_ORIGINS` env var.
9. **All v2 security preserved**: Prompt injection defense (3 layers), rate limiting, auth headers, PDF magic bytes, security headers, generic error messages.

## Known Limitations

- **No HTTPS**: ALB listener is HTTP only. Custom domain + ACM certificate needed for TLS.
- **No auto-scaling**: ECS services run with `desired_count = 1` — no scaling policies.
- **Single NAT Gateway**: One NAT in a single AZ — not HA. Production should use one per AZ.
- **CD doesn't wait for CI**: The CD workflow triggers on push to main independently. CI and CD run in parallel — a broken push could deploy before CI catches it.
- **No Terraform state locking**: S3 backend configured but no DynamoDB table for state locking.
- **ALB access logs disabled**: Semgrep flagged this — requires an S3 bucket for log storage.
- **CloudWatch logs unencrypted**: Uses AWS-managed keys, not custom KMS.
- **Frontend API URL baked at build time**: `NEXT_PUBLIC_API_URL` is a build arg, not a runtime env var. Changing the ALB DNS requires a rebuild.
- **Docker build not tested in CI**: Docker daemon not available in test environment, so Dockerfile build validation is file-content based, not actual `docker build`.
- **Quality test is manual**: The real quality test requires a human to enter an API key — cannot run in CI.
- **No health check for frontend in ECS**: ALB checks `/` but the frontend has no dedicated health endpoint.

## What's Next

Sprint v4 should focus on production hardening and observability:

1. **HTTPS + Custom Domain**: ACM certificate, Route 53 DNS, ALB HTTPS listener
2. **Auto-scaling**: ECS auto-scaling policies based on CPU/memory utilization
3. **CI gates CD**: Make CD workflow `needs: ci` so deployments are blocked by test failures
4. **Terraform state locking**: Add DynamoDB table for state lock
5. **Monitoring**: CloudWatch alarms, dashboard for request latency and error rates
6. **Multi-AZ NAT**: NAT Gateway per AZ for high availability
7. **Notebook preview**: Render the generated notebook in the browser before downloading
8. **User authentication**: OAuth/email login to track usage and enable server-side history
