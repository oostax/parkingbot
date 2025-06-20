/**
 * Скрипт для исправления проблем с базой данных
 */

const sqlite3 = require('sqlite3').verbose();
const path = require('path');
const fs = require('fs');
const { execSync } = require('child_process');

// Database path
const dbPath = path.join(__dirname, '..', 'prisma', 'dev.db');

// Logger
const logger = {
  info: (message) => console.log(`[INFO]: ${message}`),
  error: (message) => console.error(`[ERROR]: ${message}`),
  warn: (message) => console.warn(`[WARNING]: ${message}`)
};

// Проверка существования файла базы данных
function checkDatabaseFile() {
  logger.info('Проверка файла базы данных...');
  
  if (!fs.existsSync(dbPath)) {
    logger.warn('Файл базы данных не найден! Создаем новый файл...');
    try {
      // Создаем директорию prisma, если она не существует
      const prismaDir = path.dirname(dbPath);
      if (!fs.existsSync(prismaDir)) {
        fs.mkdirSync(prismaDir, { recursive: true });
      }
      
      // Создаем пустой файл базы данных
      fs.writeFileSync(dbPath, '');
      logger.info('Файл базы данных создан успешно');
    } catch (error) {
      logger.error(`Ошибка при создании файла базы данных: ${error.message}`);
      return false;
    }
  } else {
    logger.info('Файл базы данных существует');
  }
  
  // Проверка прав доступа
  try {
    fs.accessSync(dbPath, fs.constants.R_OK | fs.constants.W_OK);
    logger.info('Права доступа к базе данных в порядке');
  } catch (error) {
    logger.warn(`Проблема с правами доступа к базе данных: ${error.message}`);
    try {
      fs.chmodSync(dbPath, 0o666);
      logger.info('Права доступа к базе данных исправлены');
    } catch (chmodError) {
      logger.error(`Не удалось изменить права доступа: ${chmodError.message}`);
      return false;
    }
  }
  
  return true;
}

// Создание таблицы User
function createUserTable(db) {
  return new Promise((resolve, reject) => {
    logger.info('Создание таблицы User...');
    
    db.run(`
      DROP TABLE IF EXISTS "User";
    `, (err) => {
      if (err) {
        logger.error(`Ошибка при удалении таблицы User: ${err.message}`);
      }
      
      db.run(`
        CREATE TABLE "User" (
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
          logger.error(`Ошибка при создании таблицы User: ${err.message}`);
          reject(err);
        } else {
          logger.info('Таблица User создана успешно');
          resolve();
        }
      });
    });
  });
}

// Создание таблицы UserProfile
function createUserProfileTable(db) {
  return new Promise((resolve, reject) => {
    logger.info('Создание таблицы UserProfile...');
    
    db.run(`
      DROP TABLE IF EXISTS "UserProfile";
    `, (err) => {
      if (err) {
        logger.error(`Ошибка при удалении таблицы UserProfile: ${err.message}`);
      }
      
      db.run(`
        CREATE TABLE "UserProfile" (
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
          FOREIGN KEY (userId) REFERENCES "User"(id) ON DELETE CASCADE
        )
      `, function(err) {
        if (err) {
          logger.error(`Ошибка при создании таблицы UserProfile: ${err.message}`);
          reject(err);
        } else {
          logger.info('Таблица UserProfile создана успешно');
          resolve();
        }
      });
    });
  });
}

// Создание других таблиц для геймификации
function createOtherTables(db) {
  return new Promise(async (resolve, reject) => {
    try {
      // UserDistrict
      await new Promise((res, rej) => {
        db.run(`DROP TABLE IF EXISTS "UserDistrict";`, (err) => {
          if (err) logger.error(`Ошибка при удалении таблицы UserDistrict: ${err.message}`);
          
          db.run(`
            CREATE TABLE "UserDistrict" (
              id TEXT PRIMARY KEY,
              userId TEXT NOT NULL,
              district TEXT NOT NULL,
              FOREIGN KEY (userId) REFERENCES "User"(id) ON DELETE CASCADE,
              UNIQUE(userId, district)
            )
          `, function(err) {
            if (err) {
              logger.error(`Ошибка при создании таблицы UserDistrict: ${err.message}`);
              rej(err);
            } else {
              logger.info('Таблица UserDistrict создана успешно');
              res();
            }
          });
        });
      });
      
      // Achievement
      await new Promise((res, rej) => {
        db.run(`DROP TABLE IF EXISTS "Achievement";`, (err) => {
          if (err) logger.error(`Ошибка при удалении таблицы Achievement: ${err.message}`);
          
          db.run(`
            CREATE TABLE "Achievement" (
              id TEXT PRIMARY KEY,
              userId TEXT NOT NULL,
              achievementId TEXT NOT NULL,
              earned BOOLEAN NOT NULL DEFAULT 0,
              earnedAt DATETIME,
              FOREIGN KEY (userId) REFERENCES "User"(id) ON DELETE CASCADE,
              UNIQUE(userId, achievementId)
            )
          `, function(err) {
            if (err) {
              logger.error(`Ошибка при создании таблицы Achievement: ${err.message}`);
              rej(err);
            } else {
              logger.info('Таблица Achievement создана успешно');
              res();
            }
          });
        });
      });
      
      // TokenTransaction
      await new Promise((res, rej) => {
        db.run(`DROP TABLE IF EXISTS "TokenTransaction";`, (err) => {
          if (err) logger.error(`Ошибка при удалении таблицы TokenTransaction: ${err.message}`);
          
          db.run(`
            CREATE TABLE "TokenTransaction" (
              id TEXT PRIMARY KEY,
              userId TEXT NOT NULL,
              amount INTEGER NOT NULL,
              type TEXT NOT NULL,
              description TEXT NOT NULL,
              createdAt DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
              FOREIGN KEY (userId) REFERENCES "User"(id) ON DELETE CASCADE
            )
          `, function(err) {
            if (err) {
              logger.error(`Ошибка при создании таблицы TokenTransaction: ${err.message}`);
              rej(err);
            } else {
              logger.info('Таблица TokenTransaction создана успешно');
              res();
            }
          });
        });
      });
      
      // Challenge
      await new Promise((res, rej) => {
        db.run(`DROP TABLE IF EXISTS "Challenge";`, (err) => {
          if (err) logger.error(`Ошибка при удалении таблицы Challenge: ${err.message}`);
          
          db.run(`
            CREATE TABLE "Challenge" (
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
              logger.error(`Ошибка при создании таблицы Challenge: ${err.message}`);
              rej(err);
            } else {
              logger.info('Таблица Challenge создана успешно');
              res();
            }
          });
        });
      });
      
      // ChallengeCompletion
      await new Promise((res, rej) => {
        db.run(`DROP TABLE IF EXISTS "ChallengeCompletion";`, (err) => {
          if (err) logger.error(`Ошибка при удалении таблицы ChallengeCompletion: ${err.message}`);
          
          db.run(`
            CREATE TABLE "ChallengeCompletion" (
              id TEXT PRIMARY KEY,
              challengeId TEXT NOT NULL,
              userId TEXT NOT NULL,
              completedAt DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
              FOREIGN KEY (challengeId) REFERENCES "Challenge"(id) ON DELETE CASCADE,
              UNIQUE(challengeId, userId)
            )
          `, function(err) {
            if (err) {
              logger.error(`Ошибка при создании таблицы ChallengeCompletion: ${err.message}`);
              rej(err);
            } else {
              logger.info('Таблица ChallengeCompletion создана успешно');
              res();
            }
          });
        });
      });
      
      resolve();
    } catch (error) {
      reject(error);
    }
  });
}

// Создание тестового пользователя
function createTestUser(db) {
  return new Promise((resolve, reject) => {
    logger.info('Создание тестового пользователя...');
    
    const userId = '123456789';
    const now = new Date().toISOString();
    
    db.run(`
      INSERT OR REPLACE INTO "User" (id, username, firstName, lastName, createdAt, updatedAt)
      VALUES (?, ?, ?, ?, ?, ?)
    `, [userId, 'testuser', 'Test', 'User', now, now], function(err) {
      if (err) {
        logger.error(`Ошибка при создании тестового пользователя: ${err.message}`);
        reject(err);
      } else {
        logger.info('Тестовый пользователь создан успешно');
        
        // Создаем профиль для пользователя
        db.run(`
          INSERT OR REPLACE INTO "UserProfile" (id, userId, tokenBalance, status)
          VALUES (?, ?, ?, ?)
        `, [userId, userId, 100, 'Regular'], function(err) {
          if (err) {
            logger.error(`Ошибка при создании профиля тестового пользователя: ${err.message}`);
            reject(err);
          } else {
            logger.info('Профиль тестового пользователя создан успешно');
            resolve();
          }
        });
      }
    });
  });
}

// Обновление схемы Prisma и перезапуск приложения
async function updatePrismaAndRestartApp() {
  try {
    logger.info('Генерация клиента Prisma...');
    execSync('npx prisma generate', { stdio: 'inherit' });
    
    logger.info('Перезапуск приложения...');
    execSync('pm2 restart all', { stdio: 'inherit' });
    
    logger.info('Приложение успешно перезапущено!');
  } catch (error) {
    logger.error(`Ошибка при обновлении Prisma или перезапуске приложения: ${error.message}`);
    throw error;
  }
}

// Основная функция
async function fixDatabase() {
  logger.info('Начало исправления базы данных...');
  
  // Проверка файла базы данных
  if (!checkDatabaseFile()) {
    logger.error('Не удалось проверить или создать файл базы данных');
    process.exit(1);
  }
  
  // Подключение к базе данных
  const db = new sqlite3.Database(dbPath, async (err) => {
    if (err) {
      logger.error(`Ошибка при подключении к базе данных: ${err.message}`);
      process.exit(1);
    }
    
    logger.info('Подключение к базе данных установлено');
    
    try {
      // Создание таблиц
      await createUserTable(db);
      await createUserProfileTable(db);
      await createOtherTables(db);
      
      // Создание тестового пользователя
      await createTestUser(db);
      
      // Закрытие соединения с базой данных
      db.close(() => {
        logger.info('Соединение с базой данных закрыто');
        
        // Обновление схемы Prisma и перезапуск приложения
        updatePrismaAndRestartApp()
          .then(() => {
            logger.info('Все операции завершены успешно!');
          })
          .catch((error) => {
            logger.error(`Произошла ошибка: ${error.message}`);
            process.exit(1);
          });
      });
    } catch (error) {
      logger.error(`Произошла ошибка: ${error.message}`);
      db.close();
      process.exit(1);
    }
  });
}

// Запуск основной функции
fixDatabase(); 