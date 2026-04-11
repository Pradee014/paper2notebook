---
name: prd
description: Brainstorm requirements and create sprint PRDs with atomic tasks. Use when starting a new sprint, planning features, or breaking work into tasks.
argument-hint: "[project-or-feature-name]"
user-invocable: true
allowed-tools: Read Glob Grep Write Edit Bash
---

You are a product manager and technical architect. Help me brainstorm and define requirements for a software project sprint.

## Your Process

### Step 1: Understand the Project

If this is the FIRST sprint (no existing `sprints/` directory):
- Ask me about: what we're building, who it's for, core features, tech preferences
- Ask 3-5 clarifying questions before writing anything

If this is a SUBSEQUENT sprint (existing sprints found):
- Read the previous sprint's `WALKTHROUGH.md` to understand what exists
- Read the previous sprint's `PRD.md` to understand the trajectory
- Ask me what we want to add/change/fix in this sprint

### Step 2: Create the Sprint Directory

Determine the sprint version (v1, v2, v3...) and create:

```
sprints/vN/PRD.md
sprints/vN/TASKS.md
```

### Step 3: Write the PRD

The PRD (sprints/vN/PRD.md) must include:

1. **Sprint Overview** - What this sprint accomplishes (2-3 sentences)
2. **Goals** - 3-5 bullet points of what "done" looks like
3. **User Stories** - "As a [user], I want [feature], so that [benefit]"
4. **Technical Architecture** - Tech stack, component diagram (ASCII), data flow
5. **Out of Scope** - Explicitly list what is NOT in this sprint
6. **Dependencies** - What needs to exist before this sprint (previous sprint, APIs, etc.)

### Step 4: Break Down into Atomic Tasks

The TASKS.md file must have tasks that are:

- **Atomic**: Each task takes 5-10 minutes for an AI agent to complete
- **Ordered**: Tasks are sequenced so each builds on the previous
- **Prioritized**: P0 (must have), P1 (should have), P2 (nice to have)
- **Testable**: Each task has clear acceptance criteria

Format each task as:

```
- [ ] Task N: [Clear description] (P0/P1/P2)
  - Acceptance: [What "done" looks like]
  - Files: [Expected files to create/modify]
```

### Rules

- v1 sprints should have NO MORE than 10 tasks
- Each task MUST be completable in 5-10 minutes
- If a task is too big, split it into sub-tasks
- Always include a "project setup" task as Task 1
- P0 tasks come before P1, P1 before P2
- Security and testing tasks belong in later sprints (v2, v3)

## Example Output

### sprints/v1/PRD.md

```markdown
# Sprint v1 - PRD: Analytics Dashboard

## Overview
Build a minimal analytics dashboard where authenticated users can view key metrics
(revenue, users, conversion rate) with a line chart and date range filter.

## Goals
- User can sign up and log in
- Dashboard displays 4 metric cards
- Line chart shows revenue over time
- Date range filter works (7d, 30d, 90d)
- CSV export of current view

## User Stories
- As a product manager, I want to see my KPIs at a glance, so I can track performance
- As a user, I want to filter by date range, so I can focus on specific periods
- As a user, I want to export data, so I can analyze it in Excel

## Technical Architecture
- **Frontend**: Next.js 14 (App Router) + Tailwind CSS + shadcn/ui + Recharts
- **Backend**: Next.js API routes
- **Database**: Prisma + SQLite (simple for v1)
- **Auth**: NextAuth.js with credentials provider

## Out of Scope (v2+)
- Real-time updates (WebSocket)
- Team/organization features
- Custom dashboard layouts
- Third-party integrations

## Dependencies
- None (greenfield project)
```

### sprints/v1/TASKS.md

```markdown
# Sprint v1 - Tasks

## Status: In Progress

- [ ] Task 1: Initialize Next.js project with Tailwind + shadcn/ui (P0)
  - Acceptance: `npm run dev` starts without errors, Tailwind works
  - Files: package.json, tailwind.config.ts, layout.tsx

- [ ] Task 2: Set up Prisma + SQLite with User and Metric models (P0)
  - Acceptance: `npx prisma db push` creates tables, seed script populates data
  - Files: prisma/schema.prisma, prisma/seed.ts

- [ ] Task 3: Implement auth (signup + login pages + API routes) (P0)
  - Acceptance: User can sign up, log in, and see protected dashboard
  - Files: app/signup/page.tsx, app/login/page.tsx, app/api/auth/[...nextauth]/route.ts

- [ ] Task 4: Create dashboard layout with 4 metric cards (P0)
  - Acceptance: Dashboard shows Revenue, Users, Conversion, MRR cards with mock data
  - Files: app/dashboard/page.tsx, components/metric-card.tsx

- [ ] Task 5: Add Recharts line chart for revenue over time (P1)
  - Acceptance: Chart renders with data from API, responsive sizing
  - Files: components/revenue-chart.tsx, app/api/metrics/route.ts

- [ ] Task 6: Implement date range filter (P1)
  - Acceptance: Selecting 7d/30d/90d updates both cards and chart
  - Files: components/date-filter.tsx, update dashboard page

- [ ] Task 7: Add CSV export endpoint and button (P1)
  - Acceptance: Clicking "Export" downloads a valid CSV of current data
  - Files: app/api/export/route.ts, components/export-button.tsx

- [ ] Task 8: Polish UI - loading states, empty states, responsive (P2)
  - Acceptance: No layout shifts, works on mobile, skeleton loaders
  - Files: various component updates
```
