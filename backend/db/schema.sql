-- ============================================================================
-- DocuVault :: PostgreSQL Schema
-- Run with: psql -U <user> -d <database> -f schema.sql
-- ============================================================================

CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- ----------------------------------------------------------------------------
-- ENUM TYPES
-- ----------------------------------------------------------------------------
DO $$ BEGIN
  CREATE TYPE user_role AS ENUM ('admin', 'manager', 'member');
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  CREATE TYPE share_permission AS ENUM ('view', 'comment', 'edit');
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  CREATE TYPE audit_action AS ENUM (
    'user.register', 'user.login', 'user.login_failed', 'user.logout',
    'user.update_profile', 'user.role_changed', 'user.deactivated',
    'file.upload', 'file.download', 'file.delete', 'file.rename',
    'file.move', 'file.restore',
    'folder.create', 'folder.delete', 'folder.rename',
    'share.create', 'share.revoke', 'share.permission_change'
  );
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

-- ----------------------------------------------------------------------------
-- USERS
-- ----------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS users (
  id                 UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  full_name          VARCHAR(150)  NOT NULL,
  email              VARCHAR(255)  NOT NULL UNIQUE,
  password_hash      VARCHAR(255)  NOT NULL,
  role               user_role     NOT NULL DEFAULT 'member',
  avatar_url         TEXT,
  storage_quota_mb   INTEGER       NOT NULL DEFAULT 5120, -- 5GB default quota
  is_active          BOOLEAN       NOT NULL DEFAULT TRUE,
  last_login_at      TIMESTAMPTZ,
  created_at         TIMESTAMPTZ   NOT NULL DEFAULT now(),
  updated_at         TIMESTAMPTZ   NOT NULL DEFAULT now()
);

-- ----------------------------------------------------------------------------
-- REFRESH TOKENS (for JWT rotation / logout invalidation)
-- ----------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS refresh_tokens (
  id           UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id      UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  token_hash   VARCHAR(255) NOT NULL,
  expires_at   TIMESTAMPTZ NOT NULL,
  revoked      BOOLEAN NOT NULL DEFAULT FALSE,
  created_at   TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- ----------------------------------------------------------------------------
-- FOLDERS (self-referencing tree)
-- ----------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS folders (
  id           UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  name         VARCHAR(255) NOT NULL,
  owner_id     UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  parent_id    UUID REFERENCES folders(id) ON DELETE CASCADE,
  is_trashed   BOOLEAN NOT NULL DEFAULT FALSE,
  created_at   TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at   TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (owner_id, parent_id, name)
);

-- ----------------------------------------------------------------------------
-- FILES  (storage_key is an ABSTRACT pointer -- local path today, S3 key later)
-- ----------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS files (
  id             UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  original_name  VARCHAR(500) NOT NULL,
  mime_type      VARCHAR(150) NOT NULL,
  size_bytes     BIGINT NOT NULL,
  storage_key    TEXT NOT NULL,          -- abstract storage pointer, see utils/storage.js
  storage_driver VARCHAR(50) NOT NULL DEFAULT 'local', -- 'local' | 's3' | ... (future)
  checksum_sha256 VARCHAR(64),
  owner_id       UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  folder_id      UUID REFERENCES folders(id) ON DELETE SET NULL,
  version        INTEGER NOT NULL DEFAULT 1,
  is_trashed     BOOLEAN NOT NULL DEFAULT FALSE,
  created_at     TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at     TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_files_owner ON files(owner_id);
CREATE INDEX IF NOT EXISTS idx_files_folder ON files(folder_id);
CREATE INDEX IF NOT EXISTS idx_files_name_trgm ON files USING gin (original_name gin_trgm_ops);

-- Enable trigram search (used for fuzzy filename search). Safe to skip if
-- the extension is unavailable -- fallback to ILIKE in application code.
DO $$ BEGIN
  CREATE EXTENSION IF NOT EXISTS pg_trgm;
EXCEPTION WHEN insufficient_privilege THEN NULL; END $$;

-- ----------------------------------------------------------------------------
-- SHARES (file or folder shared with a user, or via public link)
-- ----------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS shares (
  id            UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  file_id       UUID REFERENCES files(id) ON DELETE CASCADE,
  folder_id     UUID REFERENCES folders(id) ON DELETE CASCADE,
  shared_by     UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  shared_with   UUID REFERENCES users(id) ON DELETE CASCADE, -- null => public link
  permission    share_permission NOT NULL DEFAULT 'view',
  public_token  VARCHAR(64) UNIQUE,       -- set only for public links
  expires_at    TIMESTAMPTZ,
  created_at    TIMESTAMPTZ NOT NULL DEFAULT now(),
  CHECK (file_id IS NOT NULL OR folder_id IS NOT NULL)
);

CREATE INDEX IF NOT EXISTS idx_shares_shared_with ON shares(shared_with);
CREATE INDEX IF NOT EXISTS idx_shares_file ON shares(file_id);

-- ----------------------------------------------------------------------------
-- AUDIT LOGS
-- ----------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS audit_logs (
  id          UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  actor_id    UUID REFERENCES users(id) ON DELETE SET NULL,
  action      audit_action NOT NULL,
  target_type VARCHAR(50),   -- 'file' | 'folder' | 'user' | 'share'
  target_id   UUID,
  metadata    JSONB NOT NULL DEFAULT '{}',
  ip_address  VARCHAR(64),
  created_at  TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_audit_actor ON audit_logs(actor_id);
CREATE INDEX IF NOT EXISTS idx_audit_created ON audit_logs(created_at DESC);

-- ----------------------------------------------------------------------------
-- NOTIFICATIONS
-- ----------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS notifications (
  id          UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id     UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  title       VARCHAR(255) NOT NULL,
  body        TEXT,
  is_read     BOOLEAN NOT NULL DEFAULT FALSE,
  created_at  TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_notifications_user ON notifications(user_id, is_read);
