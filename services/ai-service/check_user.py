import pymysql

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
        cursor.execute("SELECT * FROM users WHERE email = 'akshay.menon@usa.com'")
        result = cursor.fetchone()
        print(f"User Found: {result}")
        
    conn.close()
except Exception as e:
    print(f"Error: {e}")
