/**
 * Скрипт для инициализации таблиц пользователей в базе данных
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
function initUserTables() {
  logger.info('Initializing user tables...');

  const db = new sqlite3.Database(dbPath, (err) => {
    if (err) {
      return logger.error(`Error opening database: ${err.message}`);
    }

    logger.info('Connected to database');

    // Enable foreign keys
    db.run('PRAGMA foreign_keys = ON');

    // Create User table if not exists
    db.run(`
      CREATE TABLE IF NOT EXISTS User (
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
        return logger.error(`Error creating User table: ${err.message}`);
      }
      logger.info('User table created or already exists');
    });

    // Create UserProfile table if not exists
    db.run(`
      CREATE TABLE IF NOT EXISTS UserProfile (
        id TEXT PRIMARY KEY,
        userId TEXT NOT NULL UNIQUE,
        tokenBalance INTEGER NOT NULL DEFAULT 0,
        status TEXT NOT NULL DEFAULT 'Regular',
        carModel TEXT,
        district TEXT,
        lastLoginAt DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
        totalParksVisited INTEGER NOT NULL DEFAULT 0,
        uniqueParksVisited INTEGER NOT NULL DEFAULT 0,
        consecutiveLoginDays INTEGER NOT NULL DEFAULT 1,
        totalTokensEarned INTEGER NOT NULL DEFAULT 0,
        totalTokensSpent INTEGER NOT NULL DEFAULT 0,
        referralsCount INTEGER NOT NULL DEFAULT 0,
        challengesCompleted INTEGER NOT NULL DEFAULT 0,
        FOREIGN KEY (userId) REFERENCES User(id) ON DELETE CASCADE
      )
    `, function(err) {
      if (err) {
        return logger.error(`Error creating UserProfile table: ${err.message}`);
      }
      logger.info('UserProfile table created or already exists');
    });

    // Create UserDistrict table if not exists
    db.run(`
      CREATE TABLE IF NOT EXISTS UserDistrict (
        id TEXT PRIMARY KEY,
        userId TEXT NOT NULL,
        district TEXT NOT NULL,
        FOREIGN KEY (userId) REFERENCES User(id) ON DELETE CASCADE,
        UNIQUE(userId, district)
      )
    `, function(err) {
      if (err) {
        return logger.error(`Error creating UserDistrict table: ${err.message}`);
      }
      logger.info('UserDistrict table created or already exists');
    });

    // Create Achievement table if not exists
    db.run(`
      CREATE TABLE IF NOT EXISTS Achievement (
        id TEXT PRIMARY KEY,
        userId TEXT NOT NULL,
        achievementId TEXT NOT NULL,
        earned BOOLEAN NOT NULL DEFAULT 0,
        earnedAt DATETIME,
        FOREIGN KEY (userId) REFERENCES User(id) ON DELETE CASCADE,
        UNIQUE(userId, achievementId)
      )
    `, function(err) {
      if (err) {
        return logger.error(`Error creating Achievement table: ${err.message}`);
      }
      logger.info('Achievement table created or already exists');
    });

    // Create TokenTransaction table if not exists
    db.run(`
      CREATE TABLE IF NOT EXISTS TokenTransaction (
        id TEXT PRIMARY KEY,
        userId TEXT NOT NULL,
        amount INTEGER NOT NULL,
        type TEXT NOT NULL,
        description TEXT NOT NULL,
        createdAt DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
        FOREIGN KEY (userId) REFERENCES User(id) ON DELETE CASCADE
      )
    `, function(err) {
      if (err) {
        return logger.error(`Error creating TokenTransaction table: ${err.message}`);
      }
      logger.info('TokenTransaction table created or already exists');
    });

    // Create Challenge table if not exists
    db.run(`
      CREATE TABLE IF NOT EXISTS Challenge (
        id TEXT PRIMARY KEY,
        title TEXT NOT NULL,
        description TEXT NOT NULL,
        reward INTEGER NOT NULL,
        startDate DATETIME NOT NULL,
        endDate DATETIME NOT NULL,
        isActive BOOLEAN NOT NULL DEFAULT 1,
        type TEXT NOT NULL,
        requirement INTEGER NOT NULL
      )
    `, function(err) {
      if (err) {
        return logger.error(`Error creating Challenge table: ${err.message}`);
      }
      logger.info('Challenge table created or already exists');
    });

    // Create ChallengeCompletion table if not exists
    db.run(`
      CREATE TABLE IF NOT EXISTS ChallengeCompletion (
        id TEXT PRIMARY KEY,
        challengeId TEXT NOT NULL,
        userId TEXT NOT NULL,
        completedAt DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
        FOREIGN KEY (challengeId) REFERENCES Challenge(id) ON DELETE CASCADE,
        UNIQUE(challengeId, userId)
      )
    `, function(err) {
      if (err) {
        return logger.error(`Error creating ChallengeCompletion table: ${err.message}`);
      }
      logger.info('ChallengeCompletion table created or already exists');
      
      // Close the database connection
      db.close(() => {
        logger.info('Database connection closed');
      });
    });
  });
}

// Run the initialization
initUserTables(); 