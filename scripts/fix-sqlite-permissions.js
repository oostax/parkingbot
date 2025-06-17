// Скрипт для проверки и исправления проблем с файлом базы данных SQLite
const fs = require('fs');
const path = require('path');
const { execSync } = require('child_process');

console.log('Начинаем проверку файла базы данных SQLite...');

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

  // Проверяем переменную окружения DATABASE_URL
  console.log('Проверяем переменную окружения DATABASE_URL...');
  let envContent = '';
  if (fs.existsSync(envPath)) {
    envContent = fs.readFileSync(envPath, 'utf8');
  }

  // Проверяем, что DATABASE_URL указывает на правильный путь
  const absoluteDbPath = path.resolve(process.cwd(), 'prisma', 'dev.db');
  const correctDbUrl = `DATABASE_URL="file:${absoluteDbPath}"`;
  
  if (!envContent.includes(correctDbUrl)) {
    console.log('Обновляем DATABASE_URL с абсолютным путем...');
    
    // Заменяем или добавляем DATABASE_URL
    if (envContent.includes('DATABASE_URL=')) {
      envContent = envContent.replace(/DATABASE_URL=.*(\r?\n|$)/g, `${correctDbUrl}\n`);
    } else {
      envContent = `${correctDbUrl}\n${envContent}`;
    }
    
    fs.writeFileSync(envPath, envContent, 'utf8');
  }

  // Инициализируем базу данных с помощью Prisma
  console.log('Инициализируем базу данных с помощью Prisma...');
  execSync('npx prisma db push --force-reset', { stdio: 'inherit' });

  // Генерируем клиент Prisma
  console.log('Генерируем клиент Prisma...');
  execSync('npx prisma generate', { stdio: 'inherit' });

  // Перезапускаем приложение
  console.log('Перезапускаем приложение...');
  execSync('pm2 restart nextjs-app --update-env', { stdio: 'inherit' });

  console.log('Проверка и исправление файла базы данных завершены успешно!');
  console.log(`Путь к базе данных: ${absoluteDbPath}`);
  console.log('Проверьте логи приложения для подтверждения успешного подключения.');
} catch (error) {
  console.error('Произошла ошибка при проверке файла базы данных:', error);
  process.exit(1);
} 