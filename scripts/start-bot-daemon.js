// Скрипт-демон для сбора статистики парковок
const { exec } = require('child_process');
const path = require('path');
const fs = require('fs');
require('dotenv').config({ path: path.resolve(process.cwd(), '.env.production') });

console.log('Запуск демона для сбора статистики парковок...');

// Проверяем наличие Python и необходимых модулей
exec('python3 -c "import requests, sqlite3, asyncio"', (error) => {
  if (error) {
    console.error('Ошибка: Python или необходимые модули не установлены');
    console.log('Устанавливаем необходимые зависимости...');
    exec('apt-get update && apt-get install -y python3 python3-pip && pip3 install requests urllib3', (err) => {
      if (err) {
        console.error('Ошибка установки зависимостей Python:', err);
        return;
      }
      startDaemon();
    });
  } else {
    startDaemon();
  }
});

function startDaemon() {
  // Проверяем наличие директории pb и создаем ее при необходимости
  const pbDir = path.resolve(process.cwd(), 'pb');
  if (!fs.existsSync(pbDir)) {
    console.log('Директория pb не найдена, создаем...');
    fs.mkdirSync(pbDir);
  }

  // Проверяем наличие базы данных SQLite
  const dbPath = path.resolve(process.cwd(), 'pb', 'bot_database.db');
  
  if (!fs.existsSync(dbPath)) {
    console.log('База данных не найдена, инициализируем...');
    createDatabase();
  } else {
    console.log('База данных найдена');
  }

  // Запускаем Python скрипт для сбора данных
  const pythonScript = path.resolve(process.cwd(), 'pb', 'daemon.py');
  fs.writeFileSync(pythonScript, generatePythonScript());
  console.log('Скрипт сбора данных создан');
  
  const pythonProcess = exec('python3 ' + pythonScript, (error, stdout, stderr) => {
    if (error) {
      console.error(`Ошибка выполнения Python скрипта: ${error.message}`);
      return;
    }
    if (stderr) {
      console.error(`Stderr: ${stderr}`);
    }
    console.log(`Stdout: ${stdout}`);
  });
  
  pythonProcess.stdout.on('data', (data) => {
    console.log(`Лог демона: ${data}`);
  });
  
  pythonProcess.stderr.on('data', (data) => {
    console.error(`Ошибка демона: ${data}`);
  });
  
  console.log('Демон запущен успешно!');
}

function createDatabase() {
  const dbScript = path.resolve(process.cwd(), 'pb', 'create_db.py');
  fs.writeFileSync(dbScript, `
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

# Create daily_stats table for hourly averages
cursor.execute('''
CREATE TABLE IF NOT EXISTS daily_stats (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    parking_id TEXT NOT NULL,
    hour INTEGER NOT NULL,
    avg_free_spaces REAL NOT NULL,
    avg_occupancy REAL NOT NULL,
    sample_count INTEGER NOT NULL,
    last_updated DATETIME NOT NULL,
    UNIQUE(parking_id, hour)
)
''')

# Create forecasts table
cursor.execute('''
CREATE TABLE IF NOT EXISTS forecasts (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    parking_id TEXT NOT NULL,
    timestamp DATETIME NOT NULL,
    expected_free_spaces INTEGER NOT NULL,
    expected_occupancy REAL NOT NULL,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    UNIQUE(parking_id, timestamp)
)
''')

conn.commit()
conn.close()

print("Database initialized successfully.")
`);

  exec('python3 ' + dbScript, (error, stdout, stderr) => {
    if (error) {
      console.error(`Ошибка инициализации базы данных: ${error.message}`);
      return;
    }
    console.log(stdout);
    initDailyStats();
  });
}

function initDailyStats() {
  console.log('Инициализируем начальные данные статистики...');
  
  // Выполняем скрипт инициализации из init-db
  exec('npm run init-db', (error, stdout, stderr) => {
    if (error) {
      console.error(`Ошибка при инициализации статистики: ${error.message}`);
      return;
    }
    console.log('Начальные данные статистики созданы успешно!');
  });
}

function generatePythonScript() {
  return `
import requests
import logging
import sqlite3
from datetime import datetime, timedelta
import asyncio
import time
import os
import json

# Настройка логирования
logging.basicConfig(level=logging.INFO, format='%(asctime)s - %(levelname)s - %(message)s')
logger = logging.getLogger(__name__)

# Путь к базе данных
db_path = os.path.join(os.path.dirname(__file__), 'bot_database.db')

# Загрузка данных о парковках
def load_parking_data():
    try:
        parking_data_path = os.path.join(os.path.dirname(os.path.dirname(__file__)), 'public', 'data', 'parking_data.json')
        with open(parking_data_path, 'r', encoding='utf-8') as f:
            return json.load(f)
    except Exception as e:
        logger.error(f"Ошибка загрузки данных о парковках: {e}")
        return []

# Создание сессии для запросов
def create_session():
    session = requests.Session()
    session.headers.update({
        "Accept": "application/json, text/plain, */*",
        "Accept-Language": "ru-RU,ru;q=0.9,en-US;q=0.8,en;q=0.7",
        "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36",
        "Referer": "https://lk.parking.mos.ru/parkings",
        "Origin": "https://lk.parking.mos.ru",
        "Connection": "keep-alive"
    })
    return session

# Получение информации о конкретной парковке
def get_parking_info(session, parking_id):
    try:
        url = f"https://lk.parking.mos.ru/api/3.0/parkings/{parking_id}"
        response = session.get(url, timeout=30)
        response.raise_for_status()
        data = response.json()
        
        if not data or 'parking' not in data:
            logger.warning(f"Некорректный ответ API для парковки {parking_id}")
            return None
        
        parking_data = data['parking']
        spaces = parking_data.get('congestion', {}).get('spaces', {})
        overall = spaces.get('overall', {})
        
        total_spaces = overall.get('total', 0)
        free_spaces = overall.get('free', 0)
        
        return (parking_id, total_spaces, free_spaces)
        
    except requests.exceptions.RequestException as e:
        logger.error(f"Ошибка запроса для парковки {parking_id}: {e}")
        return None
    except Exception as e:
        logger.error(f"Общая ошибка для парковки {parking_id}: {e}")
        return None

# Запись состояния парковки
def record_parking_state(conn, parking_id, free_spaces, total_spaces):
    try:
        cursor = conn.cursor()
        cursor.execute(
            "INSERT INTO parking_stats (parking_id, timestamp, free_spaces, total_spaces) VALUES (?, ?, ?, ?)",
            (parking_id, datetime.now(), free_spaces, total_spaces)
        )
        conn.commit()
        return True
    except Exception as e:
        logger.error(f"Ошибка записи состояния парковки {parking_id}: {e}")
        return False

# Обновление дневной статистики
def update_daily_stats(conn):
    try:
        cursor = conn.cursor()
        yesterday = (datetime.now() - timedelta(days=1)).date()
        
        # Получаем все парковки с данными
        parkings = cursor.execute("SELECT DISTINCT parking_id FROM parking_stats").fetchall()
        
        for (parking_id,) in parkings:
            # Для каждого часа вычисляем среднее значение
            stats = cursor.execute('''
                SELECT 
                    strftime('%H', timestamp) as hour,
                    AVG(free_spaces) as avg_free,
                    AVG(CAST(free_spaces AS FLOAT) / total_spaces) as avg_occupancy,
                    COUNT(*) as count
                FROM parking_stats
                WHERE parking_id = ? 
                AND date(timestamp) = ?
                GROUP BY strftime('%H', timestamp)
            ''', (parking_id, yesterday)).fetchall()
            
            for hour, avg_free, avg_occupancy, count in stats:
                cursor.execute('''
                    INSERT OR REPLACE INTO daily_stats 
                    (parking_id, hour, avg_free_spaces, avg_occupancy, sample_count, last_updated)
                    VALUES (?, ?, ?, ?, ?, ?)
                ''', (parking_id, int(hour), avg_free, avg_occupancy, count, yesterday))
        
        conn.commit()
        logger.info(f"Обновлена дневная статистика для {len(parkings)} парковок")
    except Exception as e:
        logger.error(f"Ошибка обновления дневной статистики: {e}")

# Генерация прогнозов на основе статистики
def generate_forecasts(conn):
    try:
        cursor = conn.cursor()
        now = datetime.now()
        current_hour = now.hour
        
        # Получаем все парковки с данными статистики
        parkings = cursor.execute("SELECT DISTINCT parking_id FROM daily_stats").fetchall()
        logger.info(f"Генерация прогнозов для {len(parkings)} парковок...")
        
        # Удаляем устаревшие прогнозы
        cursor.execute("DELETE FROM forecasts WHERE timestamp < ?", (now,))
        
        for (parking_id,) in parkings:
            # Получаем последние данные о парковке
            recent_data = cursor.execute('''
                SELECT parking_id, total_spaces, free_spaces 
                FROM parking_stats 
                WHERE parking_id = ? 
                ORDER BY timestamp DESC LIMIT 1
            ''', (parking_id,)).fetchone()
            
            if not recent_data:
                continue
                
            _, total_spaces, current_free = recent_data
            
            # Получаем статистику по часам для этой парковки
            daily_stats = cursor.execute('''
                SELECT hour, avg_free_spaces, avg_occupancy 
                FROM daily_stats 
                WHERE parking_id = ? 
                ORDER BY hour
            ''', (parking_id,)).fetchall()
            
            if not daily_stats:
                continue
                
            # Конвертируем в словарь для удобства
            stats_by_hour = {hour: (avg_free, avg_occupancy) for hour, avg_free, avg_occupancy in daily_stats}
            
            # Генерируем прогнозы на 24 часа вперед
            for hour_offset in range(1, 25):
                forecast_time = now + timedelta(hours=hour_offset)
                forecast_hour = forecast_time.hour
                
                # Если есть статистика для этого часа
                if forecast_hour in stats_by_hour:
                    avg_free, avg_occupancy = stats_by_hour[forecast_hour]
                    
                    # Делаем прогноз с учетом текущего состояния
                    # Текущее состояние влияет меньше с увеличением временного промежутка
                    weight_current = max(0.05, 1.0 - (hour_offset / 24.0))
                    weight_historic = 1.0 - weight_current
                    
                    # Рассчитываем прогноз
                    current_occupancy = 1.0 - (current_free / total_spaces) if total_spaces > 0 else 0
                    predicted_occupancy = (current_occupancy * weight_current) + (avg_occupancy * weight_historic)
                    predicted_occupancy = max(0.05, min(0.95, predicted_occupancy))  # Ограничиваем в разумных пределах
                    predicted_free = int(total_spaces * (1.0 - predicted_occupancy))
                    
                    # Записываем прогноз
                    cursor.execute('''
                        INSERT OR REPLACE INTO forecasts 
                        (parking_id, timestamp, expected_free_spaces, expected_occupancy)
                        VALUES (?, ?, ?, ?)
                    ''', (parking_id, forecast_time, predicted_free, predicted_occupancy))
            
        conn.commit()
        logger.info("Прогнозы обновлены успешно")
    except Exception as e:
        logger.error(f"Ошибка генерации прогнозов: {e}")

# Основная функция сбора данных
async def collect_parking_data():
    conn = sqlite3.connect(db_path)
    session = create_session()
    parking_data = load_parking_data()
    
    # Добавляем все парковки в избранное для сбора статистики, если их еще нет
    for parking in parking_data:
        try:
            parking_id = parking['id']
            conn.execute(
                "INSERT OR IGNORE INTO favorites (user_id, parking_id) VALUES (?, ?)",
                ('system', parking_id)
            )
        except Exception as e:
            logger.error(f"Ошибка добавления парковки {parking['id']} в избранное: {e}")
    
    conn.commit()
    
    # Запускаем основной цикл сбора данных
    while True:
        try:
            # Выбираем парковки для сбора данных
            parkings = conn.execute('SELECT DISTINCT parking_id FROM favorites').fetchall()
            logger.info(f"Сбор данных для {len(parkings)} парковок...")
            
            for i, (parking_id,) in enumerate(parkings):
                try:
                    # Добавляем задержку между запросами для избежания блокировки
                    if i > 0:
                        await asyncio.sleep(2)
                        
                    parking_info = get_parking_info(session, parking_id)
                    if parking_info:
                        parking_id, total, free = parking_info
                        success = record_parking_state(conn, parking_id, free, total)
                        if success:
                            logger.info(f"Обновлены данные для парковки {parking_id}: {free}/{total}")
                except Exception as e:
                    logger.error(f"Ошибка сбора данных для парковки {parking_id}: {e}")
            
            # Генерируем прогнозы после сбора данных       
            generate_forecasts(conn)
                    
            # Обновляем статистику каждый день в полночь
            current_hour = datetime.now().hour
            if current_hour == 0:
                update_daily_stats(conn)
                
            # Ждем 1 час до следующего обновления
            logger.info("Сбор данных завершен. Ожидание 1 час до следующего обновления...")
            await asyncio.sleep(3600)  # 1 час вместо 15 минут
                
        except Exception as e:
            logger.error(f"Общая ошибка в collect_parking_data: {e}")
            await asyncio.sleep(60)  # Ждем минуту при ошибке

# Запуск асинхронного сбора данных
if __name__ == "__main__":
    logger.info("Запуск демона сбора данных парковок...")
    loop = asyncio.get_event_loop()
    try:
        loop.run_until_complete(collect_parking_data())
    except KeyboardInterrupt:
        logger.info("Демон сбора данных остановлен.")
    except Exception as e:
        logger.error(f"Критическая ошибка в демоне сбора данных: {e}")
`;
}

// Запускаем демон
startDaemon(); 