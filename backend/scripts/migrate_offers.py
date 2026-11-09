import sqlite3
import os

db_paths = [
    os.path.abspath('ofl.db'),
    os.path.abspath('backend/ofl.db')
]

for p in db_paths:
    if os.path.exists(p):
        print(f"Checking {p}...")
        conn = sqlite3.connect(p)
        cursor = conn.cursor()
        
        cursor.execute("PRAGMA table_info(offers);")
        cols = [c[1] for c in cursor.fetchall()]
        
        if 'fee_schedule' not in cols:
            cursor.execute("ALTER TABLE offers ADD COLUMN fee_schedule JSON DEFAULT '[]'")
            print(f"  -> Added fee_schedule to {p}")
            
        if 'total_fees' not in cols:
            cursor.execute("ALTER TABLE offers ADD COLUMN total_fees FLOAT DEFAULT 0.0")
            print(f"  -> Added total_fees to {p}")
            
        if 'net_disbursement' not in cols:
            cursor.execute("ALTER TABLE offers ADD COLUMN net_disbursement FLOAT DEFAULT 0.0")
            print(f"  -> Added net_disbursement to {p}")
            
        conn.commit()
        conn.close()
        print(f"  Completed {p}")
