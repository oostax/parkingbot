// Скрипт для обновления схемы Prisma на сервере
const fs = require('fs');
const path = require('path');
const { execSync } = require('child_process');

console.log('Обновление схемы Prisma для использования SQLite...');

// Путь к файлу schema.prisma
const schemaPath = path.resolve(process.cwd(), 'prisma', 'schema.prisma');

try {
  // Проверяем существование файла
  if (!fs.existsSync(schemaPath)) {
    console.error('Ошибка: Файл schema.prisma не найден по пути:', schemaPath);
    process.exit(1);
  }

  // Читаем содержимое файла
  const schemaContent = fs.readFileSync(schemaPath, 'utf8');
  
  // Проверяем текущий провайдер
  if (schemaContent.includes('provider = "postgresql"')) {
    console.log('Найден провайдер postgresql, меняем на sqlite...');
    
    // Заменяем postgresql на sqlite
    const updatedContent = schemaContent.replace(
      'provider = "postgresql"',
      'provider = "sqlite"'
    );
    
    // Записываем обновленное содержимое
    fs.writeFileSync(schemaPath, updatedContent, 'utf8');
    console.log('Схема Prisma успешно обновлена.');
    
    // Генерируем клиент Prisma
    console.log('Генерация клиента Prisma...');
    execSync('npx prisma generate', { stdio: 'inherit' });
    
    // Перезапускаем приложение
    console.log('Перезапуск приложения...');
    execSync('pm2 restart nextjs-app', { stdio: 'inherit' });
    
    console.log('Обновление завершено успешно!');
  } else {
    console.log('Провайдер уже настроен на sqlite, обновление не требуется.');
  }
} catch (error) {
  console.error('Произошла ошибка при обновлении схемы Prisma:', error);
  process.exit(1);
} 