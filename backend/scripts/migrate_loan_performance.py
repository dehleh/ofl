import os
import sqlite3

db_paths = [
    os.path.abspath('ofl.db'),
    os.path.abspath('backend/ofl.db')
]

create_sql = """
CREATE TABLE IF NOT EXISTS loan_performances (
    id VARCHAR(36) PRIMARY KEY,
    case_id VARCHAR(36) NOT NULL UNIQUE,
    facility_number VARCHAR(50) NOT NULL,
    borrower_name VARCHAR(255) NOT NULL,
    disbursed_principal FLOAT NOT NULL,
    interest_rate_apr FLOAT DEFAULT 28.0,
    tenor_months INTEGER NOT NULL,
    monthly_installment FLOAT NOT NULL,
    total_installments_count INTEGER NOT NULL,
    installments_serviced INTEGER DEFAULT 0,
    installments_remaining INTEGER NOT NULL,
    principal_serviced FLOAT DEFAULT 0.0,
    interest_serviced FLOAT DEFAULT 0.0,
    total_amount_serviced FLOAT DEFAULT 0.0,
    outstanding_principal FLOAT NOT NULL,
    outstanding_total FLOAT NOT NULL,
    next_due_date DATETIME,
    days_overdue INTEGER DEFAULT 0,
    grace_period_days INTEGER DEFAULT 7,
    penalty_rate_pct FLOAT DEFAULT 5.0,
    penalty_accrued FLOAT DEFAULT 0.0,
    performance_status VARCHAR(50) DEFAULT 'PERFORMING_CURRENT',
    repayment_schedule JSON DEFAULT '[]',
    repayment_history JSON DEFAULT '[]',
    disbursed_at DATETIME,
    last_payment_date DATETIME,
    updated_at DATETIME,
    FOREIGN KEY(case_id) REFERENCES credit_cases(id)
);
"""

for p in db_paths:
    if os.path.exists(p):
        conn = sqlite3.connect(p)
        cursor = conn.cursor()
        cursor.execute(create_sql)
        conn.commit()
        conn.close()
        print(f"Created loan_performances table in {p}")

