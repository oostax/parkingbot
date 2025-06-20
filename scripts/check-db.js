/**
 * Скрипт для проверки данных в таблице hourly_parking_data
 */

const sqlite3 = require('sqlite3').verbose();
const path = require('path');

// Database path
const dbPath = path.join(__dirname, '..', 'prisma', 'dev.db');

// Logger
const logger = {
  info: (message) => console.log(`[INFO]: ${message}`),
  error: (message) => console.error(`[ERROR]: ${message}`)
};

// Проверяем данные для конкретной парковки
function checkParkingData(parkingId = '25280') {
  const db = new sqlite3.Database(dbPath, (err) => {
    if (err) {
      return logger.error(`Error opening database: ${err.message}`);
    }
    
    logger.info(`Connected to database at ${dbPath}`);
    
    // Проверяем общее количество записей
    db.get('SELECT COUNT(*) as count FROM hourly_parking_data', (err, row) => {
      if (err) {
        logger.error(`Error counting records: ${err.message}`);
        return db.close();
      }
      
      logger.info(`Total records in hourly_parking_data: ${row.count}`);
      
      // Проверяем данные для конкретной парковки
      db.all(
        'SELECT hour, free_spaces, total_spaces, date_updated FROM hourly_parking_data WHERE parking_id = ? ORDER BY hour',
        [parkingId],
        (err, rows) => {
          if (err) {
            logger.error(`Error getting data for parking ${parkingId}: ${err.message}`);
            return db.close();
          }
          
          logger.info(`Found ${rows.length} records for parking ${parkingId}`);
          
          // Проверяем, что значения разные для разных часов
          const uniqueFreeSpaces = new Set(rows.map(row => row.free_spaces));
          logger.info(`Unique free_spaces values: ${Array.from(uniqueFreeSpaces).join(', ')}`);
          
          // Выводим данные по часам
          logger.info('Hourly data:');
          rows.forEach(row => {
            console.log(`Hour: ${row.hour}, Free Spaces: ${row.free_spaces}, Total Spaces: ${row.total_spaces}, Updated: ${row.date_updated}`);
          });
          
          db.close();
        }
      );
    });
  });
}

// Запускаем проверку
const parkingId = process.argv[2] || '25280';
checkParkingData(parkingId); 