# Sprint v3 - PRD: Production-Ready

## Overview
Make Paper2Notebook production-ready with three pillars: (1) add arXiv URL input so users can paste a link instead of downloading PDFs, (2) build a CI/CD pipeline with GitHub Actions covering tests, security scans, and automated deployment, and (3) containerize with Docker and deploy to AWS ECS Fargate via Terraform.

## Goals
- Users can paste an arXiv URL (e.g., `https://arxiv.org/abs/1706.03762`) and generate a notebook without manually downloading the PDF
- E2E Playwright tests cover both PDF upload and arXiv URL flows with screenshots
- A real quality test generates a notebook from "Attention Is All You Need" in a headed browser, validates output quality (valid JSON, 8+ sections, valid Python), and produces screenshot proof
- GitHub Actions CI runs pytest, Playwright, semgrep, and pip-audit on every push/PR — merge is blocked if any check fails
- Backend and frontend are containerized with Docker and orchestrated via docker-compose
- Terraform provisions AWS ECS Fargate infrastructure (VPC, ALB, ECS, ECR)
- CD pipeline auto-deploys to AWS when tests pass on `main`

## User Stories
- As a researcher, I want to paste an arXiv URL so I don't have to download the PDF first
- As a developer, I want CI checks on every PR so broken code never reaches main
- As an operator, I want Docker containers so the app runs identically in dev and production
- As an operator, I want infrastructure-as-code so deployments are reproducible and auditable

## Technical Architecture

### arXiv URL Feature
```
Frontend                          Backend
┌─────────────────┐              ┌──────────────────────────┐
│ Tab: "arXiv URL" │   POST      │ /api/generate            │
│ ┌─────────────┐  │ ─────────→  │  provider: openai|gemini │
│ │ URL input   │  │             │  arxiv_url: "1706.03762" │
│ └─────────────┘  │             │                          │
│ (no file upload) │             │  arxiv_fetcher.py        │
└─────────────────┘              │  ├─ parse arXiv ID       │
                                 │  ├─ GET arxiv.org/pdf/ID │
                                 │  ├─ validate PDF bytes   │
                                 │  └─ return PDF bytes     │
                                 │                          │
                                 │  → existing pipeline     │
                                 │    (extract → sanitize   │
                                 │     → LLM → validate     │
                                 │     → build .ipynb)      │
                                 └──────────────────────────┘
```

### CI/CD Pipeline (GitHub Actions)
```
Push / PR to any branch
        │
        ▼
┌─────────────────────────────────────┐
│          CI Workflow (.yml)          │
│                                     │
│  ┌───────────┐  ┌────────────────┐  │
│  │ pytest    │  │ Playwright E2E │  │
│  │ (backend) │  │ (frontend)     │  │
│  └───────────┘  └────────────────┘  │
│  ┌───────────┐  ┌────────────────┐  │
│  │ semgrep   │  │ pip-audit      │  │
│  │ (SAST)    │  │ (dep vulns)    │  │
│  └───────────┘  └────────────────┘  │
│                                     │
│  ALL must pass → PR mergeable       │
└─────────────────────────────────────┘

Push to main (after CI passes)
        │
        ▼
┌─────────────────────────────────────┐
│          CD Workflow (.yml)          │
│                                     │
│  1. Build backend Docker image      │
│  2. Build frontend Docker image     │
│  3. Push both to AWS ECR            │
│  4. Update ECS Fargate services     │
│     (rolling deployment)            │
└─────────────────────────────────────┘
```

### Docker Architecture
```
docker-compose.yml
├── backend (FastAPI)
│   ├── Dockerfile.backend
│   ├── Python 3.12-slim
│   ├── uvicorn on port 8000
│   └── CORS_ORIGINS env var
│
├── frontend (Next.js standalone)
│   ├── Dockerfile.frontend
│   ├── Node 20-alpine + Next.js standalone output
│   ├── Port 3000
│   └── NEXT_PUBLIC_API_URL env var
│
└── Network: both on same bridge network
```

### AWS ECS Fargate (Terraform)
```
┌─────────────────────────────────────────────────┐
│                    AWS VPC                        │
│                                                   │
│  ┌──────────── Public Subnets ──────────────┐    │
│  │  ┌──────────────────────────────────────┐ │    │
│  │  │     Application Load Balancer        │ │    │
│  │  │  ┌────────┐         ┌─────────────┐  │ │    │
│  │  │  │ /* →   │         │ /api/* →    │  │ │    │
│  │  │  │frontend│         │ backend     │  │ │    │
│  │  │  └────┬───┘         └──────┬──────┘  │ │    │
│  │  └───────┼────────────────────┼─────────┘ │    │
│  └──────────┼────────────────────┼───────────┘    │
│             │                    │                 │
│  ┌──────────┼── Private Subnets ─┼───────────┐    │
│  │    ┌─────▼─────┐      ┌──────▼──────┐     │    │
│  │    │ ECS Task  │      │ ECS Task    │     │    │
│  │    │ frontend  │      │ backend     │     │    │
│  │    │ (Fargate) │      │ (Fargate)   │     │    │
│  │    └───────────┘      └─────────────┘     │    │
│  └───────────────────────────────────────────┘    │
│                                                   │
│  ┌─────────┐  ┌──────────────┐  ┌─────────────┐  │
│  │   ECR   │  │ CloudWatch   │  │ NAT Gateway │  │
│  │ (images)│  │ (logs)       │  │ (outbound)  │  │
│  └─────────┘  └──────────────┘  └─────────────┘  │
└───────────────────────────────────────────────────┘
```

### Security Notes
- **AWS credentials** are stored in **GitHub Secrets** (`AWS_ACCESS_KEY_ID`, `AWS_SECRET_ACCESS_KEY`) — never in files or code
- `aws_cred.md` must be deleted and added to `.gitignore`
- Terraform state stored in S3 bucket (encrypted)
- ECS tasks run in private subnets, only ALB is publicly accessible
- Security groups restrict traffic to ALB → ECS only

## Out of Scope (v4+)
- Custom domain name + HTTPS certificate (ACM + Route 53)
- User authentication (OAuth/email accounts)
- Server-side notebook persistence / database
- Auto-scaling policies for ECS
- Multi-region deployment
- Monitoring dashboards (Grafana/CloudWatch)
- OCR fallback for scanned PDFs

## Dependencies
- Sprint v2 complete (all 12 tasks done, 189 tests passing)
- AWS IAM user `paper2notebook` with: AmazonEC2FullAccess, AmazonECS_FullAccess, AmazonEC2ContainerRegistryFullAccess, ElasticLoadBalancingFullAccess, IAMFullAccess, CloudWatchLogsFullAccess, AmazonS3FullAccess
- GitHub repository with `gh` CLI authenticated
- "Attention Is All You Need" PDF downloaded from arXiv for quality test
