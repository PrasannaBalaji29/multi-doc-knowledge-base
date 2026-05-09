import faiss
import numpy as np
from sentence_transformers import SentenceTransformer
import chromadb
import time

embedder = SentenceTransformer('all-MiniLM-L6-v2')

# Load from ChromaDB first to get all chunks
chroma_client = chromadb.PersistentClient(path="./chroma_db")
collection = chroma_client.get_collection("langchain")

# Get all stored chunks
all_data = collection.get()
chunks = all_data['documents']
metadatas = all_data['metadatas']

print(f"✅ Loaded {len(chunks)} chunks from ChromaDB")

# Build FAISS index from those chunks
embeddings = embedder.encode(chunks)
dim = embeddings.shape[1]
index = faiss.IndexFlatL2(dim)
index.add(np.array(embeddings))

print(f"✅ FAISS index built with {index.ntotal} vectors")

def search_faiss(question, k=5):
    start = time.time()
    q_embed = embedder.encode([question])
    D, I = index.search(np.array(q_embed), k)
    elapsed = (time.time() - start) * 1000
    results = [chunks[i] for i in I[0]]
    print(f"⚡ FAISS retrieval time: {elapsed:.2f}ms")
    return results

def search_chroma(question, k=5):
    start = time.time()
    q_embed = embedder.encode(question).tolist()
    results = collection.query(query_embeddings=[q_embed], n_results=k)
    elapsed = (time.time() - start) * 1000
    print(f"🗃️ ChromaDB retrieval time: {elapsed:.2f}ms")
    return results['documents'][0]

if __name__ == "__main__":
    question = input("Enter question to benchmark: ")
    print("\n--- BENCHMARK RESULTS ---")
    faiss_results = search_faiss(question)
    chroma_results = search_chroma(question)
    print("\n✅ Both retrievals complete!")