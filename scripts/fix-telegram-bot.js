// Скрипт для исправления настроек Telegram бота
const fs = require('fs');
const path = require('path');
const { execSync, spawnSync } = require('child_process');

console.log('Начинаем исправление настроек Telegram бота...');

// Пути к файлам
const envPath = path.resolve(process.cwd(), '.env.production');
const nextConfigPath = path.join(process.cwd(), 'next.config.js');

try {
  // Проверяем переменную окружения TELEGRAM_BOT_TOKEN
  console.log('Проверяем переменные окружения для Telegram бота...');
  let envContent = '';
  if (fs.existsSync(envPath)) {
    envContent = fs.readFileSync(envPath, 'utf8');
  }

  // Проверяем наличие токена в .env.production
  const envTokenMatch = envContent.match(/TELEGRAM_BOT_TOKEN="?([^"\n]+)"?/);
  let telegramBotToken = envTokenMatch ? envTokenMatch[1] : null;
  
  // Проверяем наличие токена в process.env
  if (!telegramBotToken && process.env.TELEGRAM_BOT_TOKEN) {
    telegramBotToken = process.env.TELEGRAM_BOT_TOKEN;
  }
  
  // Проверяем наличие токена в next.config.js
  if (!telegramBotToken && fs.existsSync(nextConfigPath)) {
    const nextConfigContent = fs.readFileSync(nextConfigPath, 'utf8');
    const nextConfigTokenMatch = nextConfigContent.match(/TELEGRAM_BOT_TOKEN:\s*"([^"]+)"/);
    if (nextConfigTokenMatch) {
      telegramBotToken = nextConfigTokenMatch[1];
    }
  }

  // Если токен не найден, предлагаем запустить скрипт установки токена
  if (!telegramBotToken) {
    console.log('TELEGRAM_BOT_TOKEN не найден в переменных окружения');
    console.log('Запускаем скрипт установки токена...');
    
    // Проверяем существование скрипта установки токена
    const setTokenScriptPath = path.join(__dirname, 'set-telegram-token.js');
    if (fs.existsSync(setTokenScriptPath)) {
      console.log('Для установки токена выполните команду:');
      console.log('node scripts/set-telegram-token.js');
      
      // Спрашиваем пользователя, хочет ли он запустить скрипт сейчас
      console.log('Хотите запустить скрипт установки токена сейчас? (y/n)');
      const result = spawnSync('read', ['-n', '1', 'answer'], { shell: true, stdio: 'inherit' });
      
      if (result.status === 0) {
        const answer = fs.readFileSync('/dev/stdin', 'utf8').trim().toLowerCase();
        if (answer === 'y') {
          console.log('Запускаем скрипт установки токена...');
          execSync(`node ${setTokenScriptPath}`, { stdio: 'inherit' });
          return;
        }
      }
    } else {
      console.log('Скрипт установки токена не найден. Создаем скрипт...');
      // Код для создания скрипта установки токена
      // (этот код уже реализован в отдельном файле set-telegram-token.js)
    }
    
    console.log('Пожалуйста, установите TELEGRAM_BOT_TOKEN в .env.production вручную');
    console.log('или выполните команду: node scripts/set-telegram-token.js');
    return;
  }

  // Добавляем токен Telegram бота в .env.production, если его там нет
  if (!envContent.includes('TELEGRAM_BOT_TOKEN=')) {
    console.log('Добавляем TELEGRAM_BOT_TOKEN в .env.production...');
    envContent += `\nTELEGRAM_BOT_TOKEN="${telegramBotToken}"\n`;
    envContent += `NEXT_PUBLIC_TELEGRAM_BOT_USERNAME="mosmetroparkingbot"\n`;
    
    fs.writeFileSync(envPath, envContent, 'utf8');
  }

  // Обновляем next.config.js, если он существует
  if (fs.existsSync(nextConfigPath)) {
    console.log('Обновляем TELEGRAM_BOT_TOKEN в next.config.js...');
    let nextConfigContent = fs.readFileSync(nextConfigPath, 'utf8');
    
    if (nextConfigContent.includes('env:')) {
      // Если есть секция env
      if (nextConfigContent.includes('TELEGRAM_BOT_TOKEN:')) {
        // Обновляем существующий токен
        nextConfigContent = nextConfigContent.replace(
          /(TELEGRAM_BOT_TOKEN:\s*)"([^"]*)"/g, 
          `$1"${telegramBotToken}"`
        );
      } else {
        // Добавляем новый токен
        nextConfigContent = nextConfigContent.replace(
          /(env:\s*\{)([^}]*)(})/s,
          `$1$2    TELEGRAM_BOT_TOKEN: "${telegramBotToken}",\n$3`
        );
      }
      
      fs.writeFileSync(nextConfigPath, nextConfigContent, 'utf8');
    }
  }

  // Устанавливаем токен в process.env
  process.env.TELEGRAM_BOT_TOKEN = telegramBotToken;

  // Перезапускаем Telegram бота
  console.log('Перезапускаем Telegram бота...');
  execSync('pm2 restart telegram-bot --update-env', { stdio: 'inherit' });

  console.log('Исправление настроек Telegram бота завершено успешно!');
} catch (error) {
  console.error('Произошла ошибка при исправлении настроек Telegram бота:', error);
  process.exit(1);
} 