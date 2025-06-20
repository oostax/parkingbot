/**
 * Скрипт для перестроения приложения и обновления Prisma
 */

const { execSync } = require('child_process');

// Logger
const logger = {
  info: (message) => console.log(`[INFO]: ${message}`),
  error: (message) => console.error(`[ERROR]: ${message}`)
};

// Основная функция
async function rebuildApp() {
  try {
    // Очистка кэша Prisma
    logger.info('Очистка кэша Prisma...');
    execSync('npx prisma generate --schema=./prisma/schema.prisma', { stdio: 'inherit' });
    
    // Перестроение приложения
    logger.info('Перестроение приложения...');
    execSync('npm run build', { stdio: 'inherit' });
    
    logger.info('Приложение успешно перестроено!');
    
    // Перезапуск PM2 процессов
    logger.info('Перезапуск PM2 процессов...');
    execSync('pm2 restart all', { stdio: 'inherit' });
    
    logger.info('Готово! Все процессы перезапущены.');
  } catch (error) {
    logger.error(`Ошибка: ${error.message}`);
    process.exit(1);
  }
}

// Запуск основной функции
rebuildApp(); 