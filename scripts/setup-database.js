/**
 * Универсальный скрипт для настройки базы данных SQLite
 * 
 * Этот скрипт выполняет следующие действия:
 * 1. Проверяет существование базы данных и создает ее при необходимости
 * 2. Создает все необходимые таблицы согласно схеме Prisma
 * 3. Очищает кэш Prisma
 */

const fs = require('fs');
const path = require('path');
const { execSync } = require('child_process');
const sqlite3 = require('sqlite3').verbose();

// Путь к файлу базы данных
const DB_PATH = path.join(__dirname, '../prisma/dev.db');

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

// Создание или проверка базы данных
function setupDatabase() {
  console.log('Настройка базы данных...');
  
  // Проверяем, существует ли уже файл базы данных
  if (!fs.existsSync(DB_PATH)) {
    console.log('Создание новой базы данных...');
    const db = new sqlite3.Database(DB_PATH);
    db.close();
    console.log(`✅ База данных создана: ${DB_PATH}`);
  } else {
    console.log(`✅ База данных уже существует: ${DB_PATH}`);
  }
}

// Создание таблиц в базе данных
function createDatabaseTables() {
  console.log('Создание таблиц в базе данных...');
  
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

    // Создаем таблицу daily_stats
    db.run(`
      CREATE TABLE IF NOT EXISTS daily_stats (
        id TEXT PRIMARY KEY,
        parkingId TEXT NOT NULL,
        hour INTEGER NOT NULL,
        avgFreeSpaces REAL NOT NULL,
        avg_occupancy REAL NOT NULL,
        sampleCount INTEGER NOT NULL,
        lastUpdated TEXT NOT NULL,
        UNIQUE(parkingId, hour)
      )
    `, (err) => {
      if (err) {
        console.error('❌ Ошибка при создании таблицы daily_stats:', err);
      } else {
        console.log('✅ Таблица daily_stats создана или уже существует');
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
}

// Очистка кэша Prisma
function clearPrismaCache() {
  console.log('Очистка кэша Prisma...');
  
  try {
    execSync('npx prisma generate', { stdio: 'inherit' });
    console.log('✅ Кэш Prisma очищен');
  } catch (error) {
    console.error('❌ Ошибка при очистке кэша Prisma:', error);
  }
}

// Основная функция
async function main() {
  console.log('🚀 Запуск универсального скрипта настройки базы данных...');
  
  try {
    installDependencies();
    ensureDirectoriesExist();
    setupDatabase();
    createDatabaseTables();
    clearPrismaCache();
    
    console.log('✅ Настройка базы данных успешно завершена!');
  } catch (error) {
    console.error('❌ Произошла ошибка при настройке базы данных:', error);
    process.exit(1);
  }
}

// Запуск скрипта
main(); 