#!/usr/bin/env python3
"""
Clear ALL test data from databases.
"""

import pymysql
from sqlmodel import Session
from app.database import engine
from app.models import Flight, Listing, Watch, Deal

def clear_sqlite():
    print("🗑️ Clearing SQLite (ai-service)...")
    from sqlalchemy import text
    with Session(engine) as session:
        # Delete all data
        session.execute(text("DELETE FROM flight"))
        session.execute(text("DELETE FROM listing"))
        session.execute(text("DELETE FROM watch"))
        try:
            session.execute(text("DELETE FROM deal"))
        except:
            pass # Table may not exist
        session.commit()
    print("   ✅ SQLite cleared")

def clear_mysql():
    print("🗑️ Clearing MySQL (core-api)...")
    try:
        conn = pymysql.connect(
            host='localhost',
            user='kayak_user',
            password='kayak_pass',
            database='kayak_core',
            port=3306
        )
        with conn.cursor() as cursor:
            # Clear booking items first (FK)
            cursor.execute("DELETE FROM booking_items")
            # Clear bookings
            cursor.execute("DELETE FROM bookings")
            # Optionally clear synced entities
            cursor.execute("DELETE FROM flights WHERE id LIKE 'sync-%' OR airline = 'UnityAir'")
            cursor.execute("DELETE FROM hotels WHERE name LIKE 'Hotel in %'")
            conn.commit()
        conn.close()
        print("   ✅ MySQL cleared (bookings, booking_items)")
    except Exception as e:
        print(f"   ⚠️ MySQL clear failed: {e}")

if __name__ == "__main__":
    print("\n" + "="*50)
    print("🧹 DATABASE CLEANUP")
    print("="*50 + "\n")
    
    clear_sqlite()
    clear_mysql()
    
    print("\n✅ All databases cleared!")
    print("   Run data ingestion again: python -c 'from app.services.data_ingestion import ingest_data; ingest_data()'")
