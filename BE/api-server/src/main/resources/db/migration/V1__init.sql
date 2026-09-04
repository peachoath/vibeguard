-- VibeGuard initial schema (PRD §10 데이터 모델)
-- users ──< repositories ──< scans ──< findings ──< patches ──< test_runs
--                              │                      │
--                              └──< agent_runs        └──< pull_requests
--                                        └──< audit_logs

CREATE EXTENSION IF NOT EXISTS "pgcrypto";

CREATE TABLE users (
    id            UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    github_id     BIGINT       NOT NULL UNIQUE,
    login         VARCHAR(255) NOT NULL,
    avatar_url    TEXT,
    access_token  TEXT         NOT NULL, -- AES-256-GCM 암호화 저장 (NFR-S3)
    created_at    TIMESTAMPTZ  NOT NULL DEFAULT now()
);

CREATE TABLE repositories (
    id             UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id        UUID         NOT NULL REFERENCES users (id) ON DELETE CASCADE,
    github_repo_id BIGINT       NOT NULL,
    full_name      VARCHAR(512) NOT NULL,
    default_branch VARCHAR(255) NOT NULL,
    language       VARCHAR(64),
    connected_at   TIMESTAMPTZ  NOT NULL DEFAULT now(),
    UNIQUE (user_id, github_repo_id)
);

CREATE TABLE scans (
    id            UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    repository_id UUID         NOT NULL REFERENCES repositories (id) ON DELETE CASCADE,
    ref           VARCHAR(255) NOT NULL,
    commit_sha    VARCHAR(64),
    status        VARCHAR(32)  NOT NULL DEFAULT 'QUEUED',
    started_at    TIMESTAMPTZ,
    finished_at   TIMESTAMPTZ,
    duration_ms   BIGINT,
    error_code    VARCHAR(64),
    created_at    TIMESTAMPTZ  NOT NULL DEFAULT now()
);

CREATE TABLE agent_runs (
    id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    scan_id     UUID        NOT NULL REFERENCES scans (id) ON DELETE CASCADE,
    agent_no    SMALLINT    NOT NULL CHECK (agent_no BETWEEN 1 AND 4),
    session_id  VARCHAR(255),
    status      VARCHAR(32) NOT NULL DEFAULT 'PENDING',
    input_json  JSONB,
    output_json JSONB,
    token_usage INT,
    started_at  TIMESTAMPTZ,
    finished_at TIMESTAMPTZ
);

CREATE TABLE findings (
    id                  UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    scan_id             UUID         NOT NULL REFERENCES scans (id) ON DELETE CASCADE,
    type                VARCHAR(8)   NOT NULL CHECK (type IN ('SCA', 'SAST')),
    rule_id             VARCHAR(255),
    cve_id              VARCHAR(64),
    cwe_id              VARCHAR(32),
    severity            VARCHAR(16),
    cvss_score          NUMERIC(3, 1),
    file_path           TEXT,
    line_start          INT,
    line_end            INT,
    snippet             TEXT,
    package_name        VARCHAR(255),
    current_version     VARCHAR(64),
    recommended_version VARCHAR(64),
    verdict             VARCHAR(16), -- PATCH | IGNORE | MANUAL
    rationale           TEXT,
    status              VARCHAR(32)  NOT NULL DEFAULT 'OPEN',
    created_at          TIMESTAMPTZ  NOT NULL DEFAULT now()
);

CREATE TABLE patches (
    id         UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    finding_id UUID        NOT NULL REFERENCES findings (id) ON DELETE CASCADE,
    diff       TEXT,
    test_code  TEXT,
    strategy   VARCHAR(255),
    attempt_no SMALLINT    NOT NULL DEFAULT 1,
    status     VARCHAR(32) NOT NULL DEFAULT 'PENDING',
    created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE test_runs (
    id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    patch_id    UUID        NOT NULL REFERENCES patches (id) ON DELETE CASCADE,
    phase       VARCHAR(16) NOT NULL CHECK (phase IN ('PRE_PATCH', 'POST_PATCH', 'REGRESSION')),
    passed      BOOLEAN     NOT NULL,
    total       INT,
    failed      INT,
    log         TEXT,
    duration_ms BIGINT,
    created_at  TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE pull_requests (
    id               UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    scan_id          UUID         NOT NULL REFERENCES scans (id) ON DELETE CASCADE,
    github_pr_number INT,
    url              TEXT,
    branch_name      VARCHAR(255),
    state            VARCHAR(32),
    created_at       TIMESTAMPTZ  NOT NULL DEFAULT now()
);

CREATE TABLE audit_logs (
    id             UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    scan_id        UUID        NOT NULL REFERENCES scans (id) ON DELETE CASCADE,
    agent_no       SMALLINT,
    tool_name      VARCHAR(255),
    params_json    JSONB,
    result_summary TEXT,
    ts             TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- 인덱스 (PRD §10)
CREATE INDEX idx_findings_scan_severity ON findings (scan_id, severity);
CREATE INDEX idx_scans_repo_started ON scans (repository_id, started_at DESC);
CREATE INDEX idx_audit_logs_scan_ts ON audit_logs (scan_id, ts);

-- 멱등성: 동일 commit + rule 중복 PR 방지 (NFR-P5)
CREATE UNIQUE INDEX uq_scan_rule ON findings (scan_id, rule_id) WHERE rule_id IS NOT NULL;
