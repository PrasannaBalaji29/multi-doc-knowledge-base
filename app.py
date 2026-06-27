from flask import Flask, request, jsonify, Response
from flask_cors import CORS
from werkzeug.utils import secure_filename
import psycopg2
import psycopg2.extras
import os
import uuid
import datetime
import json
from dotenv import load_dotenv
from query import answer_question
from groq import Groq

load_dotenv()

client_title = Groq(api_key=os.getenv("GROQ_API_KEY"))

app = Flask(__name__)
CORS(app, origins=["https://multi-doc-knowledge-base.vercel.app", "https://multi-doc-knowledge-base-79cz54c0q-prasannabalaji29s-projects.vercel.app", "http://localhost:5173"])

ALLOWED_EXTENSIONS = {'.pdf', '.txt', '.docx', '.csv', '.xlsx', '.pptx', '.md'}

def get_db():
    database_url = os.getenv("DATABASE_URL")
    if database_url:
        return psycopg2.connect(database_url, cursor_factory=psycopg2.extras.RealDictCursor)
    return psycopg2.connect(
        host=os.getenv("DB_HOST"),
        user=os.getenv("DB_USER"),
        password=os.getenv("DB_PASSWORD"),
        dbname=os.getenv("DB_NAME"),
        port=os.getenv("DB_PORT", "5432"),
        cursor_factory=psycopg2.extras.RealDictCursor
    )

def generate_title(question):
    try:
        response = client_title.chat.completions.create(
            model="llama-3.3-70b-versatile",
            messages=[{"role": "user", "content": (
                "Generate a short 3-5 word title for this question. "
                "No quotes, no punctuation, title case only, just the title:\n\n"
                f"{question}"
            )}],
            temperature=0.3,
            max_tokens=20
        )
        return response.choices[0].message.content.strip()
    except Exception as e:
        print(f"Title generation error: {e}")
        return question[:40]

def _save_to_db(session_id, question, answer, sources):
    title = generate_title(question)
    try:
        conn = get_db()
        with conn.cursor() as cursor:
            cursor.execute(
                "INSERT INTO chat_history (session_id, question, answer, sources, title) "
                "VALUES (%s, %s, %s, %s, %s)",
                (session_id, question, answer, sources, title)
            )
        conn.commit()
        conn.close()
    except Exception as e:
        print(f"DB save error: {e}")

@app.route("/upload", methods=["POST"])
def upload():
    if "file" not in request.files:
        return jsonify({"error": "No file provided"}), 400

    file     = request.files["file"]
    filename = secure_filename(file.filename)
    ext      = os.path.splitext(filename)[1].lower()

    if ext not in ALLOWED_EXTENSIONS:
        return jsonify({
            "error": f"Unsupported file type '{ext}'. Allowed: PDF, TXT, DOCX, CSV, XLSX, PPTX, MD"
        }), 400

    os.makedirs("docs", exist_ok=True)
    save_path = os.path.join("docs", filename)
    file.save(save_path)
    print(f"📁 Saved: {filename}")

    try:
        from ingest import main as ingest_main
        ingest_main()
        return jsonify({"message": f"{filename} uploaded and indexed successfully"}), 200
    except Exception as e:
        print(f"Ingest error: {e}")
        return jsonify({"error": f"File saved but indexing failed: {str(e)}"}), 500


@app.route("/query", methods=["POST"])
def query():
    data         = request.get_json()
    question     = data.get("question", "").strip()
    session_id   = data.get("session_id", str(uuid.uuid4()))
    selected_doc = data.get("selected_doc", "all")
    history      = data.get("history", [])

    if not question:
        return jsonify({"error": "No question provided"}), 400

    result  = answer_question(question, selected_doc, history)
    answer  = result.get("answer", "")
    sources = json.dumps(result.get("sources", []))

    _save_to_db(session_id, question, answer, sources)

    return jsonify({
        "session_id": session_id,
        "question":   question,
        "answer":     answer,
        "sources":    result.get("sources", [])
    }), 200


@app.route("/stream", methods=["POST"])
def stream():
    data         = request.get_json()
    question     = data.get("question", "").strip()
    session_id   = data.get("session_id", str(uuid.uuid4()))
    selected_doc = data.get("selected_doc", "all")
    history      = data.get("history", [])

    if not question:
        return jsonify({"error": "No question provided"}), 400

    result  = answer_question(question, selected_doc, history)
    answer  = result.get("answer", "")
    sources = result.get("sources", [])

    _save_to_db(session_id, question, answer, json.dumps(sources))

    def generate():
        try:
            words = answer.split(" ")
            for i, word in enumerate(words):
                token = word + (" " if i < len(words) - 1 else "")
                yield f"data: {json.dumps({'token': token, 'sources': sources})}\n\n"
            yield f"data: {json.dumps({'done': True, 'sources': sources})}\n\n"
        except Exception as e:
            print(f"Stream error: {e}")
            yield f"data: {json.dumps({'error': str(e)})}\n\n"

    return Response(generate(), mimetype="text/event-stream")


@app.route("/history", methods=["GET"])
def history():
    session_id = request.args.get("session_id")
    conn       = get_db()
    try:
        with conn.cursor() as cursor:
            if session_id:
                cursor.execute(
                    "SELECT * FROM chat_history WHERE session_id=%s ORDER BY timestamp DESC",
                    (session_id,)
                )
            else:
                cursor.execute(
                    "SELECT * FROM chat_history ORDER BY timestamp DESC LIMIT 50"
                )
            rows = cursor.fetchall()
    finally:
        conn.close()
    return jsonify(rows), 200


@app.route("/clear", methods=["DELETE"])
def clear():
    session_id = request.args.get("session_id")
    conn       = get_db()
    try:
        with conn.cursor() as cursor:
            if session_id:
                cursor.execute(
                    "DELETE FROM chat_history WHERE session_id=%s", (session_id,)
                )
            else:
                cursor.execute("DELETE FROM chat_history")
        conn.commit()
    finally:
        conn.close()
    return jsonify({"message": "Chat history cleared"}), 200


@app.route("/docs", methods=["GET"])
def list_docs():
    docs_dir = "docs"
    if not os.path.exists(docs_dir):
        return jsonify({"docs": []})

    files = []
    for f in os.listdir(docs_dir):
        ext = os.path.splitext(f)[1].lower()
        if ext in ALLOWED_EXTENSIONS:
            path = os.path.join(docs_dir, f)
            size = os.path.getsize(path)
            files.append({
                "name": f,
                "size": f"{size / 1024:.0f} KB",
                "date": datetime.datetime.fromtimestamp(
                    os.path.getmtime(path)
                ).strftime("%b %d")
            })
    return jsonify({"docs": files})


@app.route("/delete-doc", methods=["DELETE"])
def delete_doc():
    filename = request.args.get("filename")
    if not filename:
        return jsonify({"error": "No filename provided"}), 400

    filepath = os.path.join("docs", filename)
    if os.path.exists(filepath):
        os.remove(filepath)
        print(f"🗑️  Deleted file: {filename}")

    try:
        import chromadb
        chroma_client = chromadb.PersistentClient(path="./chroma_db")
        col           = chroma_client.get_collection("knowledge_base")
        results       = col.get(where={"source": filename})
        if results["ids"]:
            col.delete(ids=results["ids"])
    except Exception as e:
        print(f"ChromaDB delete error: {e}")

    return jsonify({"message": f"{filename} deleted successfully"}), 200


if __name__ == "__main__":
    app.run(debug=True, port=5000)