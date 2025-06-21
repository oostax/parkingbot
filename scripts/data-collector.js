/**
 * Data collector daemon for ParkingBot
 * This script collects parking data hourly and updates statistics
 * Replaces the functionality of the Python daemon.py script
 */

const axios = require('axios');
const sqlite3 = require('sqlite3').verbose();
const fs = require('fs');
const path = require('path');
const { performance } = require('perf_hooks');

// Database path
const dbPath = path.join(__dirname, '..', 'prisma', 'dev.db');

// Configure logger
const logger = {
  info: (message) => console.log(`[INFO] ${new Date().toISOString()}: ${message}`),
  error: (message) => console.error(`[ERROR] ${new Date().toISOString()}: ${message}`),
  warning: (message) => console.warn(`[WARNING] ${new Date().toISOString()}: ${message}`)
};

// Initialize HTTP client with retry capability
const api = axios.create({
  timeout: 30000,
  headers: {
    "Accept": "application/json, text/plain, */*",
    "Accept-Language": "ru-RU,ru;q=0.9,en-US;q=0.8,en;q=0.7",
    "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36",
    "Referer": "https://lk.parking.mos.ru/parkings",
    "Origin": "https://lk.parking.mos.ru",
    "Connection": "keep-alive"
  }
});

// Add retry logic
api.interceptors.response.use(null, async (error) => {
  const config = error.config;
  
  if (!config || !config.retry) {
    return Promise.reject(error);
  }
  
  config.__retryCount = config.__retryCount || 0;
  
  if (config.__retryCount >= config.retry) {
    return Promise.reject(error);
  }
  
  config.__retryCount += 1;
  logger.info(`Retry attempt ${config.__retryCount} for ${config.url}`);
  
  // Wait before retrying
  await new Promise(resolve => setTimeout(resolve, 1000 * config.__retryCount));
  
  return api(config);
});

// Load parking data from JSON
function loadParkingData() {
  try {
    const dataPath = path.join(__dirname, '..', 'public', 'data', 'parking_data.json');
    const data = fs.readFileSync(dataPath, 'utf8');
    return JSON.parse(data);
  } catch (error) {
    logger.error(`Error loading parking data: ${error.message}`);
    return [];
  }
}

// Get information about a specific parking
async function getParkingInfo(parkingId) {
  try {
    const url = `https://lk.parking.mos.ru/api/3.0/parkings/${parkingId}`;
    const response = await api.get(url, { retry: 3 });
    
    if (!response.data || !response.data.parking) {
      logger.warning(`Invalid API response for parking ${parkingId}`);
      return null;
    }
    
    const parkingData = response.data.parking;
    const spaces = parkingData.congestion?.spaces || {};
    const overall = spaces.overall || {};
    
    const totalSpaces = overall.total || 0;
    const freeSpaces = overall.free || 0;
    
    return { parkingId, totalSpaces, freeSpaces };
  } catch (error) {
    logger.error(`Error fetching parking ${parkingId}: ${error.message}`);
    return null;
  }
}

// Record parking state in database
function recordParkingState(db, parkingId, freeSpaces, totalSpaces) {
  return new Promise((resolve, reject) => {
    try {
      // Используем локальное время, которое уже является московским
      const now = new Date();
      
      db.run(
        "INSERT INTO parking_stats (parking_id, timestamp, free_spaces, total_spaces) VALUES (?, ?, ?, ?)",
        [parkingId, now.toISOString(), freeSpaces, totalSpaces],
        function(err) {
          if (err) {
            logger.error(`Error recording state for parking ${parkingId}: ${err.message}`);
            return reject(err);
          }
          resolve(true);
        }
      );
    } catch (error) {
      logger.error(`Error recording state: ${error.message}`);
      reject(error);
    }
  });
}

// Update hourly data based on current information
function updateHourlyData(db) {
  return new Promise((resolve, reject) => {
    try {
      // Используем локальное время, которое уже является московским
      const now = new Date();
      const currentHour = now.getHours();
      const today = now.toISOString().split('T')[0];
      
      logger.info(`Updating hourly data for hour ${currentHour}:00 (MSK)`);
      
      // Get records from the last hour
      const oneHourAgo = new Date(now.getTime() - (60 * 60 * 1000));
      
      db.all(
        `SELECT DISTINCT parking_id FROM parking_stats WHERE timestamp >= ?`,
        [oneHourAgo.toISOString()],
        async (err, parkings) => {
          if (err) {
            logger.error(`Error getting distinct parkings: ${err.message}`);
            return reject(err);
          }
          
          logger.info(`Found ${parkings.length} parkings with data in the last hour`);
          
          if (parkings.length === 0) {
            logger.info(`No parkings with recent data, skipping hourly update`);
            return resolve();
          }
          
          // Используем Promise.all для корректного ожидания всех обновлений
          const updatePromises = parkings.map(({ parking_id }) => {
            return new Promise((resolveParking, rejectParking) => {
              // Calculate average for each parking
              db.get(
                `SELECT 
                  AVG(free_spaces) as avg_free, 
                  AVG(total_spaces) as avg_total, 
                  COUNT(*) as count
                FROM parking_stats 
                WHERE parking_id = ? AND timestamp >= ?`,
                [parking_id, oneHourAgo.toISOString()],
                (err, result) => {
                  if (err) {
                    logger.error(`Error calculating averages for parking ${parking_id}: ${err.message}`);
                    return rejectParking(err);
                  }
                  
                  if (result && result.count > 0 && result.avg_free !== null && result.avg_total !== null) {
                    const avgFree = Math.round(result.avg_free);
                    const avgTotal = Math.round(result.avg_total);
                    
                    // Добавляем вариацию для создания более реалистичного прогноза
                    const seed = parseInt(parking_id, 10) || 0;
                    const hourVariation = ((seed + currentHour) % 15) - 7; // от -7 до +7
                    const adjustedFreeSpaces = Math.max(0, Math.min(avgTotal, avgFree + hourVariation));
                    
                    logger.info(`Parking ${parking_id}, hour ${currentHour}: ${adjustedFreeSpaces}/${avgTotal} (based on ${result.count} records)`);
                    
                    // Update or insert hourly data
                    db.run(
                      `REPLACE INTO hourly_parking_data 
                      (parking_id, hour, free_spaces, total_spaces, date_updated)
                      VALUES (?, ?, ?, ?, ?)`,
                      [parking_id, currentHour, adjustedFreeSpaces, avgTotal, today],
                      function(err) {
                        if (err) {
                          logger.error(`Error updating hourly data for parking ${parking_id}: ${err.message}`);
                          rejectParking(err);
                        } else {
                          logger.info(`Successfully updated hourly data for parking ${parking_id}, hour ${currentHour}`);
                          resolveParking();
                        }
                      }
                    );
                  } else {
                    logger.warning(`No valid data for parking ${parking_id}, skipping update`);
                    resolveParking();
                  }
                }
              );
            });
          });
          
          // Ждем завершения всех обновлений
          Promise.all(updatePromises)
            .then(() => {
              logger.info(`Updated hourly data for ${parkings.length} parkings for hour ${currentHour}:00`);
              resolve();
            })
            .catch(error => {
              logger.error(`Error during batch update: ${error.message}`);
              reject(error);
            });
        }
      );
    } catch (error) {
      logger.error(`Error updating hourly data: ${error.message}`);
      reject(error);
    }
  });
}

// Clean up old parking stats data
function cleanupParkingStats(db) {
  return new Promise((resolve, reject) => {
    try {
      // Keep data for last 7 days
      const retentionDate = new Date();
      retentionDate.setDate(retentionDate.getDate() - 7);
      
      db.run(
        "DELETE FROM parking_stats WHERE timestamp < ?",
        [retentionDate.toISOString()],
        function(err) {
          if (err) {
            logger.error(`Error cleaning up old data: ${err.message}`);
            return reject(err);
          }
          
          const deletedCount = this.changes;
          if (deletedCount > 0) {
            logger.info(`Cleaned up ${deletedCount} old parking stats records`);
          }
          
          resolve();
        }
      );
    } catch (error) {
      logger.error(`Error during cleanup: ${error.message}`);
      reject(error);
    }
  });
}

// Функция для инициализации данных прогноза для всех часов
async function initializeForecastData(db, parkingData) {
  return new Promise((resolve, reject) => {
    try {
      logger.info('Проверка и инициализация данных прогноза...');
      
      // Проверяем, есть ли уже данные в таблице
      db.get('SELECT COUNT(*) as count FROM hourly_parking_data', async (err, row) => {
        if (err) {
          logger.error(`Ошибка при проверке данных прогноза: ${err.message}`);
          return reject(err);
        }
        
        // Если данных мало (меньше 24 записей на парковку), инициализируем их
        if (row.count < parkingData.length * 24 * 0.8) {
          logger.info(`Недостаточно данных прогноза (${row.count}), инициализация...`);
          
          // Текущая дата в локальном формате (уже московское время)
          const now = new Date();
          const today = now.toISOString().split('T')[0];
          
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
              INSERT OR IGNORE INTO hourly_parking_data 
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
                return reject(err);
              }
              
              logger.info(`Успешно инициализированы данные прогноза для ${processedCount} парковок`);
              resolve();
            });
          });
        } else {
          logger.info(`Данные прогноза уже инициализированы (${row.count} записей)`);
          resolve();
        }
      });
    } catch (error) {
      logger.error(`Ошибка при инициализации данных прогноза: ${error.message}`);
      reject(error);
    }
  });
}

// Main function to collect parking data
async function collectParkingData() {
  let db;
  
  try {
    logger.info('Starting data collection...');
    
    // Open database connection
    db = new sqlite3.Database(dbPath);
    
    // Enable foreign keys
    await new Promise((resolve, reject) => {
      db.run('PRAGMA foreign_keys = ON', (err) => {
        if (err) reject(err);
        else resolve();
      });
    });
    
    const parkingData = loadParkingData();
    
    // Инициализируем данные прогноза, если необходимо
    await initializeForecastData(db, parkingData);
    
    // Get current hour (Moscow time)
    const now = new Date();
    let currentHour = now.getHours();
    let lastUpdateHour = currentHour;
    
    logger.info(`Current Moscow time: ${now.toLocaleTimeString()} (${currentHour}:00), Date: ${now.toLocaleDateString()}`);
    
    // Make sure all parkings are in the system favorites
    for (const parking of parkingData) {
      try {
        await new Promise((resolve, reject) => {
          db.run(
            "INSERT OR IGNORE INTO favorites (user_id, parking_id) VALUES (?, ?)",
            ['system', parking.id],
            (err) => {
              if (err) reject(err);
              else resolve();
            }
          );
        });
      } catch (error) {
        logger.error(`Error adding parking ${parking.id} to favorites: ${error.message}`);
      }
    }
    
    // Main loop - run indefinitely
    while (true) {
      try {
        // Get parkings from favorites
        const parkings = await new Promise((resolve, reject) => {
          db.all('SELECT DISTINCT parking_id FROM favorites', (err, rows) => {
            if (err) reject(err);
            else resolve(rows);
          });
        });
        
        logger.info(`Collecting data for ${parkings.length} parkings...`);
        
        // Process each parking with delay between requests
        for (let i = 0; i < parkings.length; i++) {
          const { parking_id } = parkings[i];
          
          // Add delay between requests
          if (i > 0) {
            await new Promise(resolve => setTimeout(resolve, 2000));
          }
          
          try {
            const parkingInfo = await getParkingInfo(parking_id);
            if (parkingInfo) {
              const { parkingId, totalSpaces, freeSpaces } = parkingInfo;
              await recordParkingState(db, parkingId, freeSpaces, totalSpaces);
              logger.info(`Updated data for parking ${parkingId}: ${freeSpaces}/${totalSpaces}`);
            }
          } catch (error) {
            logger.error(`Error processing parking ${parking_id}: ${error.message}`);
          }
        }
        
        // Update hourly data when hour changes (Moscow time)
        const newNow = new Date();
        let newHour = newNow.getHours();
        
        if (newHour !== lastUpdateHour) {
          await updateHourlyData(db);
          await cleanupParkingStats(db);
          lastUpdateHour = newHour;
          logger.info(`Updated hourly statistics for hour ${newHour}:00 (MSK)`);
        }
        
        // Calculate time until next hour
        const nextHour = new Date(newNow);
        nextHour.setHours(newHour + 1, 0, 0, 0);
        const waitTime = nextHour.getTime() - newNow.getTime();
        
        logger.info(`Data collection complete. Waiting until next hour...`);
        logger.info(`Next update at ${nextHour.toLocaleTimeString()} (MSK), in ${Math.round(waitTime / 1000)} seconds`);
        
        // Sleep until next hour
        await new Promise(resolve => setTimeout(resolve, waitTime));
        
      } catch (error) {
        logger.error(`Error in main collection loop: ${error.message}`);
        // Wait 60 seconds before retrying
        await new Promise(resolve => setTimeout(resolve, 60 * 1000));
      }
    }
  } catch (error) {
    logger.error(`Fatal error in data collection: ${error.message}`);
  } finally {
    if (db) {
      db.close();
    }
  }
}

// Run the collection process
collectParkingData().catch(err => {
  logger.error(`Critical error: ${err.message}`);
  process.exit(1);
}); 