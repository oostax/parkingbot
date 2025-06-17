// Скрипт для проверки и исправления проблем с файлом базы данных SQLite
const fs = require('fs');
const path = require('path');
const { execSync } = require('child_process');

console.log('Начинаем проверку файла базы данных SQLite...');

// Сначала выполняем скрипт для настройки переменных окружения
console.log('Настраиваем переменные окружения...');
try {
  require('./fix-env-variables.js');
} catch (error) {
  console.error('Ошибка при настройке переменных окружения:', error);
  process.exit(1);
}

// Пути к файлам
const prismaDir = path.resolve(process.cwd(), 'prisma');
const dbPath = path.resolve(prismaDir, 'dev.db');
const envPath = path.resolve(process.cwd(), '.env.production');

try {
  // Проверяем существование директории prisma
  if (!fs.existsSync(prismaDir)) {
    console.log('Директория prisma не существует, создаем...');
    fs.mkdirSync(prismaDir, { recursive: true });
  }

  // Проверяем существование файла базы данных
  if (!fs.existsSync(dbPath)) {
    console.log('Файл базы данных не существует, создаем пустой файл...');
    fs.writeFileSync(dbPath, '', 'utf8');
  }

  // Устанавливаем права доступа на файл базы данных
  console.log('Устанавливаем права доступа на файл базы данных...');
  execSync(`chmod 666 ${dbPath}`, { stdio: 'inherit' });

  // Устанавливаем права доступа на директорию prisma
  console.log('Устанавливаем права доступа на директорию prisma...');
  execSync(`chmod 777 ${prismaDir}`, { stdio: 'inherit' });
  
  // Устанавливаем права доступа на родительскую директорию
  console.log('Устанавливаем права доступа на родительскую директорию...');
  execSync(`chmod 777 ${process.cwd()}`, { stdio: 'inherit' });
  
  // Проверяем владельца процесса и устанавливаем соответствующие права
  console.log('Устанавливаем владельца файла базы данных...');
  execSync(`chown -R $(whoami):$(whoami) ${prismaDir}`, { stdio: 'inherit' });
  execSync(`chown $(whoami):$(whoami) ${dbPath}`, { stdio: 'inherit' });
  
  // Проверяем, что файл базы данных доступен для записи
  console.log('Проверяем доступ к файлу базы данных...');
  try {
    fs.accessSync(dbPath, fs.constants.R_OK | fs.constants.W_OK);
    console.log('Файл базы данных доступен для чтения и записи');
  } catch (err) {
    console.error('Файл базы данных недоступен для чтения и записи:', err);
    console.log('Пытаемся исправить права доступа...');
    execSync(`chmod 777 ${dbPath}`, { stdio: 'inherit' });
  }

  // Инициализируем базу данных с помощью Prisma
  console.log('Инициализируем базу данных с помощью Prisma...');
  
  // Проверяем наличие переменной окружения DATABASE_URL
  if (!process.env.DATABASE_URL) {
    console.log('Переменная DATABASE_URL не установлена, устанавливаем из .env.production...');
    try {
      const envContent = fs.readFileSync(envPath, 'utf8');
      const match = envContent.match(/DATABASE_URL="?([^"\n]+)"?/);
      if (match && match[1]) {
        process.env.DATABASE_URL = match[1];
        console.log(`DATABASE_URL установлен: ${process.env.DATABASE_URL}`);
      } else {
        throw new Error('DATABASE_URL не найден в .env.production');
      }
    } catch (err) {
      console.error('Ошибка при чтении DATABASE_URL из .env.production:', err);
      process.exit(1);
    }
  }
  
  // Создаем директорию node_modules/@prisma если она не существует
  const prismaDirNodeModules = path.resolve(process.cwd(), 'node_modules/@prisma');
  if (!fs.existsSync(prismaDirNodeModules)) {
    console.log('Директория node_modules/@prisma не существует, создаем...');
    fs.mkdirSync(prismaDirNodeModules, { recursive: true });
  }
  
  // Устанавливаем права доступа на директорию node_modules/@prisma
  console.log('Устанавливаем права доступа на директорию node_modules/@prisma...');
  execSync(`chmod -R 777 ${path.resolve(process.cwd(), 'node_modules')}`, { stdio: 'inherit' });
  
  // Проверяем наличие директории .next и устанавливаем права доступа
  const nextDir = path.resolve(process.cwd(), '.next');
  if (fs.existsSync(nextDir)) {
    console.log('Устанавливаем права доступа на директорию .next...');
    execSync(`chmod -R 777 ${nextDir}`, { stdio: 'inherit' });
  }
  
  // Пересоздаем базу данных
  console.log('Пересоздаем базу данных...');
  try {
    execSync('npx prisma db push --force-reset', { stdio: 'inherit' });
  } catch (error) {
    console.error('Ошибка при пересоздании базы данных:', error);
    console.log('Пробуем альтернативный метод...');
    
    // Удаляем файл базы данных и создаем заново
    fs.unlinkSync(dbPath);
    fs.writeFileSync(dbPath, '', 'utf8');
    execSync(`chmod 777 ${dbPath}`, { stdio: 'inherit' });
    execSync(`chown $(whoami):$(whoami) ${dbPath}`, { stdio: 'inherit' });
    
    // Пробуем снова
    execSync('npx prisma db push --force-reset', { stdio: 'inherit' });
  }

  // Генерируем клиент Prisma
  console.log('Генерируем клиент Prisma...');
  execSync('npx prisma generate', { stdio: 'inherit' });

  // Перезапускаем приложение
  console.log('Перезапускаем приложение...');
  execSync('pm2 restart nextjs-app --update-env', { stdio: 'inherit' });

  console.log('Проверка и исправление файла базы данных завершены успешно!');
  console.log(`Путь к базе данных: ${dbPath}`);
  console.log('Проверьте логи приложения для подтверждения успешного подключения.');
} catch (error) {
  console.error('Произошла ошибка при проверке файла базы данных:', error);
  process.exit(1);
} 