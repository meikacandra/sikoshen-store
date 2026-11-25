import os
from pathlib import Path
import mysql.connector
from mysql.connector import Error

DB_HOST = os.getenv("MYSQL_HOST", "127.0.0.1")
DB_PORT = int(os.getenv("MYSQL_PORT", "3306"))
DB_USER = os.getenv("MYSQL_USER", "root")
DB_PASSWORD = os.getenv("MYSQL_PASSWORD", "")
DB_NAME = os.getenv("MYSQL_DATABASE", "sikoshen_store")


def get_server_connection():
    """Koneksi ke server MySQL Laragon tanpa memilih database terlebih dahulu."""
    return mysql.connector.connect(
        host=DB_HOST,
        port=DB_PORT,
        user=DB_USER,
        password=DB_PASSWORD,
        autocommit=True,
    )


def get_db_connection():
    """Koneksi ke database sikoshen_store di MySQL Laragon."""
    return mysql.connector.connect(
        host=DB_HOST,
        port=DB_PORT,
        user=DB_USER,
        password=DB_PASSWORD,
        database=DB_NAME,
        autocommit=False,
    )


def init_schema():
    """Membuat database dan tabel dari schema.sql jika belum ada."""
    schema_path = Path(__file__).parent / "schema.sql"
    sql_script = schema_path.read_text(encoding="utf-8")
    conn = get_server_connection()
    try:
        cursor = conn.cursor()
        for statement in sql_script.split(";"):
            stmt = statement.strip()
            if stmt:
                cursor.execute(stmt)
        cursor.close()
    finally:
        conn.close()

