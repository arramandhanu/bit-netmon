-- Add location_id to server_monitors
ALTER TABLE server_monitors ADD COLUMN location_id INT REFERENCES locations(location_id) ON DELETE SET NULL;
CREATE INDEX idx_server_monitors_location ON server_monitors(location_id);

-- Add location_id to url_monitors
ALTER TABLE url_monitors ADD COLUMN location_id INT REFERENCES locations(location_id) ON DELETE SET NULL;
CREATE INDEX idx_url_monitors_location ON url_monitors(location_id);
