from flask import Flask, request, jsonify
from werkzeug.utils import secure_filename
import pymysql
import os
import uuid
from dotenv import load_dotenv
from query import answer_question

load_dotenv()

app = Flask(__name__)

# ── MySQL connection ─────────────────────────────────────────────
def get_db():
    return pymysql.connect(
        host=os.getenv("MYSQL_HOST", "localhost"),
        user=os.getenv("MYSQL_USER", "root"),
        password=os.getenv("MYSQL_PASSWORD", ""),
        database=os.getenv("MYSQL_DB", "rag_db"),
        cursorclass=pymysql.cursors.DictCursor
    )

# ── 1. POST /upload ──────────────────────────────────────────────
@app.route("/upload", methods=["POST"])
def upload():
    if "file" not in request.files:
        return jsonify({"error": "No file provided"}), 400

    file = request.files["file"]
    filename = secure_filename(file.filename)
    os.makedirs("docs", exist_ok=True)
    filepath = os.path.join("docs", filename)
    file.save(filepath)

    # Re-ingest the entire docs folder
    from ingest import main as ingest_main
    ingest_main()

    return jsonify({"message": f"{filename} uploaded and indexed successfully"}), 200

# ── 2. POST /query ───────────────────────────────────────────────
@app.route("/query", methods=["POST"])
def query():
    data = request.get_json()
    question = data.get("question")
    session_id = data.get("session_id", str(uuid.uuid4()))

    if not question:
        return jsonify({"error": "No question provided"}), 400

    result = answer_question(question)
    answer = result.get("answer", "")
    sources = str(result.get("sources", []))

    # Save to MySQL
    conn = get_db()
    try:
        with conn.cursor() as cursor:
            cursor.execute(
                "INSERT INTO chat_history (session_id, question, answer, sources) VALUES (%s, %s, %s, %s)",
                (session_id, question, answer, sources)
            )
        conn.commit()
    finally:
        conn.close()

    return jsonify({
        "session_id": session_id,
        "question": question,
        "answer": answer,
        "sources": sources
    }), 200

# ── 3. GET /history ──────────────────────────────────────────────
@app.route("/history", methods=["GET"])
def history():
    session_id = request.args.get("session_id")
    conn = get_db()
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

# ── 4. DELETE /clear ─────────────────────────────────────────────
@app.route("/clear", methods=["DELETE"])
def clear():
    session_id = request.args.get("session_id")
    conn = get_db()
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

# ── Run ──────────────────────────────────────────────────────────
if __name__ == "__main__":
    app.run(debug=True, port=5000)