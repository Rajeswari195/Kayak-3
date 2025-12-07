from app.agents.concierge_agent import ConciergeAgent
from app.database import engine
from sqlmodel import Session, text
import pymysql

def test_hotel_booking_date():
    print("--- Testing Hotel Booking Date Fix ---")
    agent = ConciergeAgent()
    
    # Mock Hotel Data with a specific date
    hotel_data = {
        "id": "mock_h_999",
        "price": 150.0,
        "date": "2025-12-25", # The injected target date
        "destination": "Test Hotel City",
        "type": "Hotel"
    }
    
    print(f"Booking Hotel for Date: {hotel_data['date']}")
    try:
        res = agent.book_hotel(hotel_data, auth_token="demo-token")
        booking_id = res['id']
        print(f"Booking ID: {booking_id}")
        
        # Verify DB (MySQL)
        conn = pymysql.connect(
            host='localhost',
            user='kayak_user',
            password='kayak_pass',
            database='kayak_core',
            port=3306,
            cursorclass=pymysql.cursors.DictCursor
        )
        
        with conn.cursor() as cursor:
            # Check Booking Table
            sql = "SELECT start_date, end_date FROM bookings WHERE id = %s"
            cursor.execute(sql, (booking_id,))
            rec = cursor.fetchone()
            
            print(f"DB Record: Start={rec['start_date']} End={rec['end_date']}")
            
            if str(rec['start_date']) == "2025-12-25":
                print("✅ PASSED: Hotel Booking start_date matches Request Date.")
            else:
                print(f"❌ FAILED: Start date is {rec['start_date']}, expected 2025-12-25.")
        conn.close()
        
    except Exception as e:
        print(f"❌ ERROR: {e}")

if __name__ == "__main__":
    test_hotel_booking_date()
