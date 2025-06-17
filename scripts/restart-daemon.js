const { exec } = require('child_process');
const path = require('path');
const fs = require('fs');

console.log('Перезапуск демона для сбора статистики парковок...');

// Останавливаем существующий демон через PM2
exec('pm2 stop stats-daemon', (error, stdout, stderr) => {
  if (error) {
    console.error(`Ошибка остановки демона: ${error.message}`);
  }
  
  // Удаляем старые файлы прогнозов, так как структура изменилась
  const dbPath = path.resolve(process.cwd(), 'pb', 'bot_database.db');
  
  if (fs.existsSync(dbPath)) {
    // Создаем резервную копию базы данных
    const backupPath = path.resolve(process.cwd(), 'pb', `bot_database_backup_${Date.now()}.db`);
    fs.copyFileSync(dbPath, backupPath);
    console.log(`Создана резервная копия базы данных: ${backupPath}`);
  }

  // Запускаем демон заново с новой конфигурацией
  exec('pm2 start ecosystem.config.js --only stats-daemon', (error, stdout, stderr) => {
    if (error) {
      console.error(`Ошибка запуска демона: ${error.message}`);
      return;
    }
    
    console.log('Демон сбора статистики успешно перезапущен!');
    console.log('Новая система прогнозов активирована.');
    console.log('Сбор данных и обновление прогнозов теперь происходит каждый час.');
  });
}); 