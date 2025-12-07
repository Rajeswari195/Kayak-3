import pymysql
import sys

DEMO_USER_EMAIL = "akshay.menon@usa.com"

def cleanup_bookings():
    print(f"--- Cleaning up bookings for {DEMO_USER_EMAIL} ---")
    
    conn = pymysql.connect(
        host='localhost',
        user='kayak_user',
        password='kayak_pass',
        database='kayak_core',
        port=3306,
        cursorclass=pymysql.cursors.DictCursor
    )
    
    try:
        with conn.cursor() as cursor:
            # 1. Get User ID
            cursor.execute("SELECT id FROM users WHERE email = %s", (DEMO_USER_EMAIL,))
            user = cursor.fetchone()
            
            if not user:
                print(f"❌ User {DEMO_USER_EMAIL} not found.")
                return
            
            user_id = user['id']
            print(f"✅ Found User ID: {user_id}")
            
            # 2. Find Bookings to delete
            cursor.execute("SELECT id FROM bookings WHERE user_id = %s", (user_id,))
            bookings = cursor.fetchall()
            booking_ids = [b['id'] for b in bookings]
            
            if not booking_ids:
                print("✅ No bookings found for this user.")
                return
            
            print(f"ℹ️ Found {len(booking_ids)} bookings. Deleting...")
            
            # 3. Delete Booking Items First (Foreign Key)
            format_strings = ','.join(['%s'] * len(booking_ids))
            cursor.execute(f"DELETE FROM booking_items WHERE booking_id IN ({format_strings})", tuple(booking_ids))
            print(f"   - Deleted associated booking_items")
            
            # 4. Delete Bookings
            cursor.execute("DELETE FROM bookings WHERE user_id = %s", (user_id,))
            print(f"   - Deleted {len(booking_ids)} bookings")
            
            conn.commit()
            print("✅ Cleanup Complete.")
            
    except Exception as e:
        print(f"❌ Error: {e}")
    finally:
        conn.close()

if __name__ == "__main__":
    cleanup_bookings()
