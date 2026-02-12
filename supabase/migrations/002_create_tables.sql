-- ============================================================
-- counters: atomic sequence generator for anon_user_number
-- ============================================================
CREATE TABLE IF NOT EXISTS counters (
  name  TEXT PRIMARY KEY,
  value BIGINT NOT NULL DEFAULT 0
);

-- Seed the anon_user_number counter
INSERT INTO counters (name, value)
VALUES ('anon_user_number', 0)
ON CONFLICT (name) DO NOTHING;

-- Atomic increment function
CREATE OR REPLACE FUNCTION increment_counter(p_name TEXT)
RETURNS BIGINT
LANGUAGE sql
AS $$
  UPDATE counters
  SET value = value + 1
  WHERE name = p_name
  RETURNING value;
$$;

-- ============================================================
-- sightings
-- ============================================================
CREATE TABLE IF NOT EXISTS sightings (
  id               UUID         PRIMARY KEY DEFAULT gen_random_uuid(),
  created_at       TIMESTAMPTZ  NOT NULL    DEFAULT now(),
  tag              TEXT         NOT NULL    CHECK (tag IN ('Sighting', 'Warning', 'Ticket')),
  description      TEXT,
  media_url        TEXT,
  location         GEOGRAPHY(Point, 4326) NOT NULL,
  lat              DOUBLE PRECISION NOT NULL,
  lng              DOUBLE PRECISION NOT NULL,
  anon_user_number BIGINT       NOT NULL,
  device_uuid      UUID         NOT NULL,
  is_deleted       BOOLEAN      NOT NULL    DEFAULT false
);

-- ============================================================
-- checkins
-- ============================================================
CREATE TABLE IF NOT EXISTS checkins (
  id               UUID         PRIMARY KEY DEFAULT gen_random_uuid(),
  created_at       TIMESTAMPTZ  NOT NULL    DEFAULT now(),
  sighting_id      UUID         NOT NULL    REFERENCES sightings(id) ON DELETE CASCADE,
  anon_user_number BIGINT       NOT NULL,
  device_uuid      UUID         NOT NULL
);

-- ============================================================
-- Helper: find nearest sighting within 25 m, last 90 minutes
-- ============================================================
CREATE OR REPLACE FUNCTION find_nearby_sighting(p_lat DOUBLE PRECISION, p_lng DOUBLE PRECISION)
RETURNS TABLE(id UUID, created_at TIMESTAMPTZ, tag TEXT, lat DOUBLE PRECISION, lng DOUBLE PRECISION)
LANGUAGE sql
STABLE
AS $$
  SELECT s.id, s.created_at, s.tag, s.lat, s.lng
  FROM sightings s
  WHERE s.is_deleted = false
    AND s.created_at > (now() - INTERVAL '90 minutes')
    AND ST_DWithin(
          s.location::geography,
          ST_SetSRID(ST_MakePoint(p_lng, p_lat), 4326)::geography,
          25
        )
  ORDER BY s.created_at DESC
  LIMIT 1;
$$;
