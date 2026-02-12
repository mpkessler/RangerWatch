-- sightings: time-based fetch (default filter)
CREATE INDEX IF NOT EXISTS idx_sightings_created_at
  ON sightings (created_at DESC);

-- sightings: per-device rate limit check
CREATE INDEX IF NOT EXISTS idx_sightings_device_created
  ON sightings (device_uuid, created_at DESC);

-- sightings: PostGIS spatial index (essential for ST_DWithin performance)
CREATE INDEX IF NOT EXISTS idx_sightings_location
  ON sightings USING GIST (location);

-- checkins: aggregates per sighting
CREATE INDEX IF NOT EXISTS idx_checkins_sighting_created
  ON checkins (sighting_id, created_at DESC);

-- checkins: per-device cooldown check
CREATE INDEX IF NOT EXISTS idx_checkins_device_sighting_created
  ON checkins (device_uuid, sighting_id, created_at DESC);
