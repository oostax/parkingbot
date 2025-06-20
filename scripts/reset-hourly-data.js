/**
 * Скрипт для сброса данных в таблице hourly_parking_data и повторной инициализации
 */

const sqlite3 = require('sqlite3').verbose();
const path = require('path');
const fs = require('fs');

// Database path
const dbPath = path.join(__dirname, '..', 'prisma', 'dev.db');

// Logger
const logger = {
  info: (message) => console.log(`[INFO]: ${message}`),
  error: (message) => console.error(`[ERROR]: ${message}`)
};

// Сброс и инициализация данных
function resetAndInitialize() {
  const db = new sqlite3.Database(dbPath, (err) => {
    if (err) {
      return logger.error(`Error opening database: ${err.message}`);
    }
    
    logger.info(`Connected to database at ${dbPath}`);
    
    // Очистка таблицы
    db.run('DELETE FROM hourly_parking_data', function(err) {
      if (err) {
        logger.error(`Error clearing table: ${err.message}`);
        return db.close();
      }
      
      logger.info(`Cleared ${this.changes} records from hourly_parking_data`);
      
      // Загрузка данных о парковках
      const dataPath = path.join(__dirname, '..', 'public', 'data', 'parking_data.json');
      
      fs.readFile(dataPath, 'utf8', (err, data) => {
        if (err) {
          logger.error(`Error reading parking data: ${err.message}`);
          return db.close();
        }
        
        let parkingData;
        try {
          parkingData = JSON.parse(data);
        } catch (e) {
          logger.error(`Error parsing parking data: ${e.message}`);
          return db.close();
        }
        
        // Текущая дата в формате Москвы (UTC+3)
        const now = new Date();
        const moscowTime = new Date(now);
        moscowTime.setUTCHours(now.getUTCHours() + 3);
        const today = moscowTime.toISOString().split('T')[0];
        
        // Шаблоны заполнения по часам (утро, день, вечер, ночь)
        const patterns = {
          morning: [0.7, 0.8, 0.85, 0.9, 0.85, 0.8], // 6-11
          day: [0.75, 0.7, 0.65, 0.7, 0.75, 0.8],    // 12-17
          evening: [0.75, 0.7, 0.65, 0.6, 0.55, 0.5], // 18-23
          night: [0.45, 0.4, 0.35, 0.3, 0.3, 0.4]     // 0-5
        };
        
        // Начинаем транзакцию
        db.serialize(() => {
          db.run('BEGIN TRANSACTION');
          
          // Подготавливаем запрос
          const stmt = db.prepare(`
            INSERT INTO hourly_parking_data 
            (parking_id, hour, free_spaces, total_spaces, date_updated)
            VALUES (?, ?, ?, ?, ?)
          `);
          
          // Обрабатываем каждую парковку
          let processedCount = 0;
          
          parkingData.forEach((parking) => {
            const parkingId = parking.id;
            if (!parkingId) return;
            
            // Общее количество мест
            const totalSpaces = parking.spaces?.overall?.total || 50 + (parseInt(parkingId, 10) % 150);
            
            // Генерируем данные для каждого часа (0-23)
            for (let hour = 0; hour < 24; hour++) {
              let baseOccupancy;
              
              // Определяем базовую заполненность на основе времени суток
              if (hour >= 6 && hour <= 11) {
                baseOccupancy = patterns.morning[hour - 6] || 0.7;
              } else if (hour >= 12 && hour <= 17) {
                baseOccupancy = patterns.day[hour - 12] || 0.7;
              } else if (hour >= 18 && hour <= 23) {
                baseOccupancy = patterns.evening[hour - 18] || 0.6;
              } else {
                baseOccupancy = patterns.night[hour] || 0.4;
              }
              
              // Добавляем вариацию на основе ID парковки и часа
              const seed = parseInt(parkingId, 10) || 0;
              const variation = ((seed * (hour + 1)) % 20) / 100; // ±10%
              const adjustedOccupancy = Math.max(0.05, Math.min(0.95, baseOccupancy + variation - 0.1));
              
              // Рассчитываем количество свободных мест
              const hourVariation = ((seed + hour) % 30) - 15; // от -15 до +14
              const freeSpaces = Math.round(totalSpaces * (1 - adjustedOccupancy)) + hourVariation;
              
              // Убеждаемся, что свободных мест не меньше 0 и не больше totalSpaces
              const adjustedFreeSpaces = Math.max(0, Math.min(totalSpaces, freeSpaces));
              
              // Вставляем данные в базу
              stmt.run(parkingId, hour, adjustedFreeSpaces, totalSpaces, today);
            }
            
            processedCount++;
          });
          
          // Завершаем подготовленный запрос
          stmt.finalize();
          
          // Завершаем транзакцию
          db.run('COMMIT', function(err) {
            if (err) {
              logger.error(`Ошибка при фиксации транзакции: ${err.message}`);
            } else {
              logger.info(`Успешно инициализированы данные прогноза для ${processedCount} парковок`);
            }
            
            // Проверяем результаты
            db.get('SELECT COUNT(*) as count FROM hourly_parking_data', (err, row) => {
              if (err) {
                logger.error(`Error counting records: ${err.message}`);
              } else {
                logger.info(`Total records after initialization: ${row.count}`);
              }
              
              // Проверяем данные для конкретной парковки
              db.all(
                'SELECT hour, free_spaces FROM hourly_parking_data WHERE parking_id = ? ORDER BY hour',
                ['25280'],
                (err, rows) => {
                  if (err) {
                    logger.error(`Error checking data: ${err.message}`);
                  } else {
                    logger.info(`Sample data for parking 25280:`);
                    rows.forEach(row => {
                      console.log(`Hour: ${row.hour}, Free Spaces: ${row.free_spaces}`);
                    });
                    
                    // Проверяем уникальность значений
                    const uniqueValues = new Set(rows.map(row => row.free_spaces));
                    logger.info(`Unique free_spaces values: ${uniqueValues.size}`);
                  }
                  
                  db.close();
                }
              );
            });
          });
        });
      });
    });
  });
}

// Запускаем сброс и инициализацию
resetAndInitialize(); 