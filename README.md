# MultiDoc AI — Multi-Document Knowledge Base Chatbot

A production-grade, full-stack RAG (Retrieval-Augmented Generation) application that lets you upload multiple documents and chat with them using natural language.

🔗 **Live Demo:** https://multi-doc-knowledge-base.vercel.app

---

## Features

- 📄 **Multi-format support** — PDF, DOCX, TXT, CSV, XLSX, PPTX, Markdown
- 🧠 **Adaptive RAG strategies** — Deep Read, Standard RAG, Query Expansion, Hierarchical RAG
- 🔍 **Smart retrieval** — ChromaDB vector search with relevance threshold and retry fallback
- 💬 **Streaming responses** — token-by-token output with blinking cursor
- 📚 **Multi-document targeting** — query all docs or select a specific one
- 🗂️ **Chat history** — session-based history stored in PostgreSQL with date grouping
- 📊 **Source citations** — every answer cites the source document
- 🎯 **Intent detection** — greetings, summaries, comparisons handled separately
- 🗑️ **Document management** — upload, delete, re-index documents on the fly
- 📱 **Fully responsive** — works on mobile with bottom tab navigation
- 🔄 **Token-aware chunking** — stays within Groq free tier limits automatically

---

## Tech Stack

**Backend**
- Python 3.11, Flask
- ChromaDB (vector store)
- Sentence Transformers (`all-MiniLM-L6-v2`)
- Groq API (Llama 3.3 70b)
- PostgreSQL (chat history)
- Gunicorn

**Frontend**
- React + Vite
- Axios
- Lucide React
- React Markdown

**Deployment**
- Frontend → Vercel
- Backend → Hugging Face Spaces (Docker)
- Database → Render (PostgreSQL)

---

## Architecture
User → React Frontend (Vercel)

↓

Flask API (Hugging Face Spaces)

↓

Intent Detection

↓

ChromaDB Vector Retrieval

↓

Groq LLM (Llama 3.3 70b)

↓

Streaming Response → Frontend

↓

PostgreSQL (chat history saved)

---

## RAG Pipeline

1. **Ingest** — Documents are parsed per file type, chunked (800 chars, 250 overlap), embedded with `all-MiniLM-L6-v2` and stored in ChromaDB
2. **Retrieve** — Adaptive strategy selected based on chunk count:
   - `deep_read` — ≤80 chunks, reads all content
   - `standard_rag` — ≤600 chunks, top-k similarity search
   - `query_expansion` — ≤3000 chunks, 3 query variants merged and deduped
   - `hierarchical` — >3000 chunks, two-pass retrieval with subtopic expansion
3. **Generate** — Groq Llama 3.3 70b generates grounded answer from retrieved context
4. **Stream** — Answer streamed token by token to frontend via SSE

---

## Supported File Types

| Format | Library Used |
|--------|-------------|
| PDF | PDFPlumber + Tesseract OCR (fallback) |
| DOCX | python-docx |
| TXT / MD | Native read |
| CSV | pandas |
| XLSX | openpyxl |
| PPTX | python-pptx |

---

## Project Structure
multi-doc-knowledge-base/

├── app.py              # Flask API (upload, query, stream, history, docs, delete)

├── ingest.py           # Document parsing, chunking, embedding, ChromaDB storage

├── query.py            # RAG engine — adaptive retrieval strategies + Groq LLM

├── requirements.txt

├── frontend/

│   └── src/

│       ├── pages/

│       │   └── ChatPage.jsx       # Main UI — 3 panel layout, mobile responsive

│       ├── components/

│       │   ├── Sidebar.jsx        # Chat history, search, new chat

│       │   ├── MessageBubble.jsx  # Message rendering, markdown, copy, feedback

│       │   └── DocsPanel.jsx      # Upload, doc list, delete, RAG info modal

│       └── api/

│           └── chat.js            # API calls — upload, query, stream, history

└── hf-space/           # Hugging Face Spaces deployment (Dockerfile)

---

## API Endpoints

| Method | Endpoint | Description |
|--------|----------|-------------|
| POST | `/upload` | Upload and index a document |
| POST | `/query` | Ask a question (non-streaming) |
| POST | `/stream` | Ask a question (streaming SSE) |
| GET | `/history` | Get chat history |
| DELETE | `/clear` | Clear chat history |
| GET | `/docs` | List uploaded documents |
| DELETE | `/delete-doc` | Delete a document |

---

## Local Setup

```bash
# Clone
git clone https://github.com/PrasannaBalaji29/multi-doc-knowledge-base.git
cd multi-doc-knowledge-base

# Create virtual environment
python -m venv venv
venv\Scripts\activate  # Windows
source venv/bin/activate  # Mac/Linux

# Install dependencies
pip install -r requirements.txt

# Create .env file
GROQ_API_KEY=your_groq_api_key
DATABASE_URL=your_postgresql_url

# Run backend
python app.py

# Run frontend (new terminal)
cd frontend
npm install
npm run dev
```

---

## Deployment

| Service | Platform | URL |
|---------|----------|-----|
| Frontend | Vercel | https://multi-doc-knowledge-base.vercel.app |
| Backend | Hugging Face Spaces | https://prasannabalaji-multidoc-ai-backend.hf.space |
| Database | Render PostgreSQL | Managed PostgreSQL |

---

## Key Design Decisions

- **ChromaDB over FAISS** — persistent storage, no need to rebuild index on restart
- **Groq over OpenAI** — free tier with Llama 3.3 70b, fast inference
- **Token budget management** — caps chunks at ~9000 tokens to stay within Groq free tier (12k TPM)
- **Adaptive RAG** — strategy auto-selected based on document size for optimal accuracy
- **PostgreSQL** — persistent chat history across sessions and deployments
- **HF Spaces Docker** — reliable free hosting for ML/AI backends

---

## Author

**Prasanna Balaji L**

[![LinkedIn](https://img.shields.io/badge/LinkedIn-prasanna--balaji--l-blue)](https://www.linkedin.com/in/prasanna-balaji-l)
[![GitHub](https://img.shields.io/badge/GitHub-PrasannaBalaji29-black)](https://github.com/PrasannaBalaji29)
[![Naukri](https://img.shields.io/badge/Naukri-Profile-orange)](https://www.naukri.com/mnjuser/profile?id=&altresid)