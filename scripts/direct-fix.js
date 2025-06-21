/**
 * Скрипт для прямого исправления проблемы с таблицей main.User
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

// Создание таблицы main.User напрямую
function createMainUserTable(db) {
  return new Promise((resolve, reject) => {
    logger.info('Создание таблицы main.User напрямую...');
    
    // Проверяем, есть ли таблица User
    db.get("SELECT name FROM sqlite_master WHERE type='table' AND name='User'", (err, row) => {
      if (err) {
        logger.error(`Ошибка при проверке таблицы User: ${err.message}`);
        reject(err);
        return;
      }
      
      // Если таблица User существует, удаляем её
      if (row) {
        logger.info('Таблица User существует, удаляем её...');
        db.run(`DROP TABLE IF EXISTS "User"`, (err) => {
          if (err) {
            logger.error(`Ошибка при удалении таблицы User: ${err.message}`);
            reject(err);
            return;
          }
          
          createTable();
        });
      } else {
        createTable();
      }
    });
    
    function createTable() {
      // Создаем таблицу main.User напрямую
      db.run(`
        CREATE TABLE main.User (
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
          logger.error(`Ошибка при создании таблицы main.User: ${err.message}`);
          reject(err);
        } else {
          logger.info('Таблица main.User создана успешно');
          resolve();
        }
      });
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
      INSERT OR REPLACE INTO main.User (id, username, firstName, lastName, createdAt, updatedAt)
      VALUES (?, ?, ?, ?, ?, ?)
    `, [userId, 'testuser', 'Test', 'User', now, now], function(err) {
      if (err) {
        logger.error(`Ошибка при создании тестового пользователя: ${err.message}`);
        reject(err);
      } else {
        logger.info('Тестовый пользователь создан успешно');
        resolve();
      }
    });
  });
}

// Проверка схемы Prisma
function checkPrismaSchema() {
  logger.info('Проверка схемы Prisma...');
  
  const schemaPath = path.join(__dirname, '..', 'prisma', 'schema.prisma');
  
  if (!fs.existsSync(schemaPath)) {
    logger.error('Файл схемы Prisma не найден!');
    return false;
  }
  
  let schema = fs.readFileSync(schemaPath, 'utf8');
  
  // Проверяем, есть ли маппинг для таблицы User
  if (!schema.includes('@@map("User")') && !schema.includes('@@map("user")')) {
    logger.warn('Маппинг для таблицы User не найден, добавляем...');
    
    // Добавляем маппинг для таблицы User
    schema = schema.replace(
      'model User {',
      'model User {\n  @@map("User")'
    );
    
    try {
      fs.writeFileSync(schemaPath, schema, 'utf8');
      logger.info('Маппинг для таблицы User добавлен успешно');
    } catch (error) {
      logger.error(`Ошибка при обновлении схемы Prisma: ${error.message}`);
      return false;
    }
  }
  
  return true;
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
  logger.info('Начало прямого исправления проблемы с таблицей main.User...');
  
  // Проверка файла базы данных
  if (!checkDatabaseFile()) {
    logger.error('Не удалось проверить или создать файл базы данных');
    process.exit(1);
  }
  
  // Проверка схемы Prisma
  if (!checkPrismaSchema()) {
    logger.error('Не удалось проверить или обновить схему Prisma');
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
      // Создание таблицы main.User
      await createMainUserTable(db);
      
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