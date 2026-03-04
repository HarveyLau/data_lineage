/*****************************************************************
 * Program: daily_etl_process.sas
 * Description: Extract customer data, transform, and load to warehouse
 * Usage: Intended for AI Data Lineage Project Testing
 *****************************************************************/

/* 1. Define data libraries (Simulating Database Connections) */
libname source_db oracle path='//db-prod:1521/sales' schema='sales_ops';
libname target_dw postgres server='warehouse-db' database='analytics';

/* 2. Read input file (File Source) */
/* LINEAGE: Source File -> /var/data/incoming/transactions_20240101.csv */
filename tranfile '/var/data/incoming/transactions_20240101.csv';

data work.daily_transactions;
    infile tranfile dsd firstobs=2;
    input trans_id customer_id amount date :yymmdd10.;
run;

/* 3. Join with Customer Database Table (Table Source) */
/* LINEAGE: Source Table -> source_db.customers */
proc sql;
    create table work.enriched_data as
    select 
        t.trans_id,
        t.amount,
        t.date,
        c.customer_name,
        c.region
    from work.daily_transactions t
    left join source_db.customers c on t.customer_id = c.id;
quit;

/* 4. Filter High Value Transactions (Transformation Logic) */
data work.high_value;
    set work.enriched_data;
    if amount > 1000;
run;

/* 5. Load into Data Warehouse (Table Target) */
/* LINEAGE: Target Table -> target_dw.daily_sales_fact */
data target_dw.daily_sales_fact;
    set work.high_value;
    load_timestamp = datetime();
run;

/* 6. Export Summary Report (File Target) */
/* LINEAGE: Target File -> /var/reports/high_value_sales_report.xlsx */
proc export data=work.high_value
    outfile='/var/reports/high_value_sales_report.xlsx'
    dbms=xlsx replace;
run;

