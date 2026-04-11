# Sprint v2 - PRD: Security Hardening

## Overview
Harden the Paper2Notebook application against the security vulnerabilities identified in the v1 audit. The primary focus is defending against prompt injection (the most architecturally significant risk), followed by API security, input validation, rate limiting, and error handling. Colab integration is removed (broken). Generation history is added as the single new feature.

## Goals
- Prompt injection is defended against with input sanitization, structured delimiters, and output validation
- API key is transmitted securely via Authorization header, not form body
- All endpoints are rate-limited to prevent abuse
- PDF uploads are validated by magic bytes, not just file extension
- Error messages never leak internal details; structured logging captures them server-side
- Security headers are present on all responses
- Frontend validates all API responses with schemas
- Users can view and re-download previously generated notebooks from browser history

## User Stories
- As a researcher, I want my API key transmitted securely, so it isn't exposed in logs or proxies
- As a user, I want to re-download a notebook I generated earlier, so I don't have to re-process the same paper
- As an operator, I want rate limiting, so a single user can't exhaust API resources
- As an operator, I want structured logs, so I can investigate failures without leaking details to users

## Technical Architecture

### Changes from v1
- **Colab removed**: `frontend/src/lib/colab.ts` deleted, Colab button removed from result view
- **Auth header**: API key moves from `FormData.api_key` to `Authorization: Bearer <key>` header
- **Rate limiting**: `slowapi` added to backend, 5 req/min per IP on generation endpoints
- **Prompt injection defense**: Three-layer approach — input sanitization, hardened prompt structure, output validation
- **Security middleware**: Custom FastAPI middleware for response headers
- **Logging**: Python `logging` module with structured JSON output
- **Frontend validation**: Zod schemas for all API response types
- **Generation history**: localStorage-based, max 20 entries, stores metadata + base64 notebook

### Prompt Injection Defense (3 layers)

```
Layer 1 — INPUT SANITIZATION
┌─────────────────────────────────────┐
│ extract_text_from_pdf()             │
│ → strip null bytes, control chars   │
│ → truncate to 100K chars            │
│ → detect/flag suspicious patterns   │
└──────────────┬──────────────────────┘
               ▼
Layer 2 — HARDENED PROMPT STRUCTURE
┌─────────────────────────────────────┐
│ System prompt:                      │
│ - Explicit "ignore override" clause │
│ - Unique boundary delimiters        │
│ - Role reinforcement after content  │
│                                     │
│ User prompt:                        │
│ <paper-content>                     │
│   {sanitized text}                  │
│ </paper-content>                    │
│ + post-content instruction anchor   │
└──────────────┬──────────────────────┘
               ▼
Layer 3 — OUTPUT VALIDATION
┌─────────────────────────────────────┐
│ validate_notebook_safety()          │
│ - Scan code cells for dangerous     │
│   patterns: os.system, subprocess,  │
│   eval, exec, __import__, requests  │
│   to unknown URLs, file writes      │
│ - Flag but don't block (warn user)  │
└─────────────────────────────────────┘
```

### Component Diagram (changes highlighted)
```
┌─────────────────────────────────────────────────┐
│                   Browser                        │
│                                                  │
│  ┌──────────┐  ┌──────────┐  ┌───────────────┐  │
│  │ API Key  │→ │  Upload  │→ │  Processing   │  │
│  │  Input   │  │   Zone   │  │  Status View  │  │
│  └──────────┘  └──────────┘  └───────┬───────┘  │
│                                      │           │
│  ┌───────────────┐           ┌───────▼───────┐   │
│  │  [NEW]        │           │   Download    │   │
│  │  History      │           │   (no Colab)  │   │
│  │  Panel        │           └───────────────┘   │
│  └───────────────┘                               │
│  [NEW] Zod schema validation on all responses    │
└──────────────────┬───────────────────────────────┘
                   │ Authorization: Bearer <key>
┌──────────────────▼───────────────────────────────┐
│                FastAPI Backend                     │
│  [NEW] Security headers middleware                │
│  [NEW] Rate limiting (slowapi)                    │
│  [NEW] Structured logging                         │
│                                                   │
│  ┌────────────┐  ┌─────────────┐  ┌────────────┐ │
│  │  PDF Upload │→│  [UPDATED]  │→ │  OpenAI    │ │
│  │  + magic   │ │  Sanitizer  │  │  GPT-5.4   │ │
│  │  byte check│ │  + prompts  │  │  + timeout │ │
│  └────────────┘  └─────────────┘  └─────┬──────┘ │
│                                         │        │
│                                  ┌──────▼──────┐ │
│                                  │ [NEW]       │ │
│                                  │ Output      │ │
│                                  │ Validator   │ │
│                                  └─────────────┘ │
└──────────────────────────────────────────────────┘
```

## Out of Scope (v3+)
- User authentication (OAuth/email accounts)
- Server-side notebook persistence / database
- Docker containerization and cloud deployment
- HTTPS enforcement (deployment concern)
- arXiv URL input
- Notebook preview in browser
- OCR fallback for scanned PDFs

## Dependencies
- Sprint v1 complete (all 10 tasks done, 79 tests passing)
- v1 security audit findings (SEC-01 through SEC-16)
