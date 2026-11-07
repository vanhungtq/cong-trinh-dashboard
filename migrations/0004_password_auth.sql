CREATE TABLE auth_credentials (
  member_id TEXT PRIMARY KEY REFERENCES members(id),
  password_hash TEXT NOT NULL,
  updated_at INTEGER NOT NULL
);
CREATE TABLE auth_sessions (
  token_hash TEXT PRIMARY KEY,
  member_id TEXT NOT NULL REFERENCES members(id),
  expires_at INTEGER NOT NULL
);
CREATE INDEX auth_sessions_member ON auth_sessions(member_id);
CREATE INDEX auth_sessions_expiry ON auth_sessions(expires_at);
CREATE TABLE auth_bootstrap (id TEXT PRIMARY KEY CHECK(id = 'admin'));
CREATE TABLE auth_rate_limits (id TEXT PRIMARY KEY, attempts INTEGER NOT NULL, reset_at INTEGER NOT NULL);
