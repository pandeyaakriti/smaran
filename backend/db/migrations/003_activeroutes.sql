-- Migration 003: active_routes table
-- Run after 002_navigation.sql

CREATE TABLE IF NOT EXISTS active_routes (
    id                   TEXT             PRIMARY KEY,
    user_id              TEXT             NOT NULL,

    origin_lat           DOUBLE PRECISION NOT NULL,
    origin_lng           DOUBLE PRECISION NOT NULL,
    dest_lat             DOUBLE PRECISION NOT NULL,
    dest_lng             DOUBLE PRECISION NOT NULL,

    destination_id       TEXT
        REFERENCES saved_locations(id) ON DELETE SET NULL,

    geometry             JSONB            NOT NULL,
    score_breakdown      JSONB            NOT NULL DEFAULT '{}',
    osrm_summary         JSONB            NOT NULL DEFAULT '{}',

    deviation_level      INTEGER          NOT NULL DEFAULT 0,
    deviation_started_at TIMESTAMPTZ,

    started_at           TIMESTAMPTZ      NOT NULL DEFAULT NOW(),
    completed_at         TIMESTAMPTZ,
    cancelled            BOOLEAN          NOT NULL DEFAULT FALSE
);

CREATE INDEX IF NOT EXISTS idx_active_routes_user_id ON active_routes(user_id);