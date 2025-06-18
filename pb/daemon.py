import requests
import logging
import sqlite3
from datetime import datetime, timedelta
import asyncio
import time
import os
import json
import pytz

# Настройка логирования
logging.basicConfig(level=logging.INFO, format='%(asctime)s - %(levelname)s - %(message)s')
logger = logging.getLogger(__name__)

# Устанавливаем московский часовой пояс
moscow_tz = pytz.timezone('Europe/Moscow')

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
        # Используем московское время
        moscow_time = datetime.now(moscow_tz)
        cursor.execute(
            "INSERT INTO parking_stats (parking_id, timestamp, free_spaces, total_spaces) VALUES (?, ?, ?, ?)",
            (parking_id, moscow_time, free_spaces, total_spaces)
        )
        conn.commit()
        return True
    except Exception as e:
        logger.error(f"Ошибка записи состояния парковки {parking_id}: {e}")
        return False

# Обновление почасовых данных на основе текущей информации
def update_hourly_data(conn):
    try:
        cursor = conn.cursor()
        now = datetime.now(moscow_tz)
        current_hour = now.hour
        today = now.strftime('%Y-%m-%d')
        
        logger.info(f"Обновление почасовых данных для часа {current_hour}:00 (МСК)")
        
        # Получаем все записи parking_stats за последний час
        one_hour_ago = now - timedelta(hours=1)
        
        # Получаем все парковки с данными за последний час
        cursor.execute('''
            SELECT DISTINCT parking_id 
            FROM parking_stats 
            WHERE timestamp >= ?
        ''', (one_hour_ago.strftime('%Y-%m-%d %H:%M:%S'),))
        
        parkings = cursor.fetchall()
        
        # Логгируем для отладки
        logger.info(f"Найдено {len(parkings)} парковок с данными за последний час")
        
        updated_count = 0
        
        for (parking_id,) in parkings:
            # Для каждой парковки вычисляем среднее значение свободных мест за последний час
            cursor.execute('''
                SELECT 
                    AVG(free_spaces) as avg_free,
                    AVG(total_spaces) as avg_total,
                    COUNT(*) as count
                FROM parking_stats
                WHERE parking_id = ? 
                AND timestamp >= ?
            ''', (parking_id, one_hour_ago.strftime('%Y-%m-%d %H:%M:%S')))
            
            result = cursor.fetchone()
            if result:
                avg_free, avg_total, count = result
                
                if count > 0 and avg_free is not None and avg_total is not None:
                    avg_free = int(avg_free)
                    avg_total = int(avg_total)
                    
                    # Отладочная информация
                    logger.info(f"Парковка {parking_id}, час {current_hour}: {avg_free}/{avg_total} (на основе {count} записей)")
                    
                    # Обновляем или вставляем данные для текущего часа
                    cursor.execute('''
                        INSERT OR REPLACE INTO hourly_parking_data 
                        (parking_id, hour, free_spaces, total_spaces, date_updated)
                        VALUES (?, ?, ?, ?, ?)
                    ''', (parking_id, current_hour, avg_free, avg_total, today))
                    
                    updated_count += 1
        
        conn.commit()
        logger.info(f"Обновлены почасовые данные для {updated_count} парковок за час {current_hour}:00")
        
        # Выводим содержимое hourly_parking_data для отладки (для первой парковки)
        if parkings and len(parkings) > 0:
            debug_parking_id = parkings[0][0]
            cursor.execute('''
                SELECT hour, free_spaces, total_spaces, date_updated 
                FROM hourly_parking_data 
                WHERE parking_id = ? 
                ORDER BY hour
            ''', (debug_parking_id,))
            hours_data = cursor.fetchall()
            
            logger.info(f"Текущие почасовые данные для парковки {debug_parking_id}:")
            for hour_data in hours_data:
                hour, free, total, updated = hour_data
                logger.info(f"Час {hour}: {free}/{total} мест (обновлено {updated})")
        
        # Очистка устаревших данных из parking_stats
        cleanup_parking_stats(conn)
    except Exception as e:
        logger.error(f"Ошибка обновления почасовых данных: {e}")

# Функция для очистки устаревших данных parking_stats
def cleanup_parking_stats(conn):
    try:
        cursor = conn.cursor()
        
        # Определяем период хранения - храним данные за последние 7 дней
        retention_period = datetime.now(moscow_tz) - timedelta(days=7)
        
        # Удаление старых записей из parking_stats
        cursor.execute("DELETE FROM parking_stats WHERE timestamp < ?", (retention_period.strftime('%Y-%m-%d %H:%M:%S'),))
        deleted_count = cursor.rowcount
        
        conn.commit()
        
        if deleted_count > 0:
            logger.info(f"Очистка parking_stats: удалено {deleted_count} записей старше 7 дней")
        
    except Exception as e:
        logger.error(f"Ошибка при очистке parking_stats: {e}")

# Основная функция сбора данных
async def collect_parking_data():
    conn = sqlite3.connect(db_path)
    # Включаем поддержку внешних ключей для безопасности
    conn.execute("PRAGMA foreign_keys = ON")
    session = create_session()
    parking_data = load_parking_data()
    
    # Выводим текущее московское время при запуске
    logger.info(f"Текущее московское время: {datetime.now(moscow_tz)}")
    
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
            # Получаем текущий час для отслеживания обновлений (московское время)
            current_hour = datetime.now(moscow_tz).hour
            last_update_hour = current_hour
            
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
            
            # Обновляем почасовые данные каждый час (московское время)
            now_hour = datetime.now(moscow_tz).hour
            if now_hour != last_update_hour:
                update_hourly_data(conn)
                last_update_hour = now_hour
                logger.info(f"Обновлен час в почасовой статистике: {now_hour}:00 (МСК)")
                    
            # Ждем до следующего часа (московское время)
            logger.info("Сбор данных завершен. Ожидание до следующего часа...")
            # Вычисляем время до следующего часа по московскому времени
            now = datetime.now(moscow_tz)
            next_hour = (now + timedelta(hours=1)).replace(minute=0, second=0, microsecond=0)
            seconds_to_wait = (next_hour - now).total_seconds()
            logger.info(f"Следующее обновление в {next_hour.strftime('%H:%M:%S')} (МСК), через {int(seconds_to_wait)} секунд")
            await asyncio.sleep(seconds_to_wait)  # Ждем до начала следующего часа
                
        except Exception as e:
            logger.error(f"Общая ошибка в collect_parking_data: {e}")
            await asyncio.sleep(60)  # Ждем минуту при ошибке

# Запуск асинхронного сбора данных
if __name__ == "__main__":
    logger.info("Запуск демона сбора данных парковок...")
    
    # Выводим информацию о текущем состоянии базы данных при запуске
    conn = sqlite3.connect(db_path)
    try:
        cursor = conn.cursor()
        
        # Отчет о количестве записей в таблицах
        cursor.execute("SELECT COUNT(*) FROM parking_stats")
        parking_stats_count = cursor.fetchone()[0]
        
        cursor.execute("SELECT COUNT(*) FROM hourly_parking_data")
        hourly_data_count = cursor.fetchone()[0]
        
        cursor.execute("SELECT COUNT(*) FROM favorites")
        favorites_count = cursor.fetchone()[0]
        
        # Получаем размер файла базы данных
        db_size_bytes = os.path.getsize(db_path)
        db_size_mb = db_size_bytes / (1024 * 1024)
        
        logger.info(f"Статистика базы данных:")
        logger.info(f"- Размер файла: {db_size_mb:.2f} МБ")
        logger.info(f"- Записей parking_stats: {parking_stats_count}")
        logger.info(f"- Записей hourly_parking_data: {hourly_data_count}")
        logger.info(f"- Записей favorites: {favorites_count}")
        
        # Выводим последние обновления статистики
        cursor.execute("""
            SELECT parking_id, timestamp, free_spaces, total_spaces 
            FROM parking_stats 
            ORDER BY timestamp DESC LIMIT 1
        """)
        last_parking_update = cursor.fetchone()
        if last_parking_update:
            logger.info(f"Последнее обновление данных: {last_parking_update[1]}")
            
    except Exception as e:
        logger.error(f"Ошибка при получении статистики базы данных: {e}")
    finally:
        conn.close()
    
    loop = asyncio.get_event_loop()
    try:
        loop.run_until_complete(collect_parking_data())
    except KeyboardInterrupt:
        logger.info("Демон сбора данных остановлен.")
    except Exception as e:
        logger.error(f"Критическая ошибка в демоне сбора данных: {e}")
