-- Создание таблицы daily_stats если она не существует
CREATE TABLE IF NOT EXISTS daily_stats (
  id TEXT PRIMARY KEY,
  parkingId TEXT NOT NULL,
  hour INTEGER NOT NULL,
  avgFreeSpaces REAL NOT NULL,
  avg_occupancy REAL NOT NULL,
  sampleCount INTEGER NOT NULL,
  lastUpdated DATETIME NOT NULL,
  UNIQUE(parkingId, hour)
);




