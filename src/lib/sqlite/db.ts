import { Database } from 'sqlite3';
import path from 'path';
import fs from 'fs';

// Путь к базе данных SQLite
const dbPath = path.resolve(process.cwd(), 'pb', 'bot_database.db');

// Функция для выполнения SQL-запроса
export async function query<T = any>(sql: string, params: any[] = []): Promise<T[]> {
  return new Promise((resolve, reject) => {
    // Проверяем существование базы
    if (!fs.existsSync(dbPath)) {
      return reject(new Error('База данных не найдена'));
    }

    const db = new Database(dbPath);
    
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