-- WeatherGPT Production SQLite Database Schema

CREATE TABLE IF NOT EXISTS user_settings (
  id INTEGER PRIMARY KEY CHECK (id = 1),
  temperature_unit TEXT NOT NULL DEFAULT 'c',
  language TEXT NOT NULL DEFAULT 'en',
  auto_speak INTEGER NOT NULL DEFAULT 0,
  gemini_api_key TEXT DEFAULT '',
  updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS favorite_places (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  name TEXT NOT NULL,
  admin1 TEXT DEFAULT '',
  country TEXT DEFAULT 'India',
  latitude REAL NOT NULL,
  longitude REAL NOT NULL,
  custom_label TEXT DEFAULT '',
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  UNIQUE(latitude, longitude)
);

CREATE TABLE IF NOT EXISTS search_history (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  query TEXT NOT NULL,
  resolved_name TEXT NOT NULL,
  latitude REAL NOT NULL,
  longitude REAL NOT NULL,
  searched_at DATETIME DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS weather_cache (
  cache_key TEXT PRIMARY KEY,
  latitude REAL NOT NULL,
  longitude REAL NOT NULL,
  payload TEXT NOT NULL,
  cached_at INTEGER NOT NULL,
  expires_at INTEGER NOT NULL
);

CREATE TABLE IF NOT EXISTS ai_conversations (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  prompt TEXT NOT NULL,
  response TEXT NOT NULL,
  language TEXT NOT NULL DEFAULT 'en',
  latitude REAL,
  longitude REAL,
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS travel_plans (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  from_place TEXT NOT NULL,
  to_place TEXT NOT NULL,
  start_date TEXT NOT NULL,
  end_date TEXT NOT NULL,
  route_summary TEXT,
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS farmer_advisories (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  crop TEXT NOT NULL,
  topic TEXT NOT NULL,
  advice TEXT NOT NULL,
  language TEXT NOT NULL,
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP
);

-- Seed default settings
INSERT OR IGNORE INTO user_settings (id, temperature_unit, language, auto_speak, gemini_api_key)
VALUES (1, 'c', 'en', 0, '');

-- Seed popular Indian cities as favorites
INSERT OR IGNORE INTO favorite_places (name, admin1, country, latitude, longitude, custom_label)
VALUES 
  ('Hyderabad', 'Telangana', 'India', 17.3850, 78.4867, 'Home Base'),
  ('Delhi', 'Delhi', 'India', 28.6139, 77.2090, 'Capital'),
  ('Mumbai', 'Maharashtra', 'India', 19.0760, 72.8777, 'West Hub'),
  ('Bengaluru', 'Karnataka', 'India', 12.9716, 77.5946, 'South Tech'),
  ('Chennai', 'Tamil Nadu', 'India', 13.0827, 80.2707, 'Coastal Hub');
