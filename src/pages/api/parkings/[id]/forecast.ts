import { NextApiRequest, NextApiResponse } from 'next';
import path from 'path';
import fs from 'fs';
import sqlite3 from 'sqlite3';
// Изменяем импорт для решения проблемы с модулем sqlite
import { Database } from 'sqlite3';

// Определение интерфейсов
interface Forecast {
  parking_id: string;
  timestamp: string;
  expected_occupancy: number;
  expected_free_spaces: number;
}

export default async function handler(
  req: NextApiRequest,
  res: NextApiResponse
) {
  try {
    // Проверяем наличие ID парковки в запросе
    const { id } = req.query;
    
    if (!id || Array.isArray(id)) {
      return res.status(400).json({ error: 'Invalid parking ID' });
    }
    
    // Путь к файлу базы данных
    const dbPath = path.join(process.cwd(), 'pb', 'bot_database.db');
    
    // Проверяем существование базы данных
    if (!fs.existsSync(dbPath)) {
      return res.status(500).json({ 
        error: 'Database not found',
        forecasts: [] 
      });
    }
    
    // Открываем соединение с базой данных напрямую через sqlite3
    const db = new Promise<Database>((resolve, reject) => {
      const database = new Database(dbPath, (err) => {
        if (err) reject(err);
        else resolve(database);
      });
    });
    
    // Извлекаем параметр hour из запроса, если он есть
    let targetHour: number | null = null;
    if (req.query.hour && !Array.isArray(req.query.hour)) {
      targetHour = parseInt(req.query.hour);
      if (isNaN(targetHour) || targetHour < 0 || targetHour > 23) {
        targetHour = null;
      }
    }
    
    // Загружаем данные о парковке для получения общего количества мест
    let totalSpaces = 0;
    try {
      // Загружаем информацию о парковке из локальных данных
      const parkingDataPath = path.join(process.cwd(), 'public', 'data', 'parking_data.json');
      const parkingData = JSON.parse(fs.readFileSync(parkingDataPath, 'utf8'));
      const parkingInfo = parkingData.find((parking: any) => parking.id === id);
      if (parkingInfo && parkingInfo.spaces && parkingInfo.spaces.overall) {
        totalSpaces = parkingInfo.spaces.overall.total || 0;
      }
    } catch (error) {
      console.error('Ошибка загрузки данных о парковке:', error);
    }
    
    // Определяем, какие данные нам нужно загрузить
    let forecasts: Forecast[] = [];
    let query = '';
    let params: any[] = [];
    
    if (targetHour !== null) {
      // Если запрошен конкретный час, получаем данные только для него
      query = `
        SELECT 
          parking_id,
          datetime('now', 'start of day', '+' || hour || ' hours') as timestamp,
          1 - (free_spaces * 1.0 / total_spaces) as expected_occupancy,
          free_spaces as expected_free_spaces
        FROM hourly_parking_data 
        WHERE parking_id = ? AND hour = ?
      `;
      params = [id, targetHour];
    } else {
      // Иначе получаем данные для всех часов
      // Текущее время (часы)
      const currentHour = new Date().getHours();
      
      // Запрос к таблице hourly_parking_data для всех часов
      query = `
        SELECT 
          parking_id,
          datetime('now', 'start of day', '+' || hour || ' hours') as timestamp,
          1 - (free_spaces * 1.0 / total_spaces) as expected_occupancy,
          free_spaces as expected_free_spaces
        FROM hourly_parking_data 
        WHERE parking_id = ?
        ORDER BY hour ASC
      `;
      params = [id];
    }
    
    try {
      const database = await db;
      
      // Используем промис для выполнения запроса
      const rows = await new Promise<any[]>((resolve, reject) => {
        database.all(query, params, (err, rows) => {
          if (err) reject(err);
          else resolve(rows || []);
        });
      });
      
      forecasts = rows.map(row => ({
        parking_id: row.parking_id,
        timestamp: row.timestamp,
        expected_occupancy: parseFloat(row.expected_occupancy.toFixed(2)),
        expected_free_spaces: Math.round(row.expected_free_spaces)
      }));
      
      // Если не нашли данные в hourly_parking_data, создаём базовый прогноз
      if (forecasts.length === 0 && totalSpaces > 0) {
        // Генерируем базовые прогнозы для всех часов
        const hours = targetHour !== null ? [targetHour] : Array.from({length: 24}, (_, i) => i);
        
        forecasts = hours.map(hour => {
          // Определяем коэффициент заполненности в зависимости от часа
          // Ночью (22-6) - мало машин (20% занято)
          // Утром (7-10) и вечером (17-21) - пик (80% занято)
          // Днем (11-16) - средне (50% занято)
          let occupancyRate = 0.5; // По умолчанию 50% занято
          
          if (hour >= 22 || hour < 7) {
            occupancyRate = 0.2; // Ночью 20% занято
          } else if ((hour >= 7 && hour <= 10) || (hour >= 17 && hour <= 21)) {
            occupancyRate = 0.8; // В час пик 80% занято
          }
          
          const freeSpaces = Math.round(totalSpaces * (1 - occupancyRate));
          
          // Создаем метку времени для прогноза
          const now = new Date();
          const forecastDate = new Date(now);
          forecastDate.setHours(hour, 0, 0, 0);
          
          return {
            parking_id: id,
            timestamp: forecastDate.toISOString(),
            expected_occupancy: occupancyRate,
            expected_free_spaces: freeSpaces
          };
        });
      }
      
      // Закрываем соединение с базой данных
      database.close();
    } catch (error) {
      console.error('Ошибка запроса к базе данных:', error);
    }
    
    // Возвращаем результат
    res.status(200).json({ 
      forecasts,
      targetHour
    });
    
  } catch (error) {
    console.error('Error in forecast API:', error);
    res.status(500).json({ 
      error: 'Failed to fetch forecast data',
      forecasts: []
    });
  }
} 