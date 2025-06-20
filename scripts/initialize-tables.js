/**
 * Script to initialize required tables for the data collector
 * Creates parking_stats, hourly_parking_data, and favorites tables if they don't exist
 */

const sqlite3 = require('sqlite3').verbose();
const path = require('path');
const fs = require('fs');

// Database path
const dbPath = path.join(__dirname, '..', 'prisma', 'dev.db');

// Logger
const logger = {
  info: (message) => console.log(`[INFO] ${new Date().toISOString()}: ${message}`),
  error: (message) => console.error(`[ERROR] ${new Date().toISOString()}: ${message}`)
};

// Create and initialize the database
function initDatabase() {
  logger.info('Initializing database tables...');

  const db = new sqlite3.Database(dbPath, (err) => {
    if (err) {
      return logger.error(`Error opening database: ${err.message}`);
    }

    logger.info('Connected to database');

    // Enable foreign keys
    db.run('PRAGMA foreign_keys = ON');

    // Create favorites table if not exists
    db.run(`
      CREATE TABLE IF NOT EXISTS favorites (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        user_id TEXT NOT NULL,
        parking_id TEXT NOT NULL,
        timestamp DATETIME DEFAULT CURRENT_TIMESTAMP,
        UNIQUE(user_id, parking_id)
      )
    `, function(err) {
      if (err) {
        return logger.error(`Error creating favorites table: ${err.message}`);
      }
      logger.info('Favorites table created or already exists');
    });

    // Create parking_stats table if not exists
    db.run(`
      CREATE TABLE IF NOT EXISTS parking_stats (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        parking_id TEXT NOT NULL,
        timestamp DATETIME NOT NULL,
        free_spaces INTEGER NOT NULL,
        total_spaces INTEGER NOT NULL
      )
    `, function(err) {
      if (err) {
        return logger.error(`Error creating parking_stats table: ${err.message}`);
      }
      logger.info('Parking stats table created or already exists');
    });

    // Create hourly_parking_data table if not exists
    db.run(`
      CREATE TABLE IF NOT EXISTS hourly_parking_data (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        parking_id TEXT NOT NULL,
        hour INTEGER NOT NULL CHECK(hour >= 0 AND hour < 24),
        free_spaces INTEGER NOT NULL,
        total_spaces INTEGER NOT NULL,
        date_updated DATE NOT NULL,
        UNIQUE(parking_id, hour) ON CONFLICT REPLACE
      )
    `, function(err) {
      if (err) {
        return logger.error(`Error creating hourly_parking_data table: ${err.message}`);
      }
      logger.info('Hourly parking data table created or already exists');

      // Initialize hourly data with varied values for each hour
      initHourlyData(db);
    });
  });
}

function initHourlyData(db) {
  try {
    // Check if hourly data already exists
    db.get('SELECT COUNT(*) as count FROM hourly_parking_data', (err, row) => {
      if (err) {
        logger.error(`Error checking hourly data: ${err.message}`);
        db.close();
        return;
      }

      // If there's already data, we don't need to initialize
      if (row.count > 0) {
        logger.info(`Hourly data already exists (${row.count} records)`);
        db.close();
        return;
      }

      // Load parking data from JSON
      const dataPath = path.join(__dirname, '..', 'public', 'data', 'parking_data.json');
      
      fs.readFile(dataPath, 'utf8', (err, data) => {
        if (err) {
          logger.error(`Error reading parking data: ${err.message}`);
          db.close();
          return;
        }

        let parkingData;
        try {
          parkingData = JSON.parse(data);
        } catch (e) {
          logger.error(`Error parsing parking data: ${e.message}`);
          db.close();
          return;
        }

        // Get current date in Moscow time (UTC+3)
        const now = new Date();
        const moscowTime = new Date(now);
        moscowTime.setUTCHours(now.getUTCHours() + 3);
        const today = moscowTime.toISOString().split('T')[0];
        
        // Default number of spaces if not specified
        const defaultSpaces = 100;
        
        // Шаблоны заполнения по часам (утро, день, вечер, ночь)
        const patterns = {
          morning: [0.7, 0.8, 0.85, 0.9, 0.85, 0.8], // 6-11
          day: [0.75, 0.7, 0.65, 0.7, 0.75, 0.8],    // 12-17
          evening: [0.75, 0.7, 0.65, 0.6, 0.55, 0.5], // 18-23
          night: [0.45, 0.4, 0.35, 0.3, 0.3, 0.4]     // 0-5
        };

        let processedCount = 0;

        // Prepare for batch insertion
        db.serialize(() => {
          // Start transaction
          db.run('BEGIN TRANSACTION');

          const stmt = db.prepare(`
            INSERT OR IGNORE INTO hourly_parking_data 
            (parking_id, hour, free_spaces, total_spaces, date_updated)
            VALUES (?, ?, ?, ?, ?)
          `);

          // For each parking
          parkingData.forEach((parking) => {
            const parkingId = parking.id;
            if (!parkingId) return;

            // Общее количество мест
            const totalSpaces = parking.spaces?.overall?.total || defaultSpaces;
            
            // Initialize for each hour (0-23)
            for (let hour = 0; hour < 24; hour++) {
              // Определяем базовую заполненность на основе времени суток
              let baseOccupancy;
              
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
              
              stmt.run(parkingId, hour, adjustedFreeSpaces, totalSpaces, today);
            }

            processedCount++;
          });

          stmt.finalize();

          // Commit transaction
          db.run('COMMIT', function(err) {
            if (err) {
              logger.error(`Error committing hourly data: ${err.message}`);
            } else {
              logger.info(`Successfully initialized hourly data for ${processedCount} parkings with varied values`);
            }
            db.close();
          });
        });
      });
    });
  } catch (error) {
    logger.error(`Error in initHourlyData: ${error.message}`);
    db.close();
  }
}

// Run the initialization
initDatabase(); 