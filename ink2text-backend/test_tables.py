"""
Test script to verify all database tables are created correctly
"""

import psycopg2
from config import Config

# Extract database connection details from URI
# Format: postgresql://username:password@host:port/database
uri = Config.SQLALCHEMY_DATABASE_URI
parts = uri.replace('postgresql://', '').split('@')
user_pass = parts[0].split(':')
host_db = parts[1].split('/')

DB_USER = user_pass[0]
DB_PASSWORD = user_pass[1]
DB_HOST = host_db[0].split(':')[0]
DB_PORT = host_db[0].split(':')[1] if ':' in host_db[0] else '5432'
DB_NAME = host_db[1]

def test_tables():
    """Check if all required tables exist"""
    try:
        conn = psycopg2.connect(
            dbname=DB_NAME,
            user=DB_USER,
            password=DB_PASSWORD,
            host=DB_HOST,
            port=DB_PORT
        )
        cursor = conn.cursor()

        print("\n" + "="*60)
        print("🔍 Checking Database Tables")
        print("="*60)

        # Check for tables
        cursor.execute("""
            SELECT table_name 
            FROM information_schema.tables 
            WHERE table_schema = 'public'
            ORDER BY table_name;
        """)
        
        tables = cursor.fetchall()
        
        if not tables:
            print("❌ No tables found!")
            return False

        print(f"\n✅ Found {len(tables)} table(s):\n")
        
        required_tables = ['users', 'documents', 'ocr_text']
        found_tables = [table[0] for table in tables]
        
        for table_name in found_tables:
            print(f"   📋 {table_name}")
            
            # Get column information
            cursor.execute(f"""
                SELECT column_name, data_type, is_nullable
                FROM information_schema.columns
                WHERE table_name = '{table_name}'
                ORDER BY ordinal_position;
            """)
            
            columns = cursor.fetchall()
            for col in columns:
                nullable = "NULL" if col[2] == 'YES' else "NOT NULL"
                print(f"      - {col[0]}: {col[1]} ({nullable})")
            print()

        # Check if all required tables exist
        missing_tables = [t for t in required_tables if t not in found_tables]
        
        if missing_tables:
            print(f"⚠️  Missing tables: {', '.join(missing_tables)}")
            print("\nRun: python app.py")
            print("This will create the missing tables automatically.")
            return False
        else:
            print("✅ All required tables exist!")
            
        # Count records in each table
        print("\n" + "="*60)
        print("📊 Table Statistics")
        print("="*60 + "\n")
        
        for table_name in found_tables:
            cursor.execute(f"SELECT COUNT(*) FROM {table_name}")
            count = cursor.fetchone()[0]
            print(f"   {table_name}: {count} record(s)")

        cursor.close()
        conn.close()
        
        print("\n" + "="*60 + "\n")
        return True

    except psycopg2.Error as e:
        print(f"❌ Database error: {e}")
        return False

if __name__ == "__main__":
    test_tables()
