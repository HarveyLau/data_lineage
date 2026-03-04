-- Migration script to add new columns to credentials table
-- Run this if the table already exists

ALTER TABLE credentials 
ADD COLUMN IF NOT EXISTS credential_type VARCHAR(50) NOT NULL DEFAULT 'SSH',
ADD COLUMN IF NOT EXISTS connection_params JSONB,
ADD COLUMN IF NOT EXISTS description VARCHAR(500);

-- Drop old unique constraint if exists
ALTER TABLE credentials DROP CONSTRAINT IF EXISTS uix_host_username;

-- Add new unique constraint
ALTER TABLE credentials 
ADD CONSTRAINT uix_type_host_username UNIQUE (credential_type, host, username);
