CREATE TABLE IF NOT EXISTS customers (
    id INTEGER PRIMARY KEY,
    customer_name VARCHAR(255) NOT NULL,
    region VARCHAR(100),
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

INSERT INTO customers (id, customer_name, region) VALUES
(101, 'Acme Corporation', 'North America'),
(102, 'Tech Solutions Inc', 'Europe'),
(103, 'Global Trading Co', 'Asia Pacific'),
(104, 'Digital Services Ltd', 'North America'),
(105, 'Manufacturing Group', 'Europe')
ON CONFLICT (id) DO NOTHING;

CREATE TABLE IF NOT EXISTS daily_sales_fact (
    trans_id INTEGER,
    customer_id INTEGER,
    amount DECIMAL(10,2),
    date DATE,
    customer_name VARCHAR(255),
    region VARCHAR(100),
    load_timestamp TIMESTAMP
);
