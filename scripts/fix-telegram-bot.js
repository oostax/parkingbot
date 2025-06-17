// Скрипт для исправления настроек Telegram бота
const fs = require('fs');
const path = require('path');
const { execSync } = require('child_process');

console.log('Начинаем исправление настроек Telegram бота...');

// Пути к файлам
const envPath = path.resolve(process.cwd(), '.env.production');

try {
  // Проверяем переменную окружения TELEGRAM_BOT_TOKEN
  console.log('Проверяем переменные окружения для Telegram бота...');
  let envContent = '';
  if (fs.existsSync(envPath)) {
    envContent = fs.readFileSync(envPath, 'utf8');
  }

  // Добавляем токен Telegram бота, если его нет
  if (!envContent.includes('TELEGRAM_BOT_TOKEN=')) {
    console.log('Добавляем TELEGRAM_BOT_TOKEN в .env.production...');
    const telegramBotToken = '7043413169:AAFLuLBvDqxCWh2dS-jndfiD5s-OHRs6s1A';
    envContent += `\nTELEGRAM_BOT_TOKEN="${telegramBotToken}"\n`;
    envContent += `NEXT_PUBLIC_TELEGRAM_BOT_USERNAME="mosmetroparkingbot"\n`;
    
    fs.writeFileSync(envPath, envContent, 'utf8');
  }

  // Перезапускаем Telegram бота
  console.log('Перезапускаем Telegram бота...');
  execSync('pm2 restart telegram-bot --update-env', { stdio: 'inherit' });

  console.log('Исправление настроек Telegram бота завершено успешно!');
} catch (error) {
  console.error('Произошла ошибка при исправлении настроек Telegram бота:', error);
  process.exit(1);
} 