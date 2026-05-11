from groq import Groq
import chromadb
from sentence_transformers import SentenceTransformer
import os
from dotenv import load_dotenv

load_dotenv()

client_ai = Groq(api_key=os.getenv("GROQ_API_KEY"))
embedder = SentenceTransformer('all-MiniLM-L6-v2')

chroma_client = chromadb.PersistentClient(path="./chroma_db")
collection = chroma_client.get_collection("langchain")

def answer_question(user_question):
    question_embedding = embedder.encode(user_question).tolist()

    results = collection.query(
        query_embeddings=[question_embedding],
        n_results=5
    )

    chunks = results['documents'][0]
    sources = results['metadatas'][0]

    context = "\n\n".join(chunks)
    prompt = f"""You are a strict assistant. You must ONLY use the context below to answer.
DO NOT use any outside knowledge. DO NOT make up information.
If the answer is not explicitly in the context, respond with ONLY: "The document does not contain this information."

Context:
{context}

Question: {user_question}

Answer (based ONLY on context above):"""

    response = client_ai.chat.completions.create(
        model="llama-3.3-70b-versatile",
        messages=[{"role": "user", "content": prompt}]
    )

    answer = response.choices[0].message.content

    print("\n🤖 Answer:", answer)
    print("\n📄 Sources used:")
    for i, src in enumerate(sources):
        print(f"  {i+1}. {src.get('source', 'Unknown')}")

    return {
        "answer": answer,
        "sources": [src.get('source', 'Unknown') for src in sources]
    }

if __name__ == "__main__":
    question = input("Ask your RAG system: ")
    answer_question(question)