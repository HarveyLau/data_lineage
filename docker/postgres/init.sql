CREATE DATABASE gravitino_db;
CREATE DATABASE lineage_app_db;

\c lineage_app_db;

CREATE TABLE IF NOT EXISTS credentials (
    id SERIAL PRIMARY KEY,
    credential_type VARCHAR(50) NOT NULL DEFAULT 'SSH',
    host VARCHAR(255) NOT NULL,
    username VARCHAR(255) NOT NULL,
    encrypted_password TEXT NOT NULL,
    connection_params JSONB,
    description VARCHAR(500),
    key_id VARCHAR(255),
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    UNIQUE(credential_type, host, username)
);

CREATE TABLE IF NOT EXISTS etl_jobs (
    id SERIAL PRIMARY KEY,
    job_name VARCHAR(255) NOT NULL UNIQUE,
    source_type VARCHAR(50) NOT NULL DEFAULT 'unknown',
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS etl_runs (
    id SERIAL PRIMARY KEY,
    job_id INTEGER NOT NULL REFERENCES etl_jobs(id),
    request_id VARCHAR(255) NOT NULL,
    openlineage_run_id VARCHAR(255) NOT NULL,
    uploaded_filename VARCHAR(255) NOT NULL,
    content_hash VARCHAR(128) NOT NULL,
    status VARCHAR(50) NOT NULL DEFAULT 'STARTED',
    error VARCHAR(1000),
    started_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    ended_at TIMESTAMP,
    missing_credentials_count INTEGER NOT NULL DEFAULT 0,
    parsed_summary JSONB,
    lineage_summary JSONB
);

CREATE TABLE IF NOT EXISTS openlineage_events (
    id SERIAL PRIMARY KEY,
    request_id VARCHAR(255),
    run_id VARCHAR(255) NOT NULL,
    job_namespace VARCHAR(255) NOT NULL,
    job_name VARCHAR(255) NOT NULL,
    event_type VARCHAR(50) NOT NULL,
    event_time TIMESTAMPTZ NOT NULL,
    event_payload JSONB NOT NULL,
    created_at TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX IF NOT EXISTS idx_openlineage_events_run_id ON openlineage_events(run_id);
CREATE INDEX IF NOT EXISTS idx_openlineage_events_event_time ON openlineage_events(event_time);
CREATE INDEX IF NOT EXISTS idx_openlineage_events_job ON openlineage_events(job_namespace, job_name, event_time);

CREATE TABLE IF NOT EXISTS openlineage_dataset_refs (
    id SERIAL PRIMARY KEY,
    event_id INTEGER NOT NULL REFERENCES openlineage_events(id) ON DELETE CASCADE,
    role VARCHAR(20) NOT NULL,
    dataset_namespace VARCHAR(500) NOT NULL,
    dataset_name VARCHAR(500) NOT NULL,
    created_at TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX IF NOT EXISTS idx_openlineage_dataset_refs_event_id ON openlineage_dataset_refs(event_id);
CREATE INDEX IF NOT EXISTS idx_openlineage_dataset_refs_lookup ON openlineage_dataset_refs(dataset_namespace, dataset_name, role);

CREATE TABLE IF NOT EXISTS openlineage_access_audits (
    id SERIAL PRIMARY KEY,
    request_id VARCHAR(255) NOT NULL,
    endpoint VARCHAR(500) NOT NULL,
    http_method VARCHAR(20) NOT NULL,
    query_params JSONB,
    status_code INTEGER NOT NULL,
    allowed BOOLEAN NOT NULL DEFAULT FALSE,
    denial_reason VARCHAR(255),
    auth_source VARCHAR(50),
    api_key_fingerprint VARCHAR(64),
    client_ip VARCHAR(255),
    user_agent VARCHAR(1000),
    created_at TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX IF NOT EXISTS idx_openlineage_access_audits_request_id ON openlineage_access_audits(request_id);
CREATE INDEX IF NOT EXISTS idx_openlineage_access_audits_created_at ON openlineage_access_audits(created_at);
CREATE INDEX IF NOT EXISTS idx_openlineage_access_audits_status_code ON openlineage_access_audits(status_code);
CREATE INDEX IF NOT EXISTS idx_openlineage_access_audits_key_fp ON openlineage_access_audits(api_key_fingerprint);

CREATE TABLE IF NOT EXISTS openlineage_api_keys (
    id SERIAL PRIMARY KEY,
    key_name VARCHAR(120) NOT NULL,
    key_hash VARCHAR(128) NOT NULL UNIQUE,
    key_prefix VARCHAR(16) NOT NULL,
    is_active BOOLEAN NOT NULL DEFAULT TRUE,
    expires_at TIMESTAMPTZ,
    revoked_at TIMESTAMPTZ,
    last_used_at TIMESTAMPTZ,
    created_at TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX IF NOT EXISTS idx_openlineage_api_keys_key_name ON openlineage_api_keys(key_name);
CREATE INDEX IF NOT EXISTS idx_openlineage_api_keys_active ON openlineage_api_keys(is_active);
CREATE INDEX IF NOT EXISTS idx_openlineage_api_keys_expires_at ON openlineage_api_keys(expires_at);

CREATE TABLE IF NOT EXISTS openlineage_api_key_policies (
    id SERIAL PRIMARY KEY,
    api_key_id INTEGER NOT NULL UNIQUE REFERENCES openlineage_api_keys(id) ON DELETE CASCADE,
    allowed_job_namespaces JSONB,
    allowed_dataset_namespaces JSONB,
    requests_per_minute INTEGER,
    requests_per_day INTEGER,
    created_at TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX IF NOT EXISTS idx_openlineage_api_key_policies_key_id ON openlineage_api_key_policies(api_key_id);
