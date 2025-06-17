const fs = require('fs');
const path = require('path');
const { execSync } = require('child_process');

// Путь к файлу .env.production
const envFilePath = path.join(process.cwd(), '.env.production');
const nextConfigPath = path.join(process.cwd(), 'next.config.js');

// Функция для проверки существования файла
function checkFileExists(filePath) {
  try {
    return fs.existsSync(filePath);
  } catch (err) {
    return false;
  }
}

// Функция для чтения содержимого файла .env
function readEnvFile(filePath) {
  try {
    return fs.readFileSync(filePath, 'utf8');
  } catch (err) {
    console.error(`Ошибка при чтении файла ${filePath}:`, err);
    return '';
  }
}

// Функция для обновления или добавления переменной окружения в .env файл
function updateEnvVariable(filePath, variableName, variableValue) {
  try {
    let envContent = '';
    
    if (checkFileExists(filePath)) {
      envContent = readEnvFile(filePath);
    }

    const regex = new RegExp(`^${variableName}=.*`, 'gm');
    
    if (regex.test(envContent)) {
      // Обновляем существующую переменную
      envContent = envContent.replace(regex, `${variableName}=${variableValue}`);
    } else {
      // Добавляем новую переменную
      envContent += `\n${variableName}=${variableValue}`;
    }

    fs.writeFileSync(filePath, envContent.trim());
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

    let configContent = readEnvFile(nextConfigPath);
    
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

// Основная функция для проверки и установки всех переменных окружения
async function fixEnvVariables() {
  console.log('Начинаем проверку и установку переменных окружения...');

  // Проверяем существование файла .env.production
  if (!checkFileExists(envFilePath)) {
    console.log('Файл .env.production не найден, создаем новый файл...');
    fs.writeFileSync(envFilePath, '');
  }

  // Устанавливаем DATABASE_URL для SQLite
  const dbPath = path.join(process.cwd(), 'prisma', 'dev.db');
  const absoluteDbPath = path.resolve(dbPath);
  const databaseUrl = `file:${absoluteDbPath}`;
  updateEnvVariable(envFilePath, 'DATABASE_URL', databaseUrl);

  // Проверяем и устанавливаем NEXTAUTH_SECRET
  const nextAuthSecret = process.env.NEXTAUTH_SECRET || 'parkingbot_secure_secret_key_for_authentication_12345';
  updateEnvVariable(envFilePath, 'NEXTAUTH_SECRET', nextAuthSecret);

  // Проверяем и устанавливаем NEXTAUTH_URL
  const nextAuthUrl = process.env.NEXTAUTH_URL || 'https://mosparkingbot.ru';
  updateEnvVariable(envFilePath, 'NEXTAUTH_URL', nextAuthUrl);

  // Проверяем TELEGRAM_BOT_TOKEN
  if (!process.env.TELEGRAM_BOT_TOKEN) {
    console.log('TELEGRAM_BOT_TOKEN не найден в переменных окружения');
    console.log('Проверьте файл .env.production и убедитесь, что TELEGRAM_BOT_TOKEN установлен');
  } else {
    updateEnvVariable(envFilePath, 'TELEGRAM_BOT_TOKEN', process.env.TELEGRAM_BOT_TOKEN);
  }

  // Обновляем переменные окружения в next.config.js
  console.log('Обновляем переменные окружения в next.config.js...');
  updateNextConfig({
    DATABASE_URL: databaseUrl,
    NEXTAUTH_SECRET: nextAuthSecret,
    NEXTAUTH_URL: nextAuthUrl
  });

  console.log('Экспортируем переменные окружения в текущую сессию...');
  try {
    const envContent = readEnvFile(envFilePath);
    const envLines = envContent.split('\n');
    
    for (const line of envLines) {
      if (line.trim() && !line.startsWith('#')) {
        const [key, value] = line.split('=');
        if (key && value) {
          process.env[key.trim()] = value.trim();
        }
      }
    }
    
    console.log('Переменные окружения успешно экспортированы');
  } catch (err) {
    console.error('Ошибка при экспорте переменных окружения:', err);
  }

  console.log('Проверка и установка переменных окружения завершена!');
}

// Запускаем основную функцию
fixEnvVariables().catch(err => {
  console.error('Произошла ошибка при выполнении скрипта:', err);
  process.exit(1);
}); 