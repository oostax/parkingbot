/**
 * Резервная реализация функций для работы с базой данных SQLite
 * Используется в случае, если основная реализация недоступна
 */

import { Database } from 'sqlite3';
import path from 'path';
import fs from 'fs';
import { DATABASE_PATH } from './env';

// Глобальная переменная для хранения соединения с базой данных
let dbInstance: Database | null = null;

/**
 * Получает абсолютный путь к файлу базы данных
 * @returns {string} Абсолютный путь к файлу базы данных
 */
export function getDatabaseFilePath(): string {
  const dbPath = path.resolve(process.cwd(), 'prisma/dev.db');
  return dbPath;
}

/**
 * Проверяет существование файла базы данных и создает директории при необходимости
 */
function ensureDatabaseFileExists(): void {
  const dbPath = getDatabaseFilePath();
  const dbDir = path.dirname(dbPath);
  
  // Создаем директорию, если она не существует
  if (!fs.existsSync(dbDir)) {
    console.log(`Создание директории для базы данных: ${dbDir}`);
    fs.mkdirSync(dbDir, { recursive: true });
  }
  
  // Проверяем существование файла базы данных
  if (!fs.existsSync(dbPath)) {
    console.log(`Файл базы данных не найден: ${dbPath}`);
    console.log('Создание пустого файла базы данных...');
    
    try {
      // Создаем пустой файл
      fs.writeFileSync(dbPath, '');
      console.log(`Пустой файл базы данных создан: ${dbPath}`);
    } catch (error) {
      console.error(`Ошибка при создании файла базы данных: ${error}`);
      throw new Error(`Не удалось создать файл базы данных: ${error}`);
    }
  }
  
  // Устанавливаем права доступа к файлу базы данных
  try {
    if (process.platform !== 'win32') {
      // На Unix-системах устанавливаем права 666 (чтение и запись для всех)
      fs.chmodSync(dbPath, 0o666);
    }
  } catch (error) {
    console.warn(`Предупреждение: не удалось установить права доступа к файлу базы данных: ${error}`);
  }
}

/**
 * Инициализирует соединение с базой данных
 * @returns {Database} Экземпляр соединения с базой данных
 */
export function getDb(): Database {
  if (dbInstance) {
    return dbInstance;
  }
  
  try {
    console.log('Инициализация резервного соединения с базой данных...');
    
    // Проверяем существование файла базы данных
    ensureDatabaseFileExists();
    
    const dbPath = getDatabaseFilePath();
    console.log(`Подключение к базе данных: ${dbPath}`);
    
    // Создаем экземпляр базы данных
    const sqlite3 = require('sqlite3').verbose();
    const db = new sqlite3.Database(dbPath, (err: Error | null) => {
      if (err) {
        console.error(`Ошибка при подключении к базе данных: ${err.message}`);
        throw err;
      }
      console.log('Успешное подключение к базе данных SQLite (резервное)');
    });
    
    // Настройка базы данных
    db.serialize(() => {
      // Включаем поддержку внешних ключей
      db.run('PRAGMA foreign_keys = ON');
      // Устанавливаем режим журнала WAL для лучшей производительности
      db.run('PRAGMA journal_mode = WAL');
    });
    
    dbInstance = db;
    return db;
  } catch (error) {
    console.error(`Критическая ошибка при инициализации резервной базы данных: ${error}`);
    throw new Error(`Не удалось инициализировать резервную базу данных: ${error}`);
  }
}

/**
 * Закрывает соединение с базой данных
 */
export function closeDb(): Promise<void> {
  return new Promise((resolve, reject) => {
    if (dbInstance) {
      dbInstance.close((err: Error | null) => {
        if (err) {
          console.error(`Ошибка при закрытии соединения с базой данных: ${err.message}`);
          reject(err);
        } else {
          console.log('Соединение с базой данных закрыто (резервное)');
          dbInstance = null;
          resolve();
        }
      });
    } else {
      console.log('Соединение с базой данных уже закрыто (резервное)');
      resolve();
    }
  });
}

/**
 * Выполняет SQL-запрос к базе данных
 * @param {string} sql SQL-запрос
 * @param {any[]} params Параметры запроса
 * @returns {Promise<any>} Результат запроса
 */
export function executeQuery(sql: string, params: any[] = []): Promise<any> {
  return new Promise((resolve, reject) => {
    const db = getDb();
    
    db.all(sql, params, (err: Error | null, rows: any[]) => {
      if (err) {
        console.error(`Ошибка при выполнении запроса: ${err.message}`);
        console.error(`SQL: ${sql}`);
        console.error(`Параметры: ${JSON.stringify(params)}`);
        reject(err);
      } else {
        resolve(rows);
      }
    });
  });
}

/**
 * Выполняет SQL-запрос, который не возвращает результат (INSERT, UPDATE, DELETE)
 * @param {string} sql SQL-запрос
 * @param {any[]} params Параметры запроса
 * @returns {Promise<{ lastID: number, changes: number }>} Информация о выполненном запросе
 */
export function executeRun(sql: string, params: any[] = []): Promise<{ lastID: number, changes: number }> {
  return new Promise((resolve, reject) => {
    const db = getDb();
    
    db.run(sql, params, function(this: { lastID: number, changes: number }, err: Error | null) {
      if (err) {
        console.error(`Ошибка при выполнении запроса: ${err.message}`);
        console.error(`SQL: ${sql}`);
        console.error(`Параметры: ${JSON.stringify(params)}`);
        reject(err);
      } else {
        resolve({ lastID: this.lastID, changes: this.changes });
      }
    });
  });
}

/**
 * Выполняет SQL-запрос и возвращает первую строку результата
 * @param {string} sql SQL-запрос
 * @param {any[]} params Параметры запроса
 * @returns {Promise<any>} Первая строка результата или null
 */
export function executeGet(sql: string, params: any[] = []): Promise<any> {
  return new Promise((resolve, reject) => {
    const db = getDb();
    
    db.get(sql, params, (err: Error | null, row: any) => {
      if (err) {
        console.error(`Ошибка при выполнении запроса: ${err.message}`);
        console.error(`SQL: ${sql}`);
        console.error(`Параметры: ${JSON.stringify(params)}`);
        reject(err);
      } else {
        resolve(row);
      }
    });
  });
}

/**
 * Выполняет несколько SQL-запросов в одной транзакции
 * @param {Function} callback Функция, выполняющая запросы в транзакции
 * @returns {Promise<any>} Результат выполнения транзакции
 */
export function executeTransaction<T>(callback: () => Promise<T>): Promise<T> {
  const db = getDb();
  
  return new Promise((resolve, reject) => {
    db.serialize(() => {
      db.run('BEGIN TRANSACTION');
      
      callback()
        .then((result) => {
          db.run('COMMIT', (err) => {
            if (err) {
              console.error(`Ошибка при фиксации транзакции: ${err.message}`);
              reject(err);
            } else {
              resolve(result);
            }
          });
        })
        .catch((error) => {
          db.run('ROLLBACK', (rollbackErr) => {
            if (rollbackErr) {
              console.error(`Ошибка при откате транзакции: ${rollbackErr.message}`);
            }
            reject(error);
          });
        });
    });
  });
}

/**
 * Обработчик ошибок Prisma
 * @param {unknown} error Ошибка Prisma
 */
export function handlePrismaError(error: unknown): void {
  // Проверяем тип ошибки по имени, чтобы избежать импорта типов Prisma
  if (error && typeof error === 'object' && 'name' in error && error.name === 'PrismaClientInitializationError') {
    console.error('\n=== DATABASE CONNECTION ERROR ===');
    console.error('Failed to connect to SQLite database. Please check:');
    console.error('1. Is the database file accessible and not corrupted?');
    console.error('2. Do you have proper permissions to read/write the database file?');
    console.error('3. Is the DATABASE_URL environment variable correct?');
    console.error('\nTo fix SQLite connection issues:');
    console.error('1. Check that the path to the database file is correct');
    console.error('2. Ensure the directory exists and has proper permissions');
    console.error('3. Try running the setup-database.js script to initialize the database');
    console.error('\n=== DATABASE URL ===');
    // Безопасный доступ к process.env на случай, если этот код импортируется на клиенте
  if (typeof process !== 'undefined' && process.env && process.env.DATABASE_URL) {
      console.error(`Current setting: ${process.env.DATABASE_URL}`);
  } else {
    console.error('DATABASE_URL is not set or not accessible!');
  }
    console.error('===========================\n');
  } else {
    console.error('Database error:', error);
  }
}

// Экспортируем экземпляр базы данных для использования в других модулях
export default {
  getDb,
  closeDb,
  query: executeQuery,
  run: executeRun,
  get: executeGet,
  transaction: executeTransaction,
  handlePrismaError
};

// Mock data for development when database is unavailable
export const mockParkingStats = (hour: number) => {
  return Array(24).fill(0).map((_, i) => ({
    hour: i,
    avgFreeSpaces: Math.floor(Math.random() * 100),
    avg_occupancy: Math.random() * 0.8 + 0.1,
    sampleCount: Math.floor(Math.random() * 100),
    lastUpdated: new Date()
  }));
}; 