const { execSync } = require('child_process');
const path = require('path');

console.log('Начинаем полное исправление приложения ParkingBot...');

try {
  // Шаг 1: Исправление переменных окружения
  console.log('\n=== Шаг 1: Исправление переменных окружения ===');
  execSync('node ' + path.join(__dirname, 'fix-env-variables.js'), { stdio: 'inherit' });
  
  // Шаг 2: Исправление базы данных SQLite
  console.log('\n=== Шаг 2: Исправление базы данных SQLite ===');
  execSync('node ' + path.join(__dirname, 'fix-sqlite-permissions.js'), { stdio: 'inherit' });
  
  // Шаг 3: Исправление настроек Telegram бота
  console.log('\n=== Шаг 3: Исправление настроек Telegram бота ===');
  execSync('node ' + path.join(__dirname, 'fix-telegram-bot.js'), { stdio: 'inherit' });
  
  // Шаг 4: Перезапуск всех сервисов
  console.log('\n=== Шаг 4: Перезапуск всех сервисов ===');
  execSync('pm2 restart all --update-env', { stdio: 'inherit' });
  
  console.log('\n=== Исправление завершено успешно! ===');
  console.log('Статус сервисов:');
  execSync('pm2 list', { stdio: 'inherit' });
  
} catch (error) {
  console.error('\nПроизошла ошибка при исправлении приложения:', error);
  process.exit(1);
} 