/**
 * Скрипт для создания таблицы main.user
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

// Create and initialize the database
function createMainUserTable() {
  logger.info('Creating main.user table...');

  const db = new sqlite3.Database(dbPath, (err) => {
    if (err) {
      return logger.error(`Error opening database: ${err.message}`);
    }

    logger.info('Connected to database');

    // Check if main.user table exists
    db.get("SELECT name FROM sqlite_master WHERE type='table' AND name='user'", (err, row) => {
      if (err) {
        logger.error(`Error checking table: ${err.message}`);
        db.close();
        return;
      }

      if (row) {
        logger.info('Table user exists, creating view main.user');
        
        // Create a view named main.user that references the user table
        db.run(`
          CREATE VIEW IF NOT EXISTS main.user AS
          SELECT * FROM user
        `, function(err) {
          if (err) {
            logger.error(`Error creating view main.user: ${err.message}`);
          } else {
            logger.info('View main.user created successfully');
          }
          
          // Close the database connection
          db.close(() => {
            logger.info('Database connection closed');
          });
        });
      } else {
        logger.info('Table user does not exist, creating it');
        
        // Create user table if it doesn't exist
        db.run(`
          CREATE TABLE IF NOT EXISTS user (
            id TEXT PRIMARY KEY,
            username TEXT,
            firstName TEXT,
            lastName TEXT,
            createdAt DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
            updatedAt DATETIME NOT NULL,
            email TEXT UNIQUE,
            image TEXT,
            telegramId TEXT
          )
        `, function(err) {
          if (err) {
            logger.error(`Error creating user table: ${err.message}`);
            db.close();
            return;
          }
          
          logger.info('Table user created successfully');
          
          // Create a view named main.user that references the user table
          db.run(`
            CREATE VIEW IF NOT EXISTS main.user AS
            SELECT * FROM user
          `, function(err) {
            if (err) {
              logger.error(`Error creating view main.user: ${err.message}`);
            } else {
              logger.info('View main.user created successfully');
            }
            
            // Close the database connection
            db.close(() => {
              logger.info('Database connection closed');
            });
          });
        });
      }
    });
  });
}

// Run the function
createMainUserTable(); 