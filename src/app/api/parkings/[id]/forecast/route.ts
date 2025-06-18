import { NextRequest, NextResponse } from "next/server";
import { Forecast } from "@/types/parking";
import { query, checkConnection } from "@/lib/sqlite/db";

// Уменьшаем время кэширования до 5 минут, чтобы чаще обновлять данные
const CACHE_TIME = 300;
const cache = new Map<string, { data: any; timestamp: number }>();

interface HourlyParkingData {
  parking_id: string;
  hour: number;
  free_spaces: number;
  total_spaces: number;
  date_updated: string;
}

export async function GET(
  request: NextRequest,
  context: { params: { id: string } }
) {
  try {
    const params = await context.params;
    const parkingId = params.id;
    
    // Проверяем наличие параметра noCache в запросе
    const url = new URL(request.url);
    const noCache = url.searchParams.has('noCache');
    
    // Check cache first, если не передан параметр noCache
    const now = Math.floor(Date.now() / 1000);
    const cachedResponse = cache.get(parkingId);
    if (!noCache && cachedResponse && now - cachedResponse.timestamp < CACHE_TIME) {
      return NextResponse.json(cachedResponse.data);
    }

    // Проверка подключения к SQLite
    const isConnected = await checkConnection();
    if (!isConnected) {
      console.error("SQLite connection failed");
      return generateMockResponse(parkingId, now);
    }
    
    // Получение почасовых данных из таблицы hourly_parking_data
    const hourlyData: HourlyParkingData[] = await query<HourlyParkingData>(
      `SELECT 
        parking_id, 
        hour, 
        free_spaces, 
        total_spaces,
        date_updated
       FROM hourly_parking_data 
       WHERE parking_id = ? 
       ORDER BY hour`,
      [parkingId]
    );
    
    // Если данных нет, используем мок-данные
    if (!hourlyData || hourlyData.length === 0) {
      console.log(`No hourly data found for parking ${parkingId}, using mock data`);
      return generateMockResponse(parkingId, now);
    }
    
    console.log(`Found ${hourlyData.length} hourly records for parking ${parkingId}`);
    
    // Используем текущий час в Москве (UTC+3)
    const now_date = new Date();
    const moscowNow = new Date(now_date.getTime() + 3 * 60 * 60 * 1000);
    const currentHour = moscowNow.getUTCHours();
    
    // Форматирование данных для фронтенда в формате прогнозов
    const formattedForecasts: Forecast[] = hourlyData.map((hourData) => {
      // Создаем дату и устанавливаем час на основе данных из БД
      const forecastDate = new Date();
      forecastDate.setHours(hourData.hour, 0, 0, 0);
      
      // Рассчитываем заполненность
      const occupancy = hourData.total_spaces > 0 
        ? 1 - (hourData.free_spaces / hourData.total_spaces) 
        : 0.5;

      return {
        timestamp: forecastDate.toISOString(),
        expected_occupancy: occupancy,
        expected_free_spaces: hourData.free_spaces,
        hour: hourData.hour, // Добавляем час для отладки
        currentHour, // Добавляем текущий час для отладки
      };
    });

    // Сортируем прогнозы по часам, начиная с текущего часа
    formattedForecasts.sort((a, b) => {
      const hourA = new Date(a.timestamp).getHours();
      const hourB = new Date(b.timestamp).getHours();
      
      // Вычисляем "расстояние" от текущего часа
      const distA = (hourA - currentHour + 24) % 24;
      const distB = (hourB - currentHour + 24) % 24;
      
      return distA - distB;
    });

    const result = { 
      forecasts: formattedForecasts,
      meta: {
        currentHour,
        dataPoints: hourlyData.length,
        lastUpdated: hourlyData[0]?.date_updated || new Date().toISOString()
      }
    };
    
    // Обновление кэша
    cache.set(parkingId, { data: result, timestamp: now });
    
    return NextResponse.json(result);
  } catch (error) {
    console.error(`Error fetching parking forecasts from SQLite: ${error}`);
    return NextResponse.json(
      { error: "Failed to fetch parking forecasts" },
      { status: 500 }
    );
  }
}

// Функция для генерации мок-данных как запасной вариант
function generateMockResponse(parkingId: string, now: number) {
  // Создаем прогнозы на основе ID парковки для обеспечения стабильных результатов
  const parkingIdNumber = parseInt(parkingId, 10) || 0;
  const forecasts: Forecast[] = [];
  
  // Базовый паттерн заполнения
  const basePatterns = [
    0.7, 0.65, 0.6, 0.55, 0.5, 0.55, // ночь-утро
    0.6, 0.7, 0.8, 0.7, 0.65, 0.7,  // утро-день
    0.75, 0.8, 0.85, 0.9, 0.85, 0.75, // день-вечер
    0.65, 0.6, 0.65, 0.7, 0.75, 0.7, // вечер-ночь
  ];
  
  // Генерация прогнозов на 24 часа вперед
  const currentDate = new Date();
  const seed = parkingIdNumber % 100;
  const totalSpaces = 50 + (parkingIdNumber % 150);
  
  for (let hour = 0; hour < 24; hour++) {
    const forecastDate = new Date(currentDate);
    forecastDate.setHours(hour);
    
    // Определение шаблона заполненности на основе часа дня
    const hourOfDay = hour % 24;
    const baseOccupancy = basePatterns[hourOfDay];
    
    // Добавление вариации на основе ID парковки
    const variation = ((seed * (hour + 1)) % 20) / 100; // +/- 10%
    let occupancy = baseOccupancy + variation - 0.1;
    
    // Обеспечение нахождения в пределах [0.05, 0.95]
    occupancy = Math.max(0.05, Math.min(0.95, occupancy));
    const freeSpaces = Math.round(totalSpaces * (1 - occupancy));
    
    forecasts.push({
      timestamp: forecastDate.toISOString(),
      expected_occupancy: occupancy,
      expected_free_spaces: freeSpaces,
    });
  }
  
  const result = { forecasts };
  
  // Обновление кэша
  cache.set(parkingId, { data: result, timestamp: now });
  
  return NextResponse.json(result);
} 