# MultiDoc AI — Multi-Document Knowledge Base Chatbot

> A production-grade, full-stack RAG (Retrieval-Augmented Generation) application that lets you upload multiple documents and have intelligent, context-aware conversations with them.

🔗 **Live Demo:** [multi-doc-knowledge-base.vercel.app](https://multi-doc-knowledge-base.vercel.app)  
🧠 **Backend API:** [prasannabalaji-multidoc-ai-backend.hf.space](https://prasannabalaji-multidoc-ai-backend.hf.space)

[![Python](https://img.shields.io/badge/Python-3.11-blue?logo=python)](https://python.org)
[![Flask](https://img.shields.io/badge/Flask-3.1-black?logo=flask)](https://flask.palletsprojects.com)
[![React](https://img.shields.io/badge/React-Vite-61DAFB?logo=react)](https://react.dev)
[![ChromaDB](https://img.shields.io/badge/Vector_DB-ChromaDB-orange)](https://chromadb.com)
[![Groq](https://img.shields.io/badge/LLM-Llama_3.3_70b-purple)](https://groq.com)
[![License](https://img.shields.io/badge/License-MIT-green)](LICENSE)

---

## What Is This?

MultiDoc AI is a **production-ready RAG chatbot** built entirely from scratch. You upload your documents — PDFs, Word files, spreadsheets, presentations, and more — and the app lets you ask natural language questions about them. Answers are grounded in your actual document content, cited by source, and streamed in real time.

This project demonstrates end-to-end ownership of the GenAI stack: document ingestion, vector search, adaptive retrieval, LLM prompting, streaming APIs, and a fully responsive React frontend — all deployed on free-tier cloud infrastructure.

---

## Live Demo

| Action | Result |
|--------|--------|
| Upload a PDF | Parsed, chunked, embedded, stored in ChromaDB |
| Ask a question | Intent detected → RAG strategy selected → Groq LLM answers |
| View source | Every answer cites which document it came from |
| Chat history | Sessions persisted in PostgreSQL, grouped by date |
| Mobile | Full bottom-tab navigation, works on any device |

---

## Features

### Core RAG
- 🧠 **Adaptive RAG strategies** — automatically selects the best retrieval method based on document size
- 🔍 **Dense vector search** — ChromaDB with `all-MiniLM-L6-v2` embeddings, L2 distance scoring
- 🎯 **LLM-based intent detection** — routes greetings, general knowledge, and document queries separately via a fast Groq call
- 📊 **Source citations** — every answer cites the exact document it was retrieved from
- 🔄 **Query expansion** — generates 3 search variants and merges results for better recall
- 🏗️ **Hierarchical retrieval** — two-pass strategy for very large document collections (>3000 chunks)
- 💬 **Conversation history** — sliding window of last 4 messages passed to LLM for context continuity

### Document Support
- 📄 **7 file formats** — PDF, DOCX, TXT, CSV, XLSX, PPTX, Markdown
- 🔎 **OCR fallback** — scanned/image PDFs handled via Tesseract
- 📋 **Table extraction** — tables parsed from PDF, DOCX, XLSX and included in context
- 🗑️ **Live document management** — upload, delete, and re-index documents without restarting

### Production Engineering
- ⚡ **SSE streaming** — token-by-token response with blinking cursor animation
- 🛡️ **Token budget management** — hard cap at ~9000 tokens to stay within Groq 12k TPM free tier
- 🔁 **Retry + relaxed threshold fallback** — if no chunks pass relevance filter, retries with looser threshold before falling back to general knowledge
- 🗂️ **PostgreSQL chat history** — persistent across sessions and deployments
- 📱 **Fully responsive** — 3-panel desktop layout + mobile bottom-tab navigation

---

## Tech Stack

| Layer | Technology |
|-------|-----------|
| **LLM** | Groq API — Llama 3.3 70b Versatile |
| **Embeddings** | `sentence-transformers/all-MiniLM-L6-v2` |
| **Vector Store** | ChromaDB (persistent, no rebuild on restart) |
| **Backend** | Python 3.11, Flask, Gunicorn |
| **Database** | PostgreSQL via psycopg2 |
| **Frontend** | React + Vite, Axios, Lucide React, React Markdown |
| **Deployment** | Hugging Face Spaces (Docker) + Vercel + Render |

---

## Architecture

```
User → React Frontend (Vercel)
         │
         ▼
   Flask API (Hugging Face Spaces)
         │
         ├─► LLM Intent Detection (Groq)
         │         │
         │    greeting / casual → direct LLM response
         │    general_knowledge → LLM without RAG
         │    document → full RAG pipeline ↓
         │
         ├─► Document Targeting (which doc to search)
         │
         ├─► Strategy Selection
         │       ≤80 chunks    → Deep Read
         │       ≤600 chunks   → Standard RAG
         │       ≤3000 chunks  → Query Expansion RAG
         │       >3000 chunks  → Hierarchical RAG
         │
         ├─► ChromaDB Vector Retrieval
         │
         ├─► Token Budget Cap (≤9000 tokens)
         │
         ├─► Groq LLM Generation (Llama 3.3 70b)
         │
         ├─► SSE Streaming Response → Frontend
         │
         └─► PostgreSQL (chat history saved)
```

---

## RAG Pipeline — In Detail

### 1. Ingestion (`ingest.py`)
- Documents parsed per file type using dedicated extractors
- PDFs: PDFPlumber for text pages, Tesseract OCR fallback for scanned pages, table extraction per page
- DOCX: heading styles detected and preserved with `###` prefix for better chunking
- CSV/XLSX: column headers repeated in every chunk so context is preserved mid-file
- Chunked at 800 chars with 250 overlap using `RecursiveCharacterTextSplitter`
- Exact duplicates removed via MD5 fingerprint before embedding
- Embedded with `all-MiniLM-L6-v2` and stored in ChromaDB with rich metadata

### 2. Retrieval (`query.py`)
| Strategy | Trigger | Method |
|----------|---------|--------|
| `deep_read` | ≤80 chunks | Read ALL chunks, token-capped |
| `standard_rag` | ≤600 chunks | Single query, sort by L2 distance, top-k |
| `query_expansion` | ≤3000 chunks | 3 query variants, merge + dedup by hash |
| `hierarchical` | >3000 chunks | Two-pass: broad first, then subtopic expansion |

### 3. Generation
- Prompt engineered to adapt response format to question type (factual → direct, list → bullets, summary → headers)
- Conversation history (last 4 messages) injected before the current prompt
- Groq Llama 3.3 70b with temperature 0.0 for grounded answers, 0.7–0.8 for casual/creative

### 4. Streaming
- Full answer computed first, then streamed word-by-word via SSE
- Frontend appends tokens to the message bubble in real time with blinking cursor

---

## Supported File Types

| Format | Parser | Notes |
|--------|--------|-------|
| PDF | PDFPlumber + Tesseract | OCR fallback for scanned pages |
| DOCX | python-docx | Heading styles + table extraction |
| TXT / MD | Native read | Direct UTF-8 |
| CSV | pandas | Row-batched, headers repeated per chunk |
| XLSX | openpyxl | Per-sheet, headers repeated per chunk |
| PPTX | python-pptx | Slide titles + speaker notes |

---

## API Endpoints

| Method | Endpoint | Description |
|--------|----------|-------------|
| `POST` | `/upload` | Upload and index a document |
| `POST` | `/query` | Ask a question (non-streaming JSON) |
| `POST` | `/stream` | Ask a question (streaming SSE) |
| `GET` | `/history` | Get chat history (all or by session) |
| `DELETE` | `/clear` | Clear chat history |
| `GET` | `/docs` | List all uploaded documents |
| `DELETE` | `/delete-doc` | Delete a document and its vectors |

---

## Project Structure

```
multi-doc-knowledge-base/
├── app.py                  # Flask API — all 7 endpoints
├── ingest.py               # Document parsing, chunking, embedding, ChromaDB storage
├── query.py                # RAG engine — intent detection, adaptive retrieval, Groq LLM
├── requirements.txt
├── hf-space/               # Hugging Face Spaces deployment (Dockerfile + copies of backend)
└── frontend/
    └── src/
        ├── pages/
        │   └── ChatPage.jsx        # Main UI — 3-panel layout, mobile responsive
        ├── components/
        │   ├── Sidebar.jsx         # Chat history, search, new chat, date grouping
        │   ├── MessageBubble.jsx   # Markdown rendering, copy, thumbs up/down, timestamps
        │   └── DocsPanel.jsx       # Upload, drag & drop, doc list, delete, RAG info modal
        └── api/
            └── chat.js             # All API calls — upload, stream, history, docs
```

---

## Key Design Decisions

| Decision | Reasoning |
|----------|-----------|
| **ChromaDB over FAISS** | Persistent storage — no need to rebuild the index on every restart |
| **Groq over OpenAI** | Free tier with Llama 3.3 70b; fast inference, no cost |
| **Adaptive RAG strategies** | One-size retrieval fails on both tiny and huge docs; strategy auto-selected by chunk count |
| **LLM-based intent detection** | Eliminates brittle keyword lists; single Groq call classifies greeting/casual/GK/document |
| **Token budget cap** | Hard ceiling at ~9000 tokens prevents 413 errors on Groq 12k TPM free tier |
| **HF Spaces Docker** | Reliable free hosting for ML backends; avoids cold-start issues of serverless |
| **SSE over WebSockets** | Simpler, stateless, works well for one-way token streaming |

---

## Local Setup

```bash
# 1. Clone the repo
git clone https://github.com/PrasannaBalaji29/multi-doc-knowledge-base.git
cd multi-doc-knowledge-base

# 2. Create and activate virtual environment
python -m venv venv
venv\Scripts\activate        # Windows
source venv/bin/activate     # Mac/Linux

# 3. Install backend dependencies
pip install -r requirements.txt

# 4. Create a .env file in the root
GROQ_API_KEY=your_groq_api_key
DATABASE_URL=your_postgresql_connection_string

# 5. Run the backend
python app.py
# → Runs on http://localhost:5000

# 6. Run the frontend (new terminal)
cd frontend
npm install
npm run dev
# → Runs on http://localhost:5173
```

> **Note:** For PDF OCR support on Windows, install [Tesseract](https://github.com/UB-Mannheim/tesseract/wiki) and [Poppler](https://github.com/oschwartz10612/poppler-windows/releases). Update paths in `ingest.py` if needed.

---

## Deployment

| Service | Platform | URL |
|---------|----------|-----|
| Frontend | Vercel | [multi-doc-knowledge-base.vercel.app](https://multi-doc-knowledge-base.vercel.app) |
| Backend | Hugging Face Spaces (Docker) | [prasannabalaji-multidoc-ai-backend.hf.space](https://prasannabalaji-multidoc-ai-backend.hf.space) |
| Database | Render PostgreSQL | Managed PostgreSQL (free tier) |

---

## Author

**Prasanna Balaji L**

[![LinkedIn](https://img.shields.io/badge/LinkedIn-prasanna--balaji--l-blue?logo=linkedin)](https://www.linkedin.com/in/prasanna-balaji-l)
[![GitHub](https://img.shields.io/badge/GitHub-PrasannaBalaji29-black?logo=github)](https://github.com/PrasannaBalaji29)
[![Naukri](https://img.shields.io/badge/Naukri-Profile-orange)](https://www.naukri.com/mnjuser/profile?id=&altresid)

---

## License

MIT License — feel free to fork, use, and build on this.
