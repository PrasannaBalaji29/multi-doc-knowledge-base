import os
from dotenv import load_dotenv
from langchain_community.document_loaders import PyMuPDFLoader, TextLoader, Docx2txtLoader
from langchain_text_splitters import RecursiveCharacterTextSplitter
from langchain_community.embeddings import HuggingFaceEmbeddings
from langchain_community.vectorstores import Chroma

load_dotenv()

DOCS_DIR = "docs"
CHROMA_DIR = "chroma_db"

def load_documents(folder):
    docs = []
    for file in os.listdir(folder):
        path = os.path.join(folder, file)
        if file.endswith(".pdf"):
            loader = PyMuPDFLoader(path)
        elif file.endswith(".txt"):
            loader = TextLoader(path)
        elif file.endswith(".docx"):
            loader = Docx2txtLoader(path)
        else:
            continue
        docs.extend(loader.load())
    return docs

def main():
    print("📄 Loading documents...")
    documents = load_documents(DOCS_DIR)
    print(f"   Loaded {len(documents)} pages")

    print("✂️  Chunking...")
    splitter = RecursiveCharacterTextSplitter(
        chunk_size=500,
        chunk_overlap=50
    )
    chunks = splitter.split_documents(documents)
    print(f"   Created {len(chunks)} chunks")

    print("🔢 Embedding with sentence-transformers...")
    embeddings = HuggingFaceEmbeddings(
        model_name="all-MiniLM-L6-v2"
    )

    print("💾 Storing in ChromaDB...")
    vectorstore = Chroma.from_documents(
        documents=chunks,
        embedding=embeddings,
        persist_directory=CHROMA_DIR
    )
    print(f"✅ Done! {len(chunks)} chunks stored in ChromaDB.")

if __name__ == "__main__":
    main()