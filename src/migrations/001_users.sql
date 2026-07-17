-- ClipForge: Users table migration
-- This is the reference schema. The actual migration runs idempotently
-- via ensureUsersTable() in src/db.ts using CREATE TABLE IF NOT EXISTS.

CREATE TABLE IF NOT EXISTS users (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  email TEXT UNIQUE NOT NULL,
  password_hash TEXT NOT NULL,
  name TEXT NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Index for email lookups during login
CREATE INDEX IF NOT EXISTS idx_users_email ON users (email);
