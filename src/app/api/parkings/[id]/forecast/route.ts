import { NextRequest, NextResponse } from "next/server";
import { Forecast } from "@/types/parking";
import { query, checkConnection } from "@/lib/db";

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

// Определяем типы параметров
type RouteParams = { id: string };

export async function GET(
  request: NextRequest, 
  context: { params: RouteParams }
): Promise<Response> {
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
      return NextResponse.json(
        { error: "Database connection failed" },
        { status: 500 }
      );
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
    
    // Если данных нет, возвращаем ошибку
    if (!hourlyData || hourlyData.length === 0) {
      console.log(`No hourly data found for parking ${parkingId}`);
      return NextResponse.json(
        { error: "No forecast data available for this parking" },
        { status: 404 }
      );
    }
    
    console.log(`Found ${hourlyData.length} hourly records for parking ${parkingId}`);
    
    // Проверяем, что данные разные для разных часов
    const uniqueFreeSpaces = new Set(hourlyData.map(data => data.free_spaces));
    console.log(`Unique free spaces values: ${Array.from(uniqueFreeSpaces).join(', ')}`);
    
    // Используем текущий час в Москве (локальное время уже является московским)
    const now_date = new Date();
    const currentHour = now_date.getHours();
    
    console.log(`Текущий час в Москве: ${currentHour}:00`);
    
    // Форматирование данных для фронтенда в формате прогнозов
    const formattedForecasts: Forecast[] = hourlyData.map((hourData) => {
      // Создаем дату и устанавливаем час на основе данных из БД
      const forecastDate = new Date();
      forecastDate.setHours(hourData.hour, 0, 0, 0);
      
      // Рассчитываем заполненность
      const occupancy = hourData.total_spaces > 0 
        ? 1 - (hourData.free_spaces / hourData.total_spaces) 
        : 0.5;
      
      // Проверяем, что значения корректны
      const freeSpaces = typeof hourData.free_spaces === 'number' && !isNaN(hourData.free_spaces) 
        ? Math.max(0, Math.min(hourData.total_spaces, hourData.free_spaces)) 
        : 0;

      return {
        timestamp: forecastDate.toISOString(),
        expected_occupancy: occupancy,
        expected_free_spaces: freeSpaces,
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