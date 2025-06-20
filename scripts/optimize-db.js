const sqlite3 = require('sqlite3').verbose();
const path = require('path');
const fs = require('fs');
const os = require('os');

// Путь к базе данных
const dbPath = path.resolve(process.cwd(), 'prisma', 'dev.db');

console.log(`Оптимизация базы данных: ${dbPath}`);

// Проверяем существование файла базы данных
if (!fs.existsSync(dbPath)) {
  console.error(`Ошибка: файл базы данных не найден: ${dbPath}`);
  process.exit(1);
}

// Создаем резервную копию
const backupPath = `${dbPath}.backup`;
try {
  fs.copyFileSync(dbPath, backupPath);
  console.log(`Резервная копия создана: ${backupPath}`);
} catch (error) {
  console.error(`Ошибка создания резервной копии: ${error.message}`);
  process.exit(1);
}

// Открываем базу данных
const db = new sqlite3.Database(dbPath, (err) => {
  if (err) {
    console.error(`Ошибка открытия базы данных: ${err.message}`);
    process.exit(1);
  }
  
  console.log('Соединение с базой данных установлено');
  
  // Выполняем VACUUM для сжатия базы данных
  db.run('VACUUM', function(err) {
    if (err) {
      console.error(`Ошибка при выполнении VACUUM: ${err.message}`);
    } else {
      console.log('VACUUM выполнен успешно');
    }
    
    // Анализируем базу данных
    db.run('ANALYZE', function(err) {
      if (err) {
        console.error(`Ошибка при выполнении ANALYZE: ${err.message}`);
      } else {
        console.log('ANALYZE выполнен успешно');
      }
      
      // Оптимизируем индексы
      db.run('PRAGMA optimize', function(err) {
        if (err) {
          console.error(`Ошибка при выполнении PRAGMA optimize: ${err.message}`);
        } else {
          console.log('Оптимизация индексов выполнена успешно');
        }
        
        // Получаем информацию о размере базы данных
        const stats = fs.statSync(dbPath);
        const fileSizeMB = stats.size / (1024 * 1024);
        console.log(`Размер базы данных: ${fileSizeMB.toFixed(2)} МБ`);
        
        // Получаем количество записей в основных таблицах
        db.get("SELECT COUNT(*) as count FROM parking_stats", (err, row) => {
          if (err) {
            console.error(`Ошибка при подсчете записей в parking_stats: ${err.message}`);
          } else {
            console.log(`Количество записей в parking_stats: ${row.count}`);
          }
          
          db.get("SELECT COUNT(*) as count FROM hourly_parking_data", (err, row) => {
            if (err) {
              console.error(`Ошибка при подсчете записей в hourly_parking_data: ${err.message}`);
            } else {
              console.log(`Количество записей в hourly_parking_data: ${row.count}`);
            }
            
            db.get("SELECT COUNT(*) as count FROM favorites", (err, row) => {
              if (err) {
                console.error(`Ошибка при подсчете записей в favorites: ${err.message}`);
              } else {
                console.log(`Количество записей в favorites: ${row.count}`);
              }
              
              // Очистка старых данных (старше 30 дней)
              const thirtyDaysAgo = new Date();
              thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);
              const thirtyDaysAgoStr = thirtyDaysAgo.toISOString();
              
              db.run("DELETE FROM parking_stats WHERE timestamp < ?", [thirtyDaysAgoStr], function(err) {
                if (err) {
                  console.error(`Ошибка при очистке старых данных: ${err.message}`);
                } else {
                  console.log(`Удалено ${this.changes} старых записей из parking_stats`);
                }
                
                // Закрываем соединение с базой данных
                db.close((err) => {
                  if (err) {
                    console.error(`Ошибка закрытия базы данных: ${err.message}`);
                  } else {
                    console.log('Соединение с базой данных закрыто');
                    console.log('Оптимизация базы данных завершена');
                  }
                });
              });
            });
          });
        });
      });
    });
  });
}); 