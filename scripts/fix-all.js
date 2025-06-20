/**
 * Скрипт для исправления всех проблем с базой данных и авторизацией
 */

const { execSync } = require('child_process');
const path = require('path');
const fs = require('fs');

// Logger
const logger = {
  info: (message) => console.log(`[INFO]: ${message}`),
  error: (message) => console.error(`[ERROR]: ${message}`)
};

// Путь к базе данных
const dbPath = path.join(__dirname, '..', 'prisma', 'dev.db');

// Проверка существования базы данных
function checkDatabase() {
  logger.info('Проверка базы данных...');
  
  if (!fs.existsSync(dbPath)) {
    logger.error('База данных не найдена. Создаем новую базу данных...');
    try {
      // Создаем директорию prisma, если она не существует
      if (!fs.existsSync(path.join(__dirname, '..', 'prisma'))) {
        fs.mkdirSync(path.join(__dirname, '..', 'prisma'));
      }
      
      // Создаем пустой файл базы данных
      fs.writeFileSync(dbPath, '');
      logger.info('Файл базы данных создан успешно');
    } catch (error) {
      logger.error(`Ошибка при создании файла базы данных: ${error.message}`);
      process.exit(1);
    }
  } else {
    logger.info('База данных существует');
  }
}

// Инициализация таблиц
function initializeTables() {
  logger.info('Инициализация таблиц...');
  
  try {
    // Инициализация основных таблиц
    logger.info('Инициализация основных таблиц...');
    execSync('node scripts/initialize-tables.js', { stdio: 'inherit' });
    
    // Инициализация таблиц пользователей
    logger.info('Инициализация таблиц пользователей...');
    execSync('node scripts/init-user-tables.js', { stdio: 'inherit' });
    
    logger.info('Таблицы успешно инициализированы');
  } catch (error) {
    logger.error(`Ошибка при инициализации таблиц: ${error.message}`);
  }
}

// Исправление прав доступа к базе данных
function fixDatabasePermissions() {
  logger.info('Исправление прав доступа к базе данных...');
  
  try {
    fs.chmodSync(dbPath, 0o666);
    logger.info('Права доступа к базе данных исправлены');
  } catch (error) {
    logger.error(`Ошибка при исправлении прав доступа: ${error.message}`);
  }
}

// Запуск сборщика данных
function startDataCollector() {
  logger.info('Запуск сборщика данных...');
  
  try {
    // Запускаем сборщик данных в фоновом режиме
    const child = require('child_process').spawn('node', ['scripts/data-collector.js'], {
      detached: true,
      stdio: 'ignore'
    });
    
    // Отвязываем процесс от родительского
    child.unref();
    
    logger.info('Сборщик данных запущен успешно');
  } catch (error) {
    logger.error(`Ошибка при запуске сборщика данных: ${error.message}`);
  }
}

// Основная функция
async function main() {
  logger.info('Начало исправления всех проблем...');
  
  // Проверка базы данных
  checkDatabase();
  
  // Инициализация таблиц
  initializeTables();
  
  // Исправление прав доступа
  fixDatabasePermissions();
  
  // Запуск сборщика данных
  startDataCollector();
  
  logger.info('Все проблемы исправлены!');
}

// Запуск основной функции
main().catch(error => {
  logger.error(`Неожиданная ошибка: ${error.message}`);
  process.exit(1); 
});