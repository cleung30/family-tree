
CREATE TABLE people (
  id SERIAL PRIMARY KEY,
  first_name TEXT NOT NULL,
  last_name TEXT,
  chinese_name TEXT,
  birth_year INTEGER,
  death_year INTEGER,
  gender TEXT DEFAULT 'o',
  notes TEXT,
  photo_base64 TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE relationships (
  id SERIAL PRIMARY KEY,
  person1_id INTEGER REFERENCES people(id) ON DELETE CASCADE,
  person2_id INTEGER REFERENCES people(id) ON DELETE CASCADE,
  type TEXT NOT NULL CHECK (type IN ('parent', 'spouse')),
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE settings (
  key TEXT PRIMARY KEY,
  value TEXT
);

INSERT INTO settings (key, value) VALUES ('pin', '');

ALTER TABLE people ENABLE ROW LEVEL SECURITY;
ALTER TABLE relationships ENABLE ROW LEVEL SECURITY;
ALTER TABLE settings ENABLE ROW LEVEL SECURITY;

CREATE POLICY "public_read_people" ON people FOR SELECT USING (true);
CREATE POLICY "public_write_people" ON people FOR ALL USING (true);
CREATE POLICY "public_read_relationships" ON relationships FOR SELECT USING (true);
CREATE POLICY "public_write_relationships" ON relationships FOR ALL USING (true);
CREATE POLICY "public_read_settings" ON settings FOR SELECT USING (true);
CREATE POLICY "public_write_settings" ON settings FOR ALL USING (true);
