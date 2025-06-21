/**
 * Универсальный скрипт для настройки базы данных SQLite
 * 
 * Этот скрипт выполняет следующие действия:
 * 1. Проверяет существование базы данных и создает ее при необходимости
 * 2. Создает все необходимые таблицы согласно схеме Prisma
 * 3. Очищает кэш Prisma
 * 4. Создает .env файл с правильным путем к базе данных
 */

const fs = require('fs');
const path = require('path');
const { execSync } = require('child_process');
const sqlite3 = require('sqlite3').verbose();

// Путь к файлу базы данных
const DB_PATH = path.join(__dirname, '../prisma/dev.db');
const ENV_PATH = path.join(__dirname, '../.env');

// Проверка и установка необходимых пакетов
function installDependencies() {
  console.log('Проверка и установка необходимых зависимостей...');
  
  try {
    // Проверяем, установлен ли sqlite3
    require('sqlite3');
    console.log('✅ sqlite3 уже установлен');
  } catch (err) {
    console.log('Устанавливаем sqlite3...');
    execSync('npm install sqlite3 --save', { stdio: 'inherit' });
    console.log('✅ sqlite3 успешно установлен');
  }
}

// Проверка существования директорий и создание их при необходимости
function ensureDirectoriesExist() {
  console.log('Проверка наличия необходимых директорий...');
  
  const prismaDir = path.join(__dirname, '../prisma');
  
  if (!fs.existsSync(prismaDir)) {
    console.log(`Создание директории: ${prismaDir}`);
    fs.mkdirSync(prismaDir, { recursive: true });
  }
  
  console.log('✅ Все необходимые директории существуют');
}

// Установка прав доступа к файлу базы данных
function fixDatabasePermissions() {
  console.log('Установка прав доступа к файлу базы данных...');
  
  try {
    if (fs.existsSync(DB_PATH)) {
      // Удаляем атрибут "только для чтения" на Windows
      if (process.platform === 'win32') {
        try {
          execSync(`attrib -R "${DB_PATH}"`, { stdio: 'inherit' });
        } catch (error) {
          console.warn(`Предупреждение: не удалось изменить атрибуты файла: ${error.message}`);
        }
      } else {
        // На Unix-системах устанавливаем права 666 (чтение и запись для всех)
        try {
          fs.chmodSync(DB_PATH, 0o666);
        } catch (error) {
          console.warn(`Предупреждение: не удалось изменить права доступа: ${error.message}`);
        }
      }
      console.log('✅ Права доступа к файлу базы данных установлены');
    }
  } catch (error) {
    console.error('❌ Ошибка при установке прав доступа к файлу базы данных:', error);
  }
}

// Создание или проверка базы данных
function setupDatabase() {
  console.log('Настройка базы данных...');
  
  // Удаляем файл базы данных, если он существует
  if (fs.existsSync(DB_PATH)) {
    try {
      fs.unlinkSync(DB_PATH);
      console.log(`Существующий файл базы данных удален: ${DB_PATH}`);
    } catch (error) {
      console.warn(`Предупреждение: не удалось удалить существующий файл базы данных: ${error.message}`);
      
      // Пытаемся изменить права доступа и повторить удаление
      try {
        fixDatabasePermissions();
        fs.unlinkSync(DB_PATH);
        console.log(`Существующий файл базы данных удален после изменения прав доступа: ${DB_PATH}`);
      } catch (innerError) {
        console.warn(`Предупреждение: не удалось удалить файл базы данных после изменения прав доступа: ${innerError.message}`);
      }
    }
  }
  
  // Создаем директорию для базы данных, если она не существует
  const dbDir = path.dirname(DB_PATH);
  if (!fs.existsSync(dbDir)) {
    fs.mkdirSync(dbDir, { recursive: true });
  }
  
  // Создаем новую базу данных
  try {
    // Создаем пустой файл
    fs.writeFileSync(DB_PATH, '');
    console.log(`Пустой файл базы данных создан: ${DB_PATH}`);
    
    // Устанавливаем права доступа
    fixDatabasePermissions();
    
    // Инициализируем базу данных SQLite
    const db = new sqlite3.Database(DB_PATH);
    db.close();
    console.log(`✅ База данных создана: ${DB_PATH}`);
  } catch (error) {
    console.error('❌ Ошибка при создании базы данных:', error);
    process.exit(1);
  }
}

// Создание .env файла с правильным путем к базе данных
function createEnvFile() {
  console.log('Создание .env файла с правильным путем к базе данных...');
  
  // Получаем абсолютный путь к проекту
  const projectRoot = path.resolve(__dirname, '..');
  
  // Формируем URL базы данных в зависимости от платформы
  let dbUrl;
  if (process.platform === 'win32') {
    // Для Windows используем формат с буквой диска и прямыми слешами
    dbUrl = `file:${DB_PATH.replace(/\\/g, '/')}`;
  } else {
    // Для Unix используем абсолютный путь
    dbUrl = `file:${DB_PATH}`;
  }
  
  // Содержимое .env файла
  const envContent = `# Автоматически сгенерировано скриптом setup-database.js
DATABASE_URL="${dbUrl}"
NEXTAUTH_SECRET="parkingbot_secure_secret_key_for_authentication_12345"
NEXTAUTH_URL="${process.platform === 'win32' ? 'http://localhost:3000' : 'https://mosparkingbot.ru'}"
TELEGRAM_BOT_TOKEN="7043413169:AAFLuLBvDqxCWh2dS-jndfiD5s-OHRs6s1A"
NEXT_PUBLIC_TELEGRAM_BOT_USERNAME="mosmetroparkingbot"
`;
  
  // Записываем файл
  try {
    fs.writeFileSync(ENV_PATH, envContent, { encoding: 'utf8' });
    console.log(`✅ .env файл создан: ${ENV_PATH}`);
  } catch (error) {
    console.error('❌ Ошибка при создании .env файла:', error);
  }
}

// Создание таблиц в базе данных
function createDatabaseTables() {
  console.log('Создание таблиц в базе данных...');
  
  try {
    const db = new sqlite3.Database(DB_PATH);
    
    // Создание таблицы User
    db.serialize(() => {
      // Создаем таблицу User
      db.run(`
        CREATE TABLE IF NOT EXISTS User (
          id TEXT PRIMARY KEY,
          username TEXT,
          firstName TEXT,
          lastName TEXT,
          createdAt TEXT DEFAULT CURRENT_TIMESTAMP,
          updatedAt TEXT DEFAULT CURRENT_TIMESTAMP,
          email TEXT UNIQUE,
          image TEXT,
          telegramId TEXT
        )
      `, (err) => {
        if (err) {
          console.error('❌ Ошибка при создании таблицы User:', err);
        } else {
          console.log('✅ Таблица User создана или уже существует');
        }
      });

      // Создаем таблицу UserProfile
      db.run(`
        CREATE TABLE IF NOT EXISTS UserProfile (
          id TEXT PRIMARY KEY,
          userId TEXT UNIQUE,
          tokenBalance INTEGER DEFAULT 0,
          status TEXT DEFAULT 'Regular',
          carModel TEXT,
          district TEXT,
          lastLoginAt TEXT DEFAULT CURRENT_TIMESTAMP,
          totalParksVisited INTEGER DEFAULT 0,
          uniqueParksVisited INTEGER DEFAULT 0,
          consecutiveLoginDays INTEGER DEFAULT 1,
          totalTokensEarned INTEGER DEFAULT 0,
          totalTokensSpent INTEGER DEFAULT 0,
          referralsCount INTEGER DEFAULT 0,
          challengesCompleted INTEGER DEFAULT 0,
          FOREIGN KEY (userId) REFERENCES User(id)
        )
      `, (err) => {
        if (err) {
          console.error('❌ Ошибка при создании таблицы UserProfile:', err);
        } else {
          console.log('✅ Таблица UserProfile создана или уже существует');
        }
      });

      // Создаем таблицу favorites
      db.run(`
        CREATE TABLE IF NOT EXISTS favorites (
          id INTEGER PRIMARY KEY AUTOINCREMENT,
          user_id TEXT NOT NULL,
          parking_id TEXT NOT NULL,
          timestamp TEXT DEFAULT CURRENT_TIMESTAMP,
          UNIQUE(user_id, parking_id)
        )
      `, (err) => {
        if (err) {
          console.error('❌ Ошибка при создании таблицы favorites:', err);
        } else {
          console.log('✅ Таблица favorites создана или уже существует');
        }
      });

      // Создаем таблицу parking_stats
      db.run(`
        CREATE TABLE IF NOT EXISTS parking_stats (
          id INTEGER PRIMARY KEY AUTOINCREMENT,
          parking_id TEXT NOT NULL,
          timestamp TEXT NOT NULL,
          free_spaces INTEGER NOT NULL,
          total_spaces INTEGER NOT NULL
        )
      `, (err) => {
        if (err) {
          console.error('❌ Ошибка при создании таблицы parking_stats:', err);
        } else {
          console.log('✅ Таблица parking_stats создана или уже существует');
        }
      });

      // Создаем таблицу hourly_parking_data
      db.run(`
        CREATE TABLE IF NOT EXISTS hourly_parking_data (
          id INTEGER PRIMARY KEY AUTOINCREMENT,
          parking_id TEXT NOT NULL,
          hour INTEGER NOT NULL,
          free_spaces INTEGER NOT NULL,
          total_spaces INTEGER NOT NULL,
          date_updated TEXT NOT NULL,
          UNIQUE(parking_id, hour)
        )
      `, (err) => {
        if (err) {
          console.error('❌ Ошибка при создании таблицы hourly_parking_data:', err);
        } else {
          console.log('✅ Таблица hourly_parking_data создана или уже существует');
        }
      });

      // Создаем остальные таблицы для геймификации
      db.run(`
        CREATE TABLE IF NOT EXISTS UserDistrict (
          id TEXT PRIMARY KEY,
          userId TEXT NOT NULL,
          district TEXT NOT NULL,
          UNIQUE(userId, district),
          FOREIGN KEY (userId) REFERENCES User(id)
        )
      `, (err) => {
        if (err) {
          console.error('❌ Ошибка при создании таблицы UserDistrict:', err);
        } else {
          console.log('✅ Таблица UserDistrict создана или уже существует');
        }
      });

      db.run(`
        CREATE TABLE IF NOT EXISTS Achievement (
          id TEXT PRIMARY KEY,
          userId TEXT NOT NULL,
          achievementId TEXT NOT NULL,
          earned INTEGER DEFAULT 0,
          earnedAt TEXT,
          UNIQUE(userId, achievementId),
          FOREIGN KEY (userId) REFERENCES User(id)
        )
      `, (err) => {
        if (err) {
          console.error('❌ Ошибка при создании таблицы Achievement:', err);
        } else {
          console.log('✅ Таблица Achievement создана или уже существует');
        }
      });

      db.run(`
        CREATE TABLE IF NOT EXISTS TokenTransaction (
          id TEXT PRIMARY KEY,
          userId TEXT NOT NULL,
          amount INTEGER NOT NULL,
          type TEXT NOT NULL,
          description TEXT NOT NULL,
          createdAt TEXT DEFAULT CURRENT_TIMESTAMP,
          FOREIGN KEY (userId) REFERENCES User(id)
        )
      `, (err) => {
        if (err) {
          console.error('❌ Ошибка при создании таблицы TokenTransaction:', err);
        } else {
          console.log('✅ Таблица TokenTransaction создана или уже существует');
        }
      });

      db.run(`
        CREATE TABLE IF NOT EXISTS Challenge (
          id TEXT PRIMARY KEY,
          title TEXT NOT NULL,
          description TEXT NOT NULL,
          reward INTEGER NOT NULL,
          startDate TEXT NOT NULL,
          endDate TEXT NOT NULL,
          isActive INTEGER DEFAULT 1,
          type TEXT NOT NULL,
          requirement INTEGER NOT NULL
        )
      `, (err) => {
        if (err) {
          console.error('❌ Ошибка при создании таблицы Challenge:', err);
        } else {
          console.log('✅ Таблица Challenge создана или уже существует');
          
          // Добавляем демо челленджи сразу после создания таблицы
          try {
            const { nanoid } = require('nanoid');
            
            // Текущая дата для стартовых дат
            const now = new Date();
            
            // Дата окончания через 7 дней
            const endDate = new Date();
            endDate.setDate(now.getDate() + 7);
            
            // Подготовка тестовых челленджей
            const challenges = [
              {
                id: nanoid(),
                title: "Посетить 5 парковок",
                description: "Посетите 5 разных парковок в течение недели и получите бонус",
                reward: 50,
                startDate: now.toISOString(),
                endDate: endDate.toISOString(),
                isActive: 1,
                type: "visit_parks",
                requirement: 5
              },
              {
                id: nanoid(),
                title: "Ежедневный вход",
                description: "Заходите в приложение 5 дней подряд",
                reward: 30,
                startDate: now.toISOString(),
                endDate: endDate.toISOString(),
                isActive: 1,
                type: "daily_login",
                requirement: 5
              },
              {
                id: nanoid(),
                title: "Пригласите друга",
                description: "Пригласите друга в приложение и получите бонус",
                reward: 100,
                startDate: now.toISOString(),
                endDate: endDate.toISOString(),
                isActive: 1,
                type: "invite_friends",
                requirement: 1
              }
            ];
            
            // Подготавливаем запрос для вставки
            const insertStatement = `
              INSERT OR REPLACE INTO Challenge 
              (id, title, description, reward, startDate, endDate, isActive, type, requirement) 
              VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
            `;
            
            // Вставляем каждый челлендж
            challenges.forEach(challenge => {
              db.run(insertStatement, [
                challenge.id,
                challenge.title,
                challenge.description,
                challenge.reward,
                challenge.startDate,
                challenge.endDate,
                challenge.isActive,
                challenge.type,
                challenge.requirement
              ], (err) => {
                if (err) {
                  console.error(`❌ Ошибка при добавлении челленджа "${challenge.title}":`, err);
                } else {
                  console.log(`✅ Челлендж "${challenge.title}" добавлен`);
                }
              });
            });
          } catch (error) {
            console.error('❌ Ошибка при добавлении демонстрационных челленджей:', error);
          }
        }
      });

      db.run(`
        CREATE TABLE IF NOT EXISTS ChallengeCompletion (
          id TEXT PRIMARY KEY,
          challengeId TEXT NOT NULL,
          userId TEXT NOT NULL,
          completedAt TEXT DEFAULT CURRENT_TIMESTAMP,
          UNIQUE(challengeId, userId),
          FOREIGN KEY (challengeId) REFERENCES Challenge(id)
        )
      `, (err) => {
        if (err) {
          console.error('❌ Ошибка при создании таблицы ChallengeCompletion:', err);
        } else {
          console.log('✅ Таблица ChallengeCompletion создана или уже существует');
        }
      });
    });
    
    db.close((err) => {
      if (err) {
        console.error('❌ Ошибка при закрытии соединения с базой данных:', err);
      } else {
        console.log('✅ Соединение с базой данных закрыто');
      }
    });
  } catch (error) {
    console.error('❌ Ошибка при создании таблиц:', error);
  }
}

// Очистка кэша Prisma
function clearPrismaCache() {
  console.log('Очистка кэша Prisma...');
  
  try {
    // Проверяем, установлен ли Prisma
    try {
      require('@prisma/client');
    } catch (err) {
      console.log('Prisma не установлен, пропускаем очистку кэша');
      return;
    }
    
    // На Windows могут быть проблемы с доступом к файлам Prisma
    // Поэтому обрабатываем ошибки и продолжаем работу
    try {
      execSync('npx prisma generate', { stdio: 'inherit' });
      console.log('✅ Кэш Prisma очищен');
    } catch (error) {
      console.warn(`⚠️ Предупреждение: не удалось очистить кэш Prisma: ${error.message}`);
      console.log('Продолжаем работу без очистки кэша Prisma');
    }
  } catch (error) {
    console.warn(`⚠️ Предупреждение: ошибка при очистке кэша Prisma: ${error}`);
  }
}

// Основная функция
async function main() {
  console.log('🚀 Запуск универсального скрипта настройки базы данных...');
  
  try {
    // Проверяем режим установки
    const installMode = process.argv[2];
    
    if (installMode === '--clean') {
      console.log('🧹 Режим чистой установки активирован');
      cleanInstall = true;
    }
    
    await ensureDirectoriesExist();
    await installDependencies();
    await fixDatabasePermissions();
    await setupDatabase();
    await createDatabaseTables(); // Создание таблиц и добавление демо-челленджей
    await createEnvFile();
    await clearPrismaCache();
    
    console.log('✅ Настройка проекта завершена успешно');
  } catch (error) {
    console.error('❌ Ошибка при настройке проекта:', error);
    process.exit(1);
  }
}

// Запуск скрипта
main(); 