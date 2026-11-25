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
        # Migrasi aman jika tabel sudah ada dari versi sebelumnya
        migrations = [
            ("sku_profiles", "fast_probability", "DOUBLE NULL"),
            ("sku_profiles", "predicted_next_month", "DOUBLE NULL"),
            ("sku_profiles", "rmse_sku", "DOUBLE NULL"),
            ("sku_profiles", "safety_stock", "INT NULL"),
            ("sku_profiles", "suggested_order", "INT NULL"),
            ("sku_profiles", "prediction_month", "CHAR(7) NULL"),
            ("model_metadata", "reg_metrics_json", "JSON NULL"),
        ]
        for table_name, col_name, col_def in migrations:
            cursor.execute(
                """
                SELECT COUNT(*) FROM INFORMATION_SCHEMA.COLUMNS
                WHERE TABLE_SCHEMA = %s AND TABLE_NAME = %s AND COLUMN_NAME = %s
                """,
                (DB_NAME, table_name, col_name),
            )
            if cursor.fetchone()[0] == 0:
                cursor.execute(f"ALTER TABLE {table_name} ADD COLUMN {col_name} {col_def}")
        cursor.close()
    finally:
        conn.close()

