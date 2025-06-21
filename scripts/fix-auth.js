/**
 * Комплексный скрипт для решения проблемы с авторизацией
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

// 1. Проверка существования файла базы данных
function checkDatabaseFile() {
  logger.info('1. Проверка файла базы данных...');
  
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

// 2. Создание резервной копии базы данных
function backupDatabase() {
  logger.info('2. Создание резервной копии базы данных...');
  
  if (fs.existsSync(dbPath)) {
    const backupPath = `${dbPath}.backup`;
    try {
      fs.copyFileSync(dbPath, backupPath);
      logger.info(`Резервная копия создана: ${backupPath}`);
      return true;
    } catch (error) {
      logger.error(`Ошибка при создании резервной копии: ${error.message}`);
      return false;
    }
  } else {
    logger.warn('Файл базы данных не существует, резервная копия не создана');
    return true;
  }
}

// 3. Проверка и обновление схемы Prisma
function updatePrismaSchema() {
  logger.info('3. Проверка и обновление схемы Prisma...');
  
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
  } else {
    logger.info('Маппинг для таблицы User уже существует');
  }
  
  return true;
}

// 4. Создание таблиц через Prisma
function createTablesWithPrisma() {
  logger.info('4. Создание таблиц через Prisma...');
  
  try {
    // Генерация клиента Prisma
    logger.info('Генерация клиента Prisma...');
    execSync('npx prisma generate', { stdio: 'inherit' });
    
    // Применение схемы к базе данных
    logger.info('Применение схемы к базе данных...');
    execSync('npx prisma db push --force-reset', { stdio: 'inherit' });
    
    logger.info('Таблицы успешно созданы через Prisma');
    return true;
  } catch (error) {
    logger.error(`Ошибка при создании таблиц через Prisma: ${error.message}`);
    return false;
  }
}

// 5. Создание тестового пользователя
function createTestUser() {
  logger.info('5. Создание тестового пользователя...');
  
  return new Promise((resolve, reject) => {
    const db = new sqlite3.Database(dbPath, (err) => {
      if (err) {
        logger.error(`Ошибка при подключении к базе данных: ${err.message}`);
        reject(err);
        return;
      }
      
      const userId = '123456789';
      const now = new Date().toISOString();
      
      db.run(`
        INSERT OR REPLACE INTO "User" (id, username, firstName, lastName, createdAt, updatedAt)
        VALUES (?, ?, ?, ?, ?, ?)
      `, [userId, 'testuser', 'Test', 'User', now, now], function(err) {
        if (err) {
          logger.error(`Ошибка при создании тестового пользователя: ${err.message}`);
          db.close();
          reject(err);
        } else {
          logger.info('Тестовый пользователь создан успешно');
          db.close();
          resolve(true);
        }
      });
    });
  });
}

// 6. Перезапуск приложения
function restartApp() {
  logger.info('6. Перезапуск приложения...');
  
  try {
    execSync('pm2 restart all', { stdio: 'inherit' });
    logger.info('Приложение успешно перезапущено');
    return true;
  } catch (error) {
    logger.error(`Ошибка при перезапуске приложения: ${error.message}`);
    return false;
  }
}

// Основная функция
async function fixAuth() {
  logger.info('Начало исправления проблемы с авторизацией...');
  
  // 1. Проверка файла базы данных
  if (!checkDatabaseFile()) {
    logger.error('Не удалось проверить или создать файл базы данных');
    process.exit(1);
  }
  
  // 2. Создание резервной копии базы данных
  if (!backupDatabase()) {
    logger.error('Не удалось создать резервную копию базы данных');
    process.exit(1);
  }
  
  // 3. Проверка и обновление схемы Prisma
  if (!updatePrismaSchema()) {
    logger.error('Не удалось обновить схему Prisma');
    process.exit(1);
  }
  
  // 4. Создание таблиц через Prisma
  if (!createTablesWithPrisma()) {
    logger.error('Не удалось создать таблицы через Prisma');
    process.exit(1);
  }
  
  // 5. Создание тестового пользователя
  try {
    await createTestUser();
  } catch (error) {
    logger.error(`Не удалось создать тестового пользователя: ${error.message}`);
    process.exit(1);
  }
  
  // 6. Перезапуск приложения
  if (!restartApp()) {
    logger.error('Не удалось перезапустить приложение');
    process.exit(1);
  }
  
  logger.info('Все операции завершены успешно!');
}

// Запуск основной функции
fixAuth().catch(error => {
  logger.error(`Произошла неожиданная ошибка: ${error.message}`);
  process.exit(1);
}); 