import { NextRequest, NextResponse } from "next/server";
import { Forecast } from "@/types/parking";
import { query, checkConnection } from "@/lib/sqlite/db";

// Cache responses for 30 minutes
const CACHE_TIME = 1800;
const cache = new Map<string, { data: any; timestamp: number }>();

interface ForecastData {
  parking_id: string;
  timestamp: string;
  expected_occupancy: number;
  expected_free_spaces: number;
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
    
    // Получение данных о прогнозах из SQLite
    const forecasts: ForecastData[] = await query<ForecastData>(
      `SELECT 
        parking_id, 
        timestamp, 
        expected_occupancy, 
        expected_free_spaces 
       FROM forecasts 
       WHERE parking_id = ? 
       ORDER BY timestamp 
       LIMIT 24`,
      [parkingId]
    );
    
    // Если данных нет, используем мок-данные
    if (!forecasts || forecasts.length === 0) {
      return generateMockResponse(parkingId, now);
    }
    
    // Форматирование данных для фронтенда
    const formattedForecasts: Forecast[] = forecasts.map((forecast) => ({
      timestamp: new Date(forecast.timestamp).toISOString(),
      expected_occupancy: forecast.expected_occupancy,
      expected_free_spaces: forecast.expected_free_spaces,
    }));

    const result = { forecasts: formattedForecasts };
    
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
    forecastDate.setHours(currentDate.getHours() + hour);
    
    // Определение шаблона заполненности на основе часа дня
    const hourOfDay = (currentDate.getHours() + hour) % 24;
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