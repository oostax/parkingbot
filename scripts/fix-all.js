const { execSync } = require('child_process');
const path = require('path');
const fs = require('fs');

console.log('Начинаем полное исправление приложения ParkingBot...');

try {
  // Шаг 1: Исправление переменных окружения
  console.log('\n=== Шаг 1: Исправление переменных окружения ===');
  execSync('node ' + path.join(__dirname, 'fix-env-variables.js'), { stdio: 'inherit' });
  
  // Шаг 2: Проверка наличия токена Telegram бота
  console.log('\n=== Шаг 2: Проверка наличия токена Telegram бота ===');
  
  // Проверяем наличие токена в переменных окружения
  const envPath = path.resolve(process.cwd(), '.env.production');
  let telegramBotToken = null;
  
  if (fs.existsSync(envPath)) {
    const envContent = fs.readFileSync(envPath, 'utf8');
    const envTokenMatch = envContent.match(/TELEGRAM_BOT_TOKEN="?([^"\n]+)"?/);
    if (envTokenMatch) {
      telegramBotToken = envTokenMatch[1];
    }
  }
  
  if (!telegramBotToken && process.env.TELEGRAM_BOT_TOKEN) {
    telegramBotToken = process.env.TELEGRAM_BOT_TOKEN;
  }
  
  if (!telegramBotToken) {
    console.log('TELEGRAM_BOT_TOKEN не найден в переменных окружения');
    console.log('Для установки токена выполните команду:');
    console.log('node scripts/set-telegram-token.js');
    console.log('Продолжаем исправление без токена Telegram бота...');
  } else {
    console.log('TELEGRAM_BOT_TOKEN найден в переменных окружения');
  }
  
  // Шаг 3: Исправление базы данных SQLite
  console.log('\n=== Шаг 3: Исправление базы данных SQLite ===');
  execSync('node ' + path.join(__dirname, 'fix-sqlite-permissions.js'), { stdio: 'inherit' });
  
  // Шаг 4: Исправление настроек Telegram бота
  console.log('\n=== Шаг 4: Исправление настроек Telegram бота ===');
  execSync('node ' + path.join(__dirname, 'fix-telegram-bot.js'), { stdio: 'inherit' });
  
  // Шаг 5: Перезапуск всех сервисов
  console.log('\n=== Шаг 5: Перезапуск всех сервисов ===');
  execSync('pm2 restart all --update-env', { stdio: 'inherit' });
  
  console.log('\n=== Исправление завершено успешно! ===');
  console.log('Статус сервисов:');
  execSync('pm2 list', { stdio: 'inherit' });
  
  // Проверяем логи на наличие ошибок
  console.log('\n=== Проверка логов на наличие ошибок ===');
  console.log('Логи Telegram бота:');
  execSync('pm2 logs telegram-bot --lines 5', { stdio: 'inherit' });
  
  console.log('\nЛоги Next.js приложения:');
  execSync('pm2 logs nextjs-app --lines 5', { stdio: 'inherit' });
  
  console.log('\nЛоги демона сбора статистики:');
  execSync('pm2 logs stats-daemon --lines 5', { stdio: 'inherit' });
  
} catch (error) {
  console.error('\nПроизошла ошибка при исправлении приложения:', error);
  process.exit(1);
} 