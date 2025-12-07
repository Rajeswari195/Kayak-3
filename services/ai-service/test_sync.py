
import pymysql
import uuid
import sys

def test_sync():
    print("Testing MySQL Sync Logic...")
    flight_data = {
        "id": "test_flight_" + str(uuid.uuid4())[:8],
        "origin": "AlphaCity",
        "destination": "BetaCity",
        "airline": "TestAir",
        "duration": 120,
        "price": 123.45
    }
    
    try:
        conn = pymysql.connect(
            host='localhost',
            user='kayak_user',
            password='kayak_pass',
            database='kayak_core',
            port=3306,
            cursorclass=pymysql.cursors.DictCursor
        )
        
        def ensure_airport(cursor, city):
            # Check exist
            cursor.execute("SELECT id FROM airports WHERE city = %s LIMIT 1", (city,))
            res = cursor.fetchone()
            if res:
                print(f"Airport {city} exists: {res['id']}")
                return res['id']
            
            # Create new
            new_id = str(uuid.uuid4())
            iata = city[:3].upper() # 3 chars
            sql_apt = """
            INSERT INTO airports (id, iata_code, name, city, country, created_at, updated_at)
            VALUES (%s, %s, %s, %s, 'Unknown', NOW(), NOW())
            """
            cursor.execute(sql_apt, (new_id, iata, f"{city} Airport", city))
            print(f"Created airport {city} ({new_id})")
            return new_id

        with conn.cursor() as cursor:
            # Ensure Airports
            origin_id = ensure_airport(cursor, flight_data['origin'])
            dest_id = ensure_airport(cursor, flight_data['destination'])
            
            # Check Flight
            sql_check = "SELECT id FROM flights WHERE id = %s"
            cursor.execute(sql_check, (flight_data['id'],))
            exists = cursor.fetchone()
            
            if not exists:
                print(f"Syncing shadow flight {flight_data['id']}")
                sql_insert = """
                INSERT INTO flights (
                    id, flight_number, airline, origin_airport_id, destination_airport_id, 
                    departure_time, arrival_time, total_duration_minutes, stops, 
                    base_price, currency, seats_available, is_active, created_at, updated_at
                )
                VALUES (%s, %s, %s, %s, %s, NOW(), DATE_ADD(NOW(), INTERVAL %s MINUTE), %s, 0, %s, 'USD', 100, 1, NOW(), NOW())
                """
                cursor.execute(sql_insert, (
                    flight_data['id'],
                    f"AI-TEST",
                    flight_data['airline'],
                    origin_id,
                    dest_id,
                    flight_data['duration'],
                    flight_data['duration'],
                    flight_data['price']
                ))
                conn.commit()
                print("Flight synced successfully!")
            else:
                print("Flight already exists")
                
        conn.close()
        print("✅ MySQL Sync Test Passed")
        
    except Exception as e:
        print(f"❌ Test Failed: {e}")
        import traceback
        traceback.print_exc()
        sys.exit(1)

if __name__ == "__main__":
    test_sync()
