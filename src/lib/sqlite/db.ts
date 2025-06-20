import sqlite3 from 'sqlite3';
import path from 'path';
import fs from 'fs';

// Путь к базе данных
const dbPath = path.resolve(process.cwd(), 'prisma', 'dev.db');

// Функция для получения соединения с базой данных
export function getDbConnection() {
  return new sqlite3.Database(dbPath, (err) => {
    if (err) {
      console.error('Ошибка при подключении к базе данных:', err.message);
    }
  });
}

// Функция для выполнения запроса
export async function executeQuery(query: string, params: any[] = []): Promise<any[]> {
  return new Promise((resolve, reject) => {
    const db = getDbConnection();
    
    db.all(query, params, (err, rows) => {
      if (err) {
        reject(err);
      } else {
        resolve(rows);
      }
      
      // Закрываем соединение
      db.close((closeErr) => {
        if (closeErr) {
          console.error('Ошибка при закрытии соединения:', closeErr.message);
        }
      });
    });
  });
}

// Функция для получения статистики парковки по идентификатору
export async function getParkingStats(parkingId: string): Promise<any[]> {
  const query = `
    SELECT timestamp, free_spaces, total_spaces 
    FROM parking_stats 
    WHERE parking_id = ? 
    ORDER BY timestamp DESC 
    LIMIT 100
  `;
  
  return executeQuery(query, [parkingId]);
}

// Функция для получения почасовой статистики парковки
export async function getHourlyStats(parkingId: string): Promise<any[]> {
  const query = `
    SELECT hour, free_spaces, total_spaces, date_updated 
    FROM hourly_parking_data 
    WHERE parking_id = ? 
    ORDER BY hour
  `;
  
  return executeQuery(query, [parkingId]);
}

// Функция для выполнения SQL-запроса
export async function query<T = any>(sql: string, params: any[] = []): Promise<T[]> {
  return new Promise((resolve, reject) => {
    // Проверяем существование базы
    if (!fs.existsSync(dbPath)) {
      return reject(new Error('База данных не найдена'));
    }

    const db = new sqlite3.Database(dbPath);
    
    db.all(sql, params, (err, rows) => {
      if (err) {
        db.close();
        return reject(err);
      }
      
      db.close();
      resolve(rows as T[]);
    });
  });
}

// Проверка подключения к базе данных
export async function checkConnection(): Promise<boolean> {
  try {
    if (!fs.existsSync(dbPath)) {
      return false;
    }
    
    await query('SELECT 1');
    return true;
  } catch (error) {
    console.error('Ошибка подключения к SQLite:', error);
    return false;
  }
} 