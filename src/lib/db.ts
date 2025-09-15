// Проверка, что код выполняется на сервере
const isServer = typeof window === 'undefined';

// Import prisma client from prisma.ts
import { prisma } from './prisma';

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
    console.log('Инициализация соединения с базой данных...');
    
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
      console.log('Успешное подключение к базе данных SQLite');
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
    console.error(`Критическая ошибка при инициализации базы данных: ${error}`);
    throw new Error(`Не удалось инициализировать базу данных: ${error}`);
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
          console.log('Соединение с базой данных закрыто');
          dbInstance = null;
          resolve();
        }
      });
    } else {
      console.log('Соединение с базой данных уже закрыто');
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

// Экспортируем экземпляр базы данных для использования в других модулях
export default {
  getDb,
  closeDb,
  query: executeQuery,
  run: executeRun,
  get: executeGet,
  transaction: executeTransaction
};

// Функция для выполнения SQL-запроса с возвратом результатов
export async function query<T = any>(sql: string, params: any[] = []): Promise<T[]> {
  if (!isServer) {
    console.warn('Database queries can only be executed on the server');
    return [];
  }
  
  try {
    // Use the imported prisma client
    return await prisma.$queryRawUnsafe(sql, ...params) as T[];
  } catch (error) {
    console.error('Error executing query:', error);
    throw error;
  }
}

// Функция для выполнения SQL-запроса без возврата данных
export async function execute(sql: string, params: any[] = []): Promise<void> {
  if (!isServer) {
    console.warn('Database operations can only be executed on the server');
    return;
  }
  
  try {
    await prisma.$executeRawUnsafe(sql, ...params);
  } catch (error) {
    console.error('Error executing statement:', error);
    throw error;
  }
}

// Функция для обновления почасовых данных парковки
export async function updateHourlyParkingData(
  parkingId: string, 
  hour: number, 
  freeSpaces: number, 
  totalSpaces: number
): Promise<void> {
  if (!isServer) {
    console.warn('Database operations can only be executed on the server');
    return;
  }
  
  const today = new Date().toISOString().split('T')[0]; // Формат YYYY-MM-DD
  
  try {
    await prisma.hourly_parking_data.upsert({
      where: {
        parking_id_hour: {
          parking_id: parkingId,
          hour: hour
        }
      },
      update: {
        free_spaces: freeSpaces,
        total_spaces: totalSpaces,
        date_updated: new Date(today)
      },
      create: {
        parking_id: parkingId,
        hour: hour,
        free_spaces: freeSpaces,
        total_spaces: totalSpaces,
        date_updated: new Date(today)
      }
    });
    
    console.log(`Обновлены данные парковки ${parkingId} для часа ${hour}: ${freeSpaces}/${totalSpaces}`);
  } catch (error) {
    console.error(`Ошибка обновления данных парковки ${parkingId}:`, error);
    throw error;
  }
}

// Функция для записи состояния парковки
export async function recordParkingState(
  parkingId: string, 
  freeSpaces: number, 
  totalSpaces: number
): Promise<void> {
  if (!isServer) {
    console.warn('Database operations can only be executed on the server');
    return;
  }
  
  const timestamp = new Date();
  
  try {
    // Записываем в parking_stats
    await prisma.parking_stats.create({
      data: {
        parking_id: parkingId,
        timestamp: timestamp,
        free_spaces: freeSpaces,
        total_spaces: totalSpaces
      }
    });
    
    // Обновляем hourly_parking_data для текущего часа
    const currentHour = new Date().getHours();
    await updateHourlyParkingData(parkingId, currentHour, freeSpaces, totalSpaces);
    
  } catch (error) {
    console.error(`Ошибка записи состояния парковки ${parkingId}:`, error);
    throw error;
  }
}

// Функция для очистки устаревших данных
export async function cleanupOldData(): Promise<void> {
  if (!isServer) {
    console.warn('Database operations can only be executed on the server');
    return;
  }
  
  try {
    // Удаляем записи старше 7 дней
    const retentionDate = new Date();
    retentionDate.setDate(retentionDate.getDate() - 7);
    
    await prisma.parking_stats.deleteMany({
      where: {
        timestamp: {
          lt: retentionDate
        }
      }
    });
    
    console.log('Очистка устаревших данных выполнена');
  } catch (error) {
    console.error('Ошибка при очистке устаревших данных:', error);
  }
}

// Проверка подключения к базе данных
export async function checkConnection(): Promise<boolean> {
  if (!isServer) {
    console.warn('Database operations can only be executed on the server');
    return false;
  }
  
  try {
    // Проверяем, настроена ли переменная среды
    if (!process.env.DATABASE_URL) {
      console.error('DATABASE_URL environment variable is not set!');
      return false;
    }
    
    // Простой запрос для проверки соединения
    await prisma.$queryRaw`SELECT 1 as result`;
    console.log('Database connection successful');
    return true;
  } catch (error) {
    // Обрабатываем ошибку без fallback
    console.error('Database connection failed:', error);
    return false;
  }
}

// Инициализация базы данных
export async function initializeDatabase(): Promise<void> {
  if (!isServer) {
    console.warn('Database operations can only be executed on the server');
    return;
  }
  
  try {
    console.log('Инициализация базы данных...');
    
    // Проверяем соединение
    const isConnected = await checkConnection();
    if (isConnected) {
      console.log('База данных успешно инициализирована');
    } else {
      throw new Error('Не удалось подключиться к базе данных');
    }
  } catch (error) {
    console.error('Ошибка при инициализации базы данных:', error);
    throw error;
  }
} 