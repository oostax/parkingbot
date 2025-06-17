
import sqlite3
import os
import json
from datetime import datetime

print("Initializing hourly data...")

db_path = os.path.join(os.path.dirname(__file__), 'bot_database.db')
conn = sqlite3.connect(db_path)
cursor = conn.cursor()

# Загружаем данные о парковках
parking_data_path = os.path.join(os.path.dirname(os.path.dirname(__file__)), 'public', 'data', 'parking_data.json')
with open(parking_data_path, 'r', encoding='utf-8') as f:
    parking_data = json.load(f)

today = datetime.now().strftime('%Y-%m-%d')
default_spaces = 50

# Инициализируем почасовую статистику для всех парковок
for parking in parking_data:
    parking_id = parking.get('id')
    if not parking_id:
        continue
    
    # Инициализируем статистику для каждого часа (0-23)
    for hour in range(24):
        # По умолчанию предполагаем, что половина мест свободна
        total_spaces = parking.get('spaces', {}).get('overall', {}).get('total', default_spaces)
        free_spaces = total_spaces // 2
        
        cursor.execute('''
        INSERT OR IGNORE INTO hourly_parking_data 
        (parking_id, hour, free_spaces, total_spaces, date_updated) 
        VALUES (?, ?, ?, ?, ?)
        ''', (parking_id, hour, free_spaces, total_spaces, today))

conn.commit()
conn.close()

print("Hourly data initialized successfully!")
  