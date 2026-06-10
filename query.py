"""
query.py — MultiDoc AI · Production-Grade RAG Engine
======================================================
Architecture:
  1. Intent Detection      — greeting / no-docs / normal query
  2. Document Targeting    — which doc(s) to search
  3. Adaptive Strategy     — deep_read / standard_rag / query_expansion / hierarchical
  4. Retrieval             — ChromaDB similarity search with relevance filtering
  5. Generation            — Groq (Llama 3.3 70b) with strict grounding prompt
  6. Fallback              — LLM general knowledge when no docs / no relevant chunks

Optimizations in this version:
  - Token-aware chunk capping — never exceed Groq 12k limit
  - Smarter prompt — forces exhaustive detail extraction
  - Better dedup in query expansion — fingerprint on full chunk not first 100 chars
  - standard_rag sorts by distance before capping — best chunks always win
  - handle_summary uses rolling window — covers more doc with less tokens
  - _no_relevant_content_response relaxes threshold and retries before fallback
"""

# ── Imports ────────────────────────────────────────────────────────────────────
from groq import Groq
import chromadb
from sentence_transformers import SentenceTransformer
import os
import time
import logging
from dotenv import load_dotenv
from collections import defaultdict

# ── Logging ────────────────────────────────────────────────────────────────────
logging.basicConfig(
    level=logging.INFO,
    format="%(asctime)s [%(levelname)s] %(message)s",
    datefmt="%H:%M:%S"
)
log = logging.getLogger("multidoc")

# ── Environment ────────────────────────────────────────────────────────────────
load_dotenv()

# ── Clients ────────────────────────────────────────────────────────────────────
client_ai = Groq(api_key=os.getenv("GROQ_API_KEY"))
embedder  = SentenceTransformer("all-MiniLM-L6-v2")

chroma_client = chromadb.PersistentClient(path="./chroma_db")

def get_collection():
    return chroma_client.get_collection("knowledge_base")

# ── Constants ──────────────────────────────────────────────────────────────────
FETCH_CANDIDATES    = 150   # candidates pulled from ChromaDB per query
RELEVANCE_THRESHOLD = 2.0   # L2 distance cutoff
DEEP_READ_LIMIT     = 80    # chunks <= this -> deep_read
STANDARD_RAG_LIMIT  = 600   # chunks <= this -> standard_rag
EXPANDED_RAG_LIMIT  = 3000  # chunks <= this -> query_expansion
                             # chunks > 3000  -> hierarchical

# Token budget per Groq free tier: 12000 TPM
# 1 chunk ~ 200 tokens, prompt overhead ~ 500 tokens
# Safe budget: 11500 tokens for chunks = ~57 chunks max
# We stay conservative at 45 to leave room for long chunks
MAX_CHUNKS_SAFE     = 45    # hard ceiling across ALL strategies

CHUNKS_PER_DOC = {
    "deep_read":       20,   # capped — Groq free tier safe
    "standard_rag":    45,   # best chunks sorted by distance
    "query_expansion": 35,   # merged across 3 query variants
    "hierarchical":    20,   # 2-pass, deeper coverage
}

GROQ_MODEL      = "llama-3.3-70b-versatile"
GROQ_MAX_TOKENS = 3000   # leave headroom for input tokens
GROQ_RETRIES    = 3
GROQ_RETRY_WAIT = 2

# ── File Type Labels ───────────────────────────────────────────────────────────
FILE_TYPE_LABELS = {
    ".pdf":  "📕 PDF",
    ".docx": "📘 Word Document",
    ".txt":  "📄 Text File",
    ".csv":  "📊 CSV File",
    ".xlsx": "📊 Excel File",
    ".pptx": "📊 PowerPoint",
    ".md":   "📝 Markdown File",
}

def get_file_label(filename: str) -> str:
    ext = os.path.splitext(filename)[1].lower()
    return FILE_TYPE_LABELS.get(ext, "📄 Document")


# ══════════════════════════════════════════════════════════════════════════════
# TOKEN ESTIMATOR — keeps us under Groq limit
# ══════════════════════════════════════════════════════════════════════════════

def estimate_tokens(text: str) -> int:
    """Rough token estimate: 1 token ~ 4 chars for English text."""
    return len(text) // 4


def cap_chunks_by_token_budget(doc_chunks: dict, token_budget: int = 9000) -> dict:
    """
    Trim doc_chunks so total context stays within token_budget.
    Preserves best chunks (already sorted by distance in retrieval).
    """
    capped     = defaultdict(list)
    used_tokens = 0

    for source, items in doc_chunks.items():
        for item in items:
            text   = item[0] if isinstance(item, tuple) else item
            tokens = estimate_tokens(text)
            if used_tokens + tokens > token_budget:
                break
            capped[source].append(item)
            used_tokens += tokens

    log.info(f"Token cap: {used_tokens} estimated tokens across {sum(len(v) for v in capped.values())} chunks")
    return capped


# ══════════════════════════════════════════════════════════════════════════════
# LLM CALL — with retry + error handling
# ══════════════════════════════════════════════════════════════════════════════

def groq_call(
    prompt: str,
    temperature: float = 0.0,
    max_tokens: int = GROQ_MAX_TOKENS,
    system: str | None = None
) -> str:
    messages = []
    if system:
        messages.append({"role": "system", "content": system})
    messages.append({"role": "user", "content": prompt})

    for attempt in range(1, GROQ_RETRIES + 1):
        try:
            response = client_ai.chat.completions.create(
                model=GROQ_MODEL,
                messages=messages,
                temperature=temperature,
                max_tokens=max_tokens,
            )
            return response.choices[0].message.content
        except Exception as e:
            log.warning(f"Groq attempt {attempt}/{GROQ_RETRIES} failed: {e}")
            if attempt < GROQ_RETRIES:
                time.sleep(GROQ_RETRY_WAIT)
            else:
                log.error("All Groq retries exhausted.")
                return "⚠️ The AI model is temporarily unavailable. Please try again in a moment."


# ══════════════════════════════════════════════════════════════════════════════
# INTENT DETECTORS
# ══════════════════════════════════════════════════════════════════════════════

def is_greeting(question: str) -> bool:
    greetings = [
        "hello", "hi", "hey", "good morning", "good evening",
        "good afternoon", "how are you", "what's up", "whats up",
        "who are you", "what can you do", "what are you",
    ]
    q = question.lower().strip()
    return any(q.startswith(g) or q == g for g in greetings)


def is_summary_request(question: str) -> bool:
    keywords = [
        "summarize", "summarise", "summary", "overview",
        "whole document", "entire document", "full document",
        "what is this document about", "what does this document cover",
        "give me a summary", "explain this document", "what is the document",
        "brief me", "brief about", "tldr", "tl;dr",
    ]
    q = question.lower()
    return any(kw in q for kw in keywords)


def is_comparison_request(question: str) -> bool:
    keywords = [
        "compare", "comparison", "difference between", "differences between",
        "contrast", "versus", "vs", "which is better", "similarities",
        "both documents", "across documents", "in both",
    ]
    q = question.lower()
    return any(kw in q for kw in keywords)


def is_list_request(question: str) -> bool:
    """Detects requests for enumeration — needs exhaustive retrieval."""
    keywords = [
        "list all", "list every", "list the", "what are all",
        "give me all", "show all", "enumerate", "what are the",
        "all the features", "all the steps", "all the points",
    ]
    q = question.lower()
    return any(kw in q for kw in keywords)


# ══════════════════════════════════════════════════════════════════════════════
# DOCUMENT TARGETING
# ══════════════════════════════════════════════════════════════════════════════

def detect_target_doc(question: str, all_sources: list[str]) -> str | None:
    q = question.lower().replace(" ", "").replace("_", "").replace("-", "")

    for source in all_sources:
        name       = os.path.splitext(source.lower())[0]
        name_clean = name.replace("_", "").replace("-", "").replace(" ", "")

        if name_clean in q or q in name_clean:
            return source

        words = name.replace("_", " ").replace("-", " ").split()
        for word in words:
            if len(word) > 5 and word in q:
                return source

    return None


# ══════════════════════════════════════════════════════════════════════════════
# STRATEGY SELECTION
# ══════════════════════════════════════════════════════════════════════════════

def get_doc_chunk_count(target_doc: str | None = None) -> int:
    try:
        if target_doc:
            results = get_collection().get(where={"source": target_doc})
        else:
            results = get_collection().get()
        return len(results["documents"])
    except Exception as e:
        log.warning(f"Could not count chunks: {e}")
        return 0


def detect_strategy(chunk_count: int) -> str:
    if chunk_count <= DEEP_READ_LIMIT:
        return "deep_read"
    elif chunk_count <= STANDARD_RAG_LIMIT:
        return "standard_rag"
    elif chunk_count <= EXPANDED_RAG_LIMIT:
        return "query_expansion"
    else:
        return "hierarchical"


# ══════════════════════════════════════════════════════════════════════════════
# SHARED PROMPT BUILDER — optimized for maximum detail extraction
# ══════════════════════════════════════════════════════════════════════════════

def build_rag_prompt(question: str, context: str, doc_list_str: str) -> str:
    return f"""You are MultiDoc AI — an expert document analyst. Your job is to extract and present EVERY relevant detail from the retrieved content below.

Uploaded documents:
{doc_list_str}

Retrieved document content:
{context}

User question: {question}

STRICT INSTRUCTIONS:
- Answer ONLY using the retrieved content above. Do NOT use outside knowledge.
- Extract EVERY fact, number, date, name, statistic, step, or detail relevant to the question — do not skip anything.
- If the answer spans multiple sections or documents, cover ALL of them completely.
- Structure your answer clearly:
  • Use ## for major sections
  • Use ### for subsections
  • Use bullet points for lists of items, steps, or features
  • Use **bold** for key terms, names, and important values
- Always cite the source: 📄 **[filename]**
- If information appears in multiple places in the document, combine and present it all.
- If the answer is not in the retrieved content, say exactly: "This information was not found in the uploaded documents."
- Do NOT summarize or shorten — give the complete, detailed answer.
- Do NOT fabricate, infer, or add anything not explicitly written in the content.

Answer:"""


def build_context(doc_chunks: dict, cap: int | None = None) -> tuple[str, list[str]]:
    context_parts  = []
    unique_sources = []

    for source, items in doc_chunks.items():
        label = get_file_label(source)
        texts = []
        for item in items:
            text = item[0] if isinstance(item, tuple) else item
            texts.append(text)
        if cap:
            texts = texts[:cap]
        context_parts.append(f"{label}: {source}\n" + "\n\n---\n\n".join(texts))

        # Only count as a real source if it contributed 3+ chunks
        if len(texts) >= 3:
            unique_sources.append(source)

    # Fallback — if nothing hit 3 chunks, show the top contributor
    if not unique_sources and doc_chunks:
        top_source = max(doc_chunks.items(), key=lambda x: len(x[1]))[0]
        unique_sources.append(top_source)

    return "\n\n====\n\n".join(context_parts), unique_sources


# ══════════════════════════════════════════════════════════════════════════════
# RETRIEVAL STRATEGIES
# ══════════════════════════════════════════════════════════════════════════════

def deep_read(question: str, target_doc: str | None = None) -> tuple[str, list[str]]:
    """
    Read ALL chunks — best for small docs (<=80 chunks).
    Token-capped to stay within Groq free tier limit.
    """
    all_data = get_collection().get(include=["documents", "metadatas"])

    doc_chunks = defaultdict(list)

    for chunk, meta in zip(all_data["documents"], all_data["metadatas"]):
        source = meta.get("source", "Unknown")
        if target_doc:
            if target_doc.lower() in source.lower():
                doc_chunks[source].append(chunk)
        else:
            doc_chunks[source].append(chunk)

    if not doc_chunks:
        return "No document content found.", []

    # Apply per-doc cap then token budget
    capped = {src: chunks[:CHUNKS_PER_DOC["deep_read"]] for src, chunks in doc_chunks.items()}
    capped = cap_chunks_by_token_budget(capped)

    context, unique_sources = build_context(capped)
    doc_list_str = "\n".join(f"- {get_file_label(s)} → {s}" for s in unique_sources)
    prompt       = build_rag_prompt(question, context, doc_list_str)

    return groq_call(prompt), unique_sources


def standard_rag(
    question: str,
    query_embedding: list,
    selected_doc: str,
    all_sources: list[str],
) -> tuple[str, list[str]]:
    """
    Single embedding query, chunks sorted by distance, token-capped.
    Best for: medium docs (80-600 chunks).
    """
    cap          = CHUNKS_PER_DOC["standard_rag"]
    where_filter = {"source": selected_doc} if selected_doc and selected_doc != "all" else None

    results = get_collection().query(
        query_embeddings=[query_embedding],
        n_results=FETCH_CANDIDATES,
        include=["documents", "metadatas", "distances"],
        **({"where": where_filter} if where_filter else {}),
    )

    # Collect all passing chunks with distance
    candidates = []
    for chunk, meta, dist in zip(
        results["documents"][0], results["metadatas"][0], results["distances"][0]
    ):
        if dist < RELEVANCE_THRESHOLD:
            candidates.append((chunk, meta.get("source", "Unknown"), dist))

    # Sort by distance — best chunks first
    candidates.sort(key=lambda x: x[2])

    # Group by source with cap
    doc_chunks    = defaultdict(list)
    best_distance = 999
    for chunk, source, dist in candidates:
        if len(doc_chunks[source]) < cap:
            doc_chunks[source].append((chunk, dist))
            best_distance = min(best_distance, dist)

    if not doc_chunks:
        log.info("standard_rag: no chunks passed relevance threshold — relaxing and retrying")
        return _retry_with_relaxed_threshold(question, query_embedding, selected_doc)

    # Token budget cap
    doc_chunks = cap_chunks_by_token_budget(doc_chunks)

    context, unique_sources = build_context(doc_chunks)
    doc_list_str = "\n".join(f"- {get_file_label(s)} → {s}" for s in unique_sources)
    prompt       = build_rag_prompt(question, context, doc_list_str)
    answer       = groq_call(prompt)
    sources      = unique_sources if best_distance < RELEVANCE_THRESHOLD else []

    return answer, sources


def query_expansion_rag(
    question: str,
    query_embedding: list,
    selected_doc: str,
    all_sources: list[str],
) -> tuple[str, list[str]]:
    """
    3 query variants + original → merged, deduped, sorted, token-capped.
    Best for: large docs (600-3000 chunks).
    """
    cap = CHUNKS_PER_DOC["query_expansion"]

    expanded_text = groq_call(
        f"""Generate 3 different search queries to find information about this question in a document.
Return ONLY the 3 queries, one per line, no numbering, no extra text.
Original question: {question}
3 search queries:""",
        temperature=0.3,
        max_tokens=150,
    )
    variants = [question] + [
        q.strip() for q in expanded_text.strip().split("\n") if q.strip()
    ][:3]

    seen_chunks    = set()
    all_candidates = []
    where_filter   = {"source": selected_doc} if selected_doc and selected_doc != "all" else None

    for variant in variants:
        q_emb = embedder.encode(variant).tolist()
        results = get_collection().query(
            query_embeddings=[q_emb],
            n_results=50,
            include=["documents", "metadatas", "distances"],
            **({"where": where_filter} if where_filter else {}),
        )
        for chunk, meta, dist in zip(
            results["documents"][0], results["metadatas"][0], results["distances"][0]
        ):
            # Better dedup — full chunk fingerprint
            chunk_fp = hash(chunk)
            if chunk_fp not in seen_chunks and dist < RELEVANCE_THRESHOLD:
                all_candidates.append((chunk, meta.get("source", "Unknown"), dist))
                seen_chunks.add(chunk_fp)

    if not all_candidates:
        log.info("query_expansion_rag: no chunks passed threshold")
        return _no_relevant_content_response(question), []

    # Sort by distance — best first
    all_candidates.sort(key=lambda x: x[2])

    # Group by source with cap
    doc_chunks    = defaultdict(list)
    best_distance = 999
    for chunk, source, dist in all_candidates:
        if len(doc_chunks[source]) < cap:
            doc_chunks[source].append((chunk, dist))
            best_distance = min(best_distance, dist)

    # Token budget cap
    doc_chunks = cap_chunks_by_token_budget(doc_chunks)

    context, unique_sources = build_context(doc_chunks)
    doc_list_str = "\n".join(f"- {get_file_label(s)} → {s}" for s in unique_sources)
    prompt       = build_rag_prompt(question, context, doc_list_str)
    answer       = groq_call(prompt)
    sources      = unique_sources if best_distance < RELEVANCE_THRESHOLD else []

    return answer, sources


def hierarchical_rag(
    question: str,
    query_embedding: list,
    selected_doc: str,
    all_sources: list[str],
) -> tuple[str, list[str]]:
    """
    Two-pass: first pass broad, second pass subtopic-targeted.
    Best for: very large docs (>3000 chunks).
    """
    cap          = CHUNKS_PER_DOC["hierarchical"]
    where_filter = {"source": selected_doc} if selected_doc and selected_doc != "all" else None

    # First pass
    results = get_collection().query(
        query_embeddings=[query_embedding],
        n_results=FETCH_CANDIDATES,
        include=["documents", "metadatas", "distances"],
        **({"where": where_filter} if where_filter else {}),
    )

    doc_chunks = defaultdict(list)
    for chunk, meta, dist in zip(
        results["documents"][0], results["metadatas"][0], results["distances"][0]
    ):
        source = meta.get("source", "Unknown")
        if dist < RELEVANCE_THRESHOLD and len(doc_chunks[source]) < cap:
            doc_chunks[source].append((chunk, dist))

    # Build preview
    top_chunks_preview = ""
    if doc_chunks:
        first_source       = list(doc_chunks.keys())[0]
        top_chunks_preview = "\n\n".join(
            chunk for chunk, _ in doc_chunks[first_source][:5]
        )

    # Second pass — subtopic expansion
    if top_chunks_preview:
        subtopics_text = groq_call(
            f"""Based on this excerpt and question, identify 2 specific sub-topics to search for.
Return ONLY 2 sub-topics, one per line, no numbering.
Excerpt: {top_chunks_preview[:1000]}
Question: {question}
Sub-topics:""",
            temperature=0.3,
            max_tokens=80,
        )

        seen_chunks = set()
        for subtopic in subtopics_text.strip().split("\n")[:2]:
            sub_emb = embedder.encode(subtopic.strip()).tolist()
            sub_res = get_collection().query(
                query_embeddings=[sub_emb],
                n_results=20,
                include=["documents", "metadatas", "distances"],
            )
            for chunk, meta, dist in zip(
                sub_res["documents"][0], sub_res["metadatas"][0], sub_res["distances"][0]
            ):
                source   = meta.get("source", "Unknown")
                chunk_fp = hash(chunk)
                if chunk_fp not in seen_chunks and dist < RELEVANCE_THRESHOLD:
                    if len(doc_chunks[source]) < cap + 10:
                        doc_chunks[source].append((chunk, dist))
                        seen_chunks.add(chunk_fp)

    if not doc_chunks:
        log.info("hierarchical_rag: no chunks passed threshold")
        return _no_relevant_content_response(question), []

    # Token budget cap
    doc_chunks = cap_chunks_by_token_budget(doc_chunks)

    context, unique_sources = build_context(doc_chunks)
    doc_list_str  = "\n".join(f"- {get_file_label(s)} → {s}" for s in unique_sources)
    prompt        = build_rag_prompt(question, context, doc_list_str)
    answer        = groq_call(prompt)
    best_distance = min(
        min(d for _, d in pairs) for pairs in doc_chunks.values() if pairs
    )
    sources = unique_sources if best_distance < RELEVANCE_THRESHOLD else []

    return answer, sources


def cross_doc_comparison(
    question: str,
    query_embedding: list,
    all_sources: list[str],
) -> tuple[str, list[str]]:
    """Force equal retrieval from all docs for comparison queries."""
    cap        = 12
    doc_chunks = defaultdict(list)

    for source in all_sources:
        results = get_collection().query(
            query_embeddings=[query_embedding],
            n_results=30,
            include=["documents", "metadatas", "distances"],
            where={"source": source},
        )
        for chunk, meta, dist in zip(
            results["documents"][0], results["metadatas"][0], results["distances"][0]
        ):
            if dist < RELEVANCE_THRESHOLD and len(doc_chunks[source]) < cap:
                doc_chunks[source].append((chunk, dist))

    if not doc_chunks:
        return _no_relevant_content_response(question), []

    # Token budget cap
    doc_chunks = cap_chunks_by_token_budget(doc_chunks)

    context, unique_sources = build_context(doc_chunks)
    doc_list_str = "\n".join(f"- {get_file_label(s)} → {s}" for s in unique_sources)

    prompt = f"""You are MultiDoc AI — an expert document analyst performing a cross-document comparison.

Uploaded documents:
{doc_list_str}

Retrieved document content:
{context}

User question: {question}

STRICT INSTRUCTIONS:
- Compare the documents ONLY using the retrieved content above
- Structure: one ## section per document with ALL relevant details from that doc
- Then a ## Key Differences section with a clear side-by-side breakdown
- Then a ## Similarities section if applicable
- Cite each source clearly: 📄 **[filename]**
- Include every fact, number, date — do not skip details
- Do NOT use outside knowledge

Comparison Answer:"""

    return groq_call(prompt), unique_sources


# ══════════════════════════════════════════════════════════════════════════════
# SUMMARY HANDLER — rolling window approach
# ══════════════════════════════════════════════════════════════════════════════

def handle_summary(
    question: str,
    target_doc: str | None,
    strategy: str,
) -> dict:
    """
    Rolling window summary — splits doc into batches, summarizes each,
    then combines into final summary. Covers more content within token limit.
    """
    all_data   = get_collection().get(include=["documents", "metadatas"])
    doc_chunks = defaultdict(list)

    for chunk, meta in zip(all_data["documents"], all_data["metadatas"]):
        source = meta.get("source", "Unknown")
        if target_doc:
            if target_doc.lower() in source.lower():
                doc_chunks[source].append(chunk)
        else:
            doc_chunks[source].append(chunk)

    if not doc_chunks:
        return {"answer": "No document content found.", "sources": []}

    all_partial_summaries = []
    unique_sources        = list(doc_chunks.keys())

    for source, chunks in doc_chunks.items():
        label = get_file_label(source)
        # Split into batches of 20 chunks each
        batch_size    = 20
        batches       = [chunks[i:i+batch_size] for i in range(0, len(chunks), batch_size)]
        # Cap to 2 batches max to stay within token limit
        batches       = batches[:2]
        batch_summaries = []

        for batch_num, batch in enumerate(batches, 1):
            batch_text = "\n\n---\n\n".join(batch)
            tokens     = estimate_tokens(batch_text)
            if tokens > 7000:
                # Trim batch text if too large
                batch_text = batch_text[:28000]

            partial = groq_call(
                f"""You are summarizing part {batch_num} of {len(batches)} of the document: {source}

Extract and list ALL key points, facts, numbers, names, dates from this section.
Be exhaustive — do not skip any detail. Use bullet points.

Content:
{batch_text}

Key points from this section:""",
                temperature=0.0,
                max_tokens=1500,
            )
            batch_summaries.append(f"**Section {batch_num}:**\n{partial}")

        all_partial_summaries.append(
            f"📄 **{source}**\n\n" + "\n\n".join(batch_summaries)
        )

    # Combine partial summaries into final
    combined = "\n\n====\n\n".join(all_partial_summaries)
    tokens   = estimate_tokens(combined)
    if tokens > 7000:
        combined = combined[:28000]

    final_answer = groq_call(
        f"""You are an expert document analyst. Based on the extracted key points below, 
produce a comprehensive, well-structured final summary.

RULES:
- Cover ALL sections and topics mentioned in the key points
- Use ## for major sections, ### for subsections, bullet points for details  
- Include all statistics, numbers, dates, names
- End with ## Key Takeaways (the 5 most important points)
- Cite source: 📄 **[filename]**
- Do NOT add outside knowledge

Extracted key points:
{combined}

Comprehensive Final Summary:""",
        temperature=0.0,
        max_tokens=3000,
    )

    return {"answer": final_answer, "sources": unique_sources}


# ══════════════════════════════════════════════════════════════════════════════
# FALLBACK HANDLERS
# ══════════════════════════════════════════════════════════════════════════════

def _retry_with_relaxed_threshold(
    question: str,
    query_embedding: list,
    selected_doc: str,
) -> tuple[str, list[str]]:
    """
    Called when standard_rag finds nothing — relaxes threshold to 2.5 and retries once.
    Better than immediately falling to general knowledge.
    """
    log.info("Retrying with relaxed threshold 2.5")
    where_filter = {"source": selected_doc} if selected_doc and selected_doc != "all" else None

    results = get_collection().query(
        query_embeddings=[query_embedding],
        n_results=FETCH_CANDIDATES,
        include=["documents", "metadatas", "distances"],
        **({"where": where_filter} if where_filter else {}),
    )

    doc_chunks = defaultdict(list)
    for chunk, meta, dist in zip(
        results["documents"][0], results["metadatas"][0], results["distances"][0]
    ):
        source = meta.get("source", "Unknown")
        if dist < 2.5 and len(doc_chunks[source]) < 30:
            doc_chunks[source].append((chunk, dist))

    if not doc_chunks:
        return _no_relevant_content_response(question), []

    doc_chunks = cap_chunks_by_token_budget(doc_chunks)
    context, unique_sources = build_context(doc_chunks)
    doc_list_str = "\n".join(f"- {get_file_label(s)} → {s}" for s in unique_sources)
    prompt       = build_rag_prompt(question, context, doc_list_str)

    return groq_call(prompt), unique_sources


def _no_relevant_content_response(question: str) -> str:
    answer = groq_call(
        f"""You are MultiDoc AI. Answer this question using your general knowledge.
Be helpful, clear, and use markdown formatting.
Question: {question}""",
        temperature=0.7,
        max_tokens=2048,
    )
    return f"ℹ️ *No relevant content found in the uploaded documents. Answering from general knowledge:*\n\n{answer}"


def answer_with_llm(question: str, note: str | None = None) -> dict:
    answer = groq_call(
        f"""You are MultiDoc AI — a smart helpful assistant.
Answer clearly using your own knowledge. Use markdown formatting.
Question: {question}""",
        temperature=0.7,
        max_tokens=2048,
    )
    if note:
        answer = f"{note}\n\n{answer}"
    return {"answer": answer, "sources": []}


# ══════════════════════════════════════════════════════════════════════════════
# MAIN ENTRY POINT
# ══════════════════════════════════════════════════════════════════════════════

def answer_question(user_question: str, selected_doc: str = "all") -> dict:
    user_question = user_question.strip()
    if not selected_doc or selected_doc.strip() == "":
        selected_doc = "all"

    # Greetings
    if is_greeting(user_question):
        return {
            "answer": groq_call(
                """You are MultiDoc AI — a friendly, helpful document assistant.
Greet the user warmly. Tell them they can upload documents (PDF, Word, TXT, CSV, Excel, PowerPoint, Markdown)
and ask any questions about them. Keep it to 2-3 sentences. Be enthusiastic but concise.""",
                temperature=0.7,
                max_tokens=200,
            ),
            "sources": [],
        }

    # Check docs exist
    try:
        all_data = get_collection().get(include=["metadatas"])
        all_sources = list(set(m.get("source", "Unknown") for m in all_data["metadatas"]))
        has_docs    = len(all_sources) > 0
    except Exception as e:
        log.warning(f"Could not fetch collection metadata: {e}")
        all_sources = []
        has_docs    = False

    if not has_docs:
        return answer_with_llm(
            user_question,
            note="💡 *No documents uploaded yet — answering from general knowledge:*",
        )

    # Determine target document
    if selected_doc and selected_doc != "all":
        target_doc = selected_doc
    else:
        target_doc = detect_target_doc(user_question, all_sources)

    # Strategy selection
    chunk_count = get_doc_chunk_count(target_doc if target_doc else None)
    strategy    = detect_strategy(chunk_count)
    log.info(f"Chunks: {chunk_count} | Strategy: {strategy.upper()} | Doc: {target_doc or 'ALL'}")

    # Summary request
    if is_summary_request(user_question):
        log.info("→ SUMMARY handler (rolling window)")
        return handle_summary(user_question, target_doc, strategy)

    # Comparison request
    if is_comparison_request(user_question) and len(all_sources) > 1:
        log.info("→ CROSS-DOC COMPARISON")
        answer, sources = cross_doc_comparison(
            user_question, embedder.encode(user_question).tolist(), all_sources
        )
        return {"answer": answer, "sources": sources}

    # Deep read
    if strategy == "deep_read":
        log.info("→ DEEP READ")
        answer, sources = deep_read(user_question, target_doc)
        return {"answer": answer, "sources": sources}

    # Embedding for remaining strategies
    question_embedding = embedder.encode(user_question).tolist()

    if strategy == "standard_rag":
        log.info("→ STANDARD RAG")
        answer, sources = standard_rag(user_question, question_embedding, selected_doc, all_sources)

    elif strategy == "query_expansion":
        log.info("→ QUERY EXPANSION RAG")
        answer, sources = query_expansion_rag(user_question, question_embedding, selected_doc, all_sources)

    else:
        log.info("→ HIERARCHICAL RAG")
        answer, sources = hierarchical_rag(user_question, question_embedding, selected_doc, all_sources)

    return {"answer": answer, "sources": sources}


# ══════════════════════════════════════════════════════════════════════════════
# CLI TEST MODE
# ══════════════════════════════════════════════════════════════════════════════

if __name__ == "__main__":
    print("MultiDoc AI — RAG Engine (CLI mode)")
    print("Type 'exit' to quit.\n")
    while True:
        question = input("You: ").strip()
        if question.lower() in ("exit", "quit"):
            break
        if not question:
            continue
        result = answer_question(question)
        print(f"\nAnswer:\n{result['answer']}")
        if result["sources"]:
            print(f"\nSources: {', '.join(result['sources'])}")
        print("\n" + "─" * 60 + "\n")