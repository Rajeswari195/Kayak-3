import pymysql
import os

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
        cursor.execute("SELECT * FROM users WHERE email = 'akshay.menon@usa.com'")
        result = cursor.fetchone()
        print(f"User Found: {result}")
        
    conn.close()
except Exception as e:
    print(f"Error: {e}")
