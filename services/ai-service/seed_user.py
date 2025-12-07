import pymysql
import uuid

try:
    conn = pymysql.connect(
        host='localhost',
        user='kayak_user',
        password='kayak_pass',
        database='kayak_core',
        port=3306,
        cursorclass=pymysql.cursors.DictCursor
    )
    with conn.cursor() as cursor:
        user_uuid = str(uuid.uuid4())
        user_num_id = "AM001" # Simple ID
        
        sql = """
        INSERT INTO users (
            id, user_id, first_name, last_name, email, password_hash, 
            address_line1, city, state, zip, country, phone, 
            is_active, is_admin, created_at, updated_at
        )
        VALUES (
            %s, %s, 'Akshay', 'Menon', 'aksahy.menon@usa.com', 'dummy_hash',
            '123 Mock St', 'San Jose', 'CA', '95134', 'United States', '555-0199',
            1, 0, NOW(), NOW()
        )
        """
        cursor.execute(sql, (user_uuid, user_num_id))
        conn.commit()
        print(f"Created User: aksahy.menon@usa.com with UUID: {user_uuid}")

        
    conn.close()
except Exception as e:
    print(f"Error: {e}")
