from app.agents.concierge_agent import ConciergeAgent
from app.database import engine
from sqlmodel import Session, text

def test_booking_date():
    print("--- Testing Booking Date Fix ---")
    agent = ConciergeAgent()
    
    # Mock Flight Data with a specific FUTURE date
    flight_data = {
        "id": 999,
        "price": 500.0,
        "departure_time": "2025-12-25", # The target date
        "airline": "Test Air",
        "destination": "Test City",
        "type": "Flight"
    }
    
    # Call book_flight (using demo token trigger)
    # We bypass the full process_message and call book_flight directly for isolation
    print(f"Booking Flight for Date: {flight_data['departure_time']}")
    res = agent.book_flight(flight_data, auth_token="demo-token")
    booking_id = res['id']
    print(f"Booking ID: {booking_id}")
    
    # Verify DB (MySQL)
    import pymysql
    import os
    
    conn = None # Initialize conn to None
    try:
        conn = pymysql.connect(
            host=os.getenv('MYSQL_HOST', 'localhost'),
            user=os.getenv('MYSQL_USER', 'kayak_user'),
            password=os.getenv('MYSQL_PASSWORD', 'kayak_pass'),
            database=os.getenv('MYSQL_DATABASE', 'kayak_core'),
            port=int(os.getenv('MYSQL_PORT', '3306')),
            cursorclass=pymysql.cursors.DictCursor
        )  
        with conn.cursor() as cursor:
            # Check Booking Table
            sql = "SELECT start_date, end_date FROM bookings WHERE id = %s"
            cursor.execute(sql, (booking_id,))
            rec = cursor.fetchone()
            
            print(f"DB Record: Start={rec['start_date']} End={rec['end_date']}")
            
            # Check date string match (MySQL returns generic date obj or string)
            if str(rec['start_date']) == "2025-12-25":
                print("✅ PASSED: Booking start_date matches Flight Date.")
            else:
                print(f"❌ FAILED: Start date is {rec['start_date']}, expected 2025-12-25.")
    finally:
        conn.close()

if __name__ == "__main__":
    test_booking_date()
