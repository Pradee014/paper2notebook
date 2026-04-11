# Sprint v1 - PRD: Paper2Notebook

## Overview
Build a web application where researchers upload an academic paper (PDF) and receive a highly structured, publication-quality Jupyter notebook that replicates the paper's methodology using synthetic data. The app uses OpenAI's GPT-5.4 reasoning model to deeply understand the paper and generate notebooks suitable for top-tier ML researchers at organizations like OpenAI and DeepMind.

## Goals
- User can enter their OpenAI API key and upload a research paper PDF
- Backend extracts full text from the PDF and sends it to GPT-5.4 for structured notebook generation
- User sees real-time progress messages during the (potentially long) generation process
- Output is a downloadable `.ipynb` file with a one-click "Open in Colab" option
- UI follows a dark, retro-computing aesthetic inspired by [arcprize.org](https://arcprize.org/arc-agi)

## User Stories
- As a ML researcher, I want to upload a paper and get a runnable notebook, so I can quickly replicate and build upon published research
- As a researcher, I want the notebook to use realistic synthetic data (not toy examples), so I can validate the algorithm's behavior before investing time in full reproduction
- As a user, I want to see what's happening during generation, so I don't feel like the app is frozen while waiting
- As a user, I want to open the notebook directly in Google Colab, so I can run it immediately without local setup

## Technical Architecture

### Tech Stack
- **Frontend**: Next.js 14 (App Router) + Tailwind CSS v4
- **Backend**: Python FastAPI
- **PDF Parsing**: PyMuPDF (`pymupdf`)
- **Notebook Generation**: `nbformat` (Python)
- **AI Model**: OpenAI GPT-5.4 (`gpt-5.4`) via `openai` Python SDK
- **Real-time Updates**: Server-Sent Events (SSE)
- **Font**: Space Mono (Google Fonts)

### Component Diagram
```
┌─────────────────────────────────────────────────┐
│                   Browser                        │
│                                                  │
│  ┌──────────┐  ┌──────────┐  ┌───────────────┐  │
│  │ API Key  │→ │  Upload  │→ │  Processing   │  │
│  │  Input   │  │   Zone   │  │  Status View  │  │
│  └──────────┘  └──────────┘  └───────┬───────┘  │
│                                      │           │
│                              ┌───────▼───────┐   │
│                              │   Download /  │   │
│                              │  Open Colab   │   │
│                              └───────────────┘   │
└──────────────────┬───────────────────────────────┘
                   │ HTTP + SSE
┌──────────────────▼───────────────────────────────┐
│                FastAPI Backend                     │
│                                                   │
│  ┌────────────┐  ┌─────────────┐  ┌────────────┐ │
│  │  PDF Upload │→│  Text       │→ │  OpenAI    │ │
│  │  Endpoint   │ │  Extraction │  │  GPT-5.4   │ │
│  └────────────┘  └─────────────┘  └─────┬──────┘ │
│                                         │        │
│                                  ┌──────▼──────┐ │
│                                  │  nbformat   │ │
│                                  │  .ipynb Gen  │ │
│                                  └─────────────┘ │
└──────────────────────────────────────────────────┘
```

### Data Flow
1. User enters OpenAI API key (stored in browser memory only, never persisted)
2. User uploads PDF → POST `/api/generate` (multipart form: PDF file + API key)
3. Backend extracts text via PyMuPDF
4. Backend streams SSE progress events to frontend while calling GPT-5.4
5. GPT-5.4 returns structured notebook content (markdown + code cells)
6. Backend assembles `.ipynb` via nbformat, returns download URL
7. Frontend shows download button + "Open in Colab" link (via Colab's GitHub Gist or raw URL scheme)

### Notebook Quality Requirements
The generated notebook must include:
- **Title & metadata**: Paper title, authors, date, link
- **Abstract summary**: Concise restatement of the paper's contribution
- **Background & motivation**: Why this paper matters, key references
- **Mathematical formulation**: LaTeX-rendered equations from the paper
- **Algorithm breakdown**: Step-by-step implementation with explanations
- **Synthetic data generation**: Realistic data that demonstrates the algorithm (not random noise)
- **Full implementation**: Working code cells implementing the core algorithm
- **Experiments & visualization**: Plots reproducing key figures/results from the paper
- **Ablation studies**: Parameter sensitivity analysis
- **Discussion**: Limitations, extensions, connection to related work

## Out of Scope (v2+)
- User authentication and accounts
- Usage tracking and rate limiting
- Persistent storage of generated notebooks
- Batch processing of multiple papers
- Custom notebook templates
- Real-time collaboration
- Deployment infrastructure (Docker, CI/CD)
- Paper URL input (arXiv, etc.) — PDF upload only for v1

## Dependencies
- None (greenfield project)
- User must provide their own OpenAI API key with GPT-5.4 access
