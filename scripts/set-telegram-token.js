const fs = require('fs');
const path = require('path');
const readline = require('readline');

// Путь к файлу .env.production
const envFilePath = path.join(process.cwd(), '.env.production');
const nextConfigPath = path.join(process.cwd(), 'next.config.js');

// Создаем интерфейс для чтения из консоли
const rl = readline.createInterface({
  input: process.stdin,
  output: process.stdout
});

// Функция для проверки существования файла
function checkFileExists(filePath) {
  try {
    return fs.existsSync(filePath);
  } catch (err) {
    return false;
  }
}

// Функция для чтения содержимого файла
function readFile(filePath) {
  try {
    return fs.readFileSync(filePath, 'utf8');
  } catch (err) {
    console.error(`Ошибка при чтении файла ${filePath}:`, err);
    return '';
  }
}

// Функция для обновления переменной окружения в .env файле
function updateEnvVariable(filePath, variableName, variableValue) {
  try {
    let envContent = '';
    
    if (checkFileExists(filePath)) {
      envContent = readFile(filePath);
    }

    const regex = new RegExp(`^${variableName}=.*`, 'gm');
    
    if (regex.test(envContent)) {
      // Обновляем существующую переменную
      envContent = envContent.replace(regex, `${variableName}=${variableValue}`);
    } else {
      // Добавляем новую переменную
      envContent += `\n${variableName}=${variableValue}`;
    }

    fs.writeFileSync(filePath, envContent.trim(), 'utf8');
    console.log(`Переменная ${variableName} успешно обновлена в ${filePath}`);
    return true;
  } catch (err) {
    console.error(`Ошибка при обновлении переменной ${variableName}:`, err);
    return false;
  }
}

// Функция для обновления переменных окружения в next.config.js
function updateNextConfig(variables) {
  try {
    if (!checkFileExists(nextConfigPath)) {
      console.error('Файл next.config.js не найден');
      return false;
    }

    let configContent = readFile(nextConfigPath);
    
    // Проверяем наличие секции env
    if (!configContent.includes('env:')) {
      console.error('Секция env не найдена в next.config.js');
      return false;
    }

    // Для каждой переменной в объекте variables
    for (const [key, value] of Object.entries(variables)) {
      const regex = new RegExp(`(${key}:\\s*)"([^"]*)"`, 'g');
      
      if (regex.test(configContent)) {
        // Обновляем существующую переменную
        configContent = configContent.replace(regex, `$1"${value}"`);
      } else {
        // Добавляем новую переменную в секцию env
        const envSectionRegex = /(env:\s*\{)([^}]*)(})/s;
        configContent = configContent.replace(
          envSectionRegex, 
          `$1$2    ${key}: "${value}",\n$3`
        );
      }
    }

    fs.writeFileSync(nextConfigPath, configContent, 'utf8');
    console.log('Переменные окружения успешно обновлены в next.config.js');
    return true;
  } catch (err) {
    console.error('Ошибка при обновлении next.config.js:', err);
    return false;
  }
}

// Функция для установки токена Telegram бота
function setTelegramToken() {
  console.log('Установка токена Telegram бота');
  console.log('-----------------------------');
  console.log('Пожалуйста, введите токен вашего Telegram бота (полученный от @BotFather):');
  
  rl.question('> ', (token) => {
    if (!token || token.trim() === '') {
      console.log('Токен не может быть пустым. Пожалуйста, попробуйте снова.');
      rl.close();
      return;
    }
    
    console.log(`Устанавливаем токен: ${token}`);
    
    // Обновляем токен в .env.production
    updateEnvVariable(envFilePath, 'TELEGRAM_BOT_TOKEN', token);
    
    // Обновляем токен в next.config.js
    updateNextConfig({
      TELEGRAM_BOT_TOKEN: token
    });
    
    // Устанавливаем токен в process.env
    process.env.TELEGRAM_BOT_TOKEN = token;
    
    console.log('Токен Telegram бота успешно установлен!');
    console.log('Перезапускаем Telegram бота...');
    
    try {
      const { execSync } = require('child_process');
      execSync('pm2 restart telegram-bot --update-env', { stdio: 'inherit' });
      console.log('Telegram бот успешно перезапущен!');
    } catch (error) {
      console.error('Ошибка при перезапуске Telegram бота:', error);
    }
    
    rl.close();
  });
}

// Запускаем функцию установки токена
setTelegramToken(); 