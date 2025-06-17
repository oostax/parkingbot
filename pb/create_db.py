
import sqlite3
import os

print("Initializing database...")

db_path = os.path.join(os.path.dirname(__file__), 'bot_database.db')

conn = sqlite3.connect(db_path)
cursor = conn.cursor()

# Create favorites table
cursor.execute('''
CREATE TABLE IF NOT EXISTS favorites (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    user_id TEXT NOT NULL,
    parking_id TEXT NOT NULL,
    timestamp DATETIME DEFAULT CURRENT_TIMESTAMP,
    UNIQUE(user_id, parking_id)
)
''')

# Create parking_stats table
cursor.execute('''
CREATE TABLE IF NOT EXISTS parking_stats (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    parking_id TEXT NOT NULL,
    timestamp DATETIME NOT NULL,
    free_spaces INTEGER NOT NULL,
    total_spaces INTEGER NOT NULL
)
''')

# Create hourly_parking_data table для хранения почасовой статистики
cursor.execute('''
CREATE TABLE IF NOT EXISTS hourly_parking_data (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    parking_id TEXT NOT NULL,
    hour INTEGER NOT NULL CHECK(hour >= 0 AND hour < 24),
    free_spaces INTEGER NOT NULL,
    total_spaces INTEGER NOT NULL,
    date_updated DATE NOT NULL,
    UNIQUE(parking_id, hour)
)
''')

# Удаляем старую таблицу daily_stats, так как она больше не нужна
cursor.execute('DROP TABLE IF EXISTS daily_stats')

# Удаляем старую таблицу forecasts, так как мы меняем структуру прогнозов
cursor.execute('DROP TABLE IF EXISTS forecasts')

# Create forecasts table - теперь будет использоваться hourly_parking_data
conn.commit()
conn.close()

print("Database initialized successfully.")
