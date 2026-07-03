-- Migration 002: Navigation tables
-- Run after 001_initial.sql

CREATE TABLE IF NOT EXISTS saved_locations (
    id            TEXT        PRIMARY KEY,
    user_id       VARCHAR NOT NULL,
    label         VARCHAR(120) NOT NULL,
    notes         TEXT,
    latitude      DOUBLE PRECISION NOT NULL,
    longitude     DOUBLE PRECISION NOT NULL,
    category      VARCHAR(32) NOT NULL DEFAULT 'other',
    is_pinned     BOOLEAN     NOT NULL DEFAULT FALSE,
    created_at    TIMESTAMP   NOT NULL DEFAULT NOW(),
    updated_at    TIMESTAMP   NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_saved_locations_user_id ON saved_locations(user_id);

-- ---------------------------------------------------------------

CREATE TABLE IF NOT EXISTS location_visits (
    id                   TEXT             PRIMARY KEY,
    user_id              VARCHAR             NOT NULL,
    saved_location_id    TEXT             NOT NULL
        REFERENCES saved_locations(id) ON DELETE CASCADE,
    latitude             DOUBLE PRECISION NOT NULL,
    longitude            DOUBLE PRECISION NOT NULL,
    distance_metres      DOUBLE PRECISION,
    visited_at           TIMESTAMP        NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_location_visits_user_id           ON location_visits(user_id);
CREATE INDEX IF NOT EXISTS idx_location_visits_saved_location_id ON location_visits(saved_location_id);n