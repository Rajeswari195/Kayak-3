```python
import pymysql
import sys
import os

def debug_db():
    print("--- Debugging DB State ---")
    
    conn = pymysql.connect(
        host=os.getenv('MYSQL_HOST', 'localhost'),
        user=os.getenv('MYSQL_USER', 'kayak_user'),
        password=os.getenv('MYSQL_PASSWORD', 'kayak_pass'),
        database=os.getenv('MYSQL_DATABASE', 'kayak_core'),
        port=int(os.getenv('MYSQL_PORT', '3306')),
        cursorclass=pymysql.cursors.DictCursor
    )
    
    try:
        with conn.cursor() as cursor:
            # 1. Check Users
            print("\n1. USERS (akshay.menon@usa.com):")
            cursor.execute("SELECT id, email, first_name, last_name FROM users WHERE email = 'akshay.menon@usa.com'")
            users = cursor.fetchall()
            for u in users:
                print(f"   found: {u}")
                
            if not users:
                print("   ❌ No user found with that email!")

            # 2. Check Recent Bookings (Last 1 hour)
            print("\n2. RECENT BOOKINGS (All users, last 1 hour):")
            cursor.execute("""
                SELECT id, user_id, booking_reference, status, created_at 
                FROM bookings 
                ORDER BY created_at DESC LIMIT 5
            """)
            bookings = cursor.fetchall()
            for b in bookings:
                print(f"   Booking: Ref={b['booking_reference']} | Status={b['status']} | UserID={b['user_id']}")
                
    except Exception as e:
        print(f"❌ Error: {e}")
    finally:
        conn.close()

if __name__ == "__main__":
    debug_db()
