/**
 * Скрипт для обновления URL соединения в файле .env
 */

const fs = require('fs');
const path = require('path');

// Logger
const logger = {
  info: (message) => console.log(`[INFO]: ${message}`),
  error: (message) => console.error(`[ERROR]: ${message}`),
  warn: (message) => console.warn(`[WARNING]: ${message}`)
};

// Путь к файлу .env
const envPath = path.join(__dirname, '..', '.env');

// Обновление URL соединения
function updateConnectionUrl() {
  logger.info('Обновление URL соединения в файле .env...');
  
  let envContent = '';
  
  // Проверяем, существует ли файл .env
  if (fs.existsSync(envPath)) {
    // Читаем содержимое файла
    envContent = fs.readFileSync(envPath, 'utf8');
    
    // Проверяем, есть ли в файле DATABASE_URL
    if (envContent.includes('DATABASE_URL=')) {
      // Заменяем DATABASE_URL
      envContent = envContent.replace(
        /DATABASE_URL=.*$/m,
        'DATABASE_URL="file:./prisma/dev.db"'
      );
      
      logger.info('URL соединения обновлен');
    } else {
      // Добавляем DATABASE_URL
      envContent += '\nDATABASE_URL="file:./prisma/dev.db"';
      
      logger.info('URL соединения добавлен');
    }
  } else {
    // Создаем новый файл .env
    envContent = `# Environment variables
DATABASE_URL="file:./prisma/dev.db"
NEXTAUTH_URL="http://localhost:3000"
NEXTAUTH_SECRET="your-secret-key-here"
NEXT_PUBLIC_TELEGRAM_BOT_USERNAME="mosmetroparkingbot"
TELEGRAM_BOT_TOKEN="7043413169:AAFLuLBvDqxCWh2dS-jndfiD5s-OHRs6s1A"
`;
    
    logger.info('Создан новый файл .env');
  }
  
  // Записываем обновленное содержимое в файл
  try {
    fs.writeFileSync(envPath, envContent, 'utf8');
    logger.info('Файл .env успешно обновлен');
    return true;
  } catch (error) {
    logger.error(`Ошибка при обновлении файла .env: ${error.message}`);
    return false;
  }
}

// Запуск обновления
if (updateConnectionUrl()) {
  logger.info('URL соединения успешно обновлен');
} else {
  logger.error('Не удалось обновить URL соединения');
  process.exit(1);
} 