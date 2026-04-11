---
name: walkthrough
description: Generate a sprint review report documenting exactly what was built, including architecture, file inventory, data flow, and test coverage. Use after completing a sprint.
argument-hint: "[optional-sprint-version]"
user-invocable: true
allowed-tools: Read Glob Grep Write Edit Bash
---

You are a technical writer generating a sprint review report. Your job is to read all code produced in the current sprint and create a comprehensive, human-readable walkthrough document.

## Your Process

### Step 1: Identify the Sprint

Find the latest `sprints/vN/` directory (or the one specified in `$ARGUMENTS`). Read:
- `PRD.md` — what was planned
- `TASKS.md` — what tasks were attempted

### Step 2: Inventory All Changes

Use git to find all files created or modified in this sprint:

```bash
# If tasks have commits tagged to this sprint
git log --oneline --name-only
```

Or read the TASKS.md completed entries for the file list.

### Step 3: Generate WALKTHROUGH.md

Write `sprints/vN/WALKTHROUGH.md` with this structure:

```markdown
# Sprint vN — Walkthrough

## Summary
[2-3 sentence summary of what this sprint accomplished]

## Architecture Overview
[ASCII diagram showing the main components and how they connect]

## Files Created/Modified

### [filename.ext]
**Purpose**: [What this file does in 1 sentence]
**Key Functions/Components**:
- `functionName()` — [What it does]
- `ComponentName` — [What it renders/handles]

**How it works**:
[2-3 paragraph plain English explanation. Include relevant code snippets
for the most important logic. Explain WHY, not just WHAT.]

[Repeat for each file]

## Data Flow
[Describe how data moves through the application. Example:
"User submits login form → API route validates credentials →
NextAuth creates session → Redirect to dashboard → Dashboard
fetches metrics from /api/metrics → Renders charts"]

## Test Coverage
[List all tests and what they verify]
- Unit: [N tests] — [what they cover]
- Integration: [N tests] — [what they cover]
- E2E: [N tests] — [what they cover]

## Security Measures
[List security features implemented in this sprint]

## Known Limitations
[Be honest about what's missing, hacky, or could be improved]

## What's Next
[Based on the limitations and PRD trajectory, suggest v(N+1) priorities]
```

## Rules

- Write for a developer who has **NEVER** seen this codebase
- Include actual code snippets for complex logic (5-10 lines, not entire files)
- Every file gets its own section
- Be honest about limitations — don't oversell
- Use the same terminology as the PRD
- Architecture diagram MUST be ASCII art (works everywhere)
- The walkthrough should be self-contained — reader shouldn't need to open source files

## Example Output

### sprints/v1/WALKTHROUGH.md

```markdown
# Sprint v1 — Walkthrough

## Summary
Built an analytics dashboard MVP with email/password authentication,
4 metric cards (Revenue, Users, Conversion, MRR), a Recharts line chart
with date range filtering, and CSV export. Uses Next.js 14 with SQLite.

## Architecture Overview

┌─────────────────────────────────────────────────────┐
│                     Browser                         │
│                                                     │
│  /login ──> /dashboard ──> /api/metrics             │
│              │                  │                    │
│              ├─ MetricCards     │                    │
│              ├─ RevenueChart   │                    │
│              ├─ DateFilter     │                    │
│              └─ ExportButton   │                    │
└──────────────────────┬─────────┘                    │
                       │                              │
                       ▼                              ▼
              ┌────────────────┐            ┌─────────────┐
              │  NextAuth.js   │            │  Prisma ORM │
              │  (sessions)    │            │  (SQLite)   │
              └────────────────┘            └─────────────┘

## Files Created/Modified

### prisma/schema.prisma
**Purpose**: Database schema defining User and Metric tables.
**Models**:
- `User` — id, email, hashedPassword, createdAt
- `Metric` — id, date, revenue, users, conversion, mrr

### src/app/dashboard/page.tsx
**Purpose**: Main dashboard page showing metric cards and chart.
**Key Components**:
- `DashboardPage` — Server component that checks auth, fetches initial data
- Uses `Suspense` for loading states

**How it works**:
The page first checks the session via `getServerSession()`. If no session,
redirects to /login. Otherwise, renders the dashboard layout with MetricCards
at the top and RevenueChart below. The DateFilter component controls the
time range, which triggers a re-fetch of the /api/metrics endpoint.

[... continues for each file ...]

## Data Flow
1. User visits /login -> enters credentials -> POST /api/auth/callback/credentials
2. NextAuth validates password hash -> creates session cookie -> redirects to /dashboard
3. Dashboard page calls GET /api/metrics?range=30d
4. API route queries Prisma for metrics in date range -> returns JSON
5. MetricCards display latest values, RevenueChart plots the time series
6. User changes DateFilter -> new API call -> UI updates
7. Export button calls GET /api/export?range=30d -> returns CSV blob -> browser downloads

## Test Coverage
- Unit: 5 tests — password hashing, date range parsing, CSV formatting
- Integration: 0 (planned for v3)
- E2E: 0 (planned for v3)

## Security Measures
- Passwords hashed with bcrypt (12 rounds)
- Session-based auth via NextAuth.js
- Protected routes redirect to /login

## Known Limitations
- SQLite is single-file, not suitable for production scale
- No rate limiting on auth endpoints
- No input validation (no zod schemas)
- CORS is open (`*`)
- No error boundaries in React

## What's Next
v2 should focus on security hardening: input validation, proper CORS,
rate limiting, parameterized queries, and moving secrets to env variables.
```
