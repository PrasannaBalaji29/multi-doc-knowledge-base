import psycopg2
import psycopg2.extras
from dotenv import load_dotenv
import os

load_dotenv()

try:
    conn = psycopg2.connect(
        host=os.getenv("DB_HOST"),
        user=os.getenv("DB_USER"),
        password=os.getenv("DB_PASSWORD"),
        dbname=os.getenv("DB_NAME"),
        port=os.getenv("DB_PORT", "5432"),
        cursor_factory=psycopg2.extras.RealDictCursor
    )
    print("✅ Connected!")

    with conn.cursor() as cursor:
        cursor.execute(
            "INSERT INTO chat_history (session_id, question, answer, sources, title) VALUES (%s, %s, %s, %s, %s)",
            ("test-session", "test question", "test answer", "[]", "Test Title")
        )
    conn.commit()
    print("✅ Insert successful!")

    with conn.cursor() as cursor:
        cursor.execute("SELECT * FROM chat_history")
        rows = cursor.fetchall()
        print(f"✅ Rows now: {len(rows)}")
        for row in rows:
            print(row)

    conn.close()
except Exception as e:
    print(f"❌ Error: {e}")