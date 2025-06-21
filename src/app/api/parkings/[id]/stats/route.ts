import { NextRequest, NextResponse } from "next/server";
import { ParkingStats } from "@/types/parking";
import { query, checkConnection } from "@/lib/db";

// Cache responses for 6 hours
const CACHE_TIME = 21600; // seconds (6 hours)
const cache = new Map<string, { data: any; timestamp: number }>();

export async function GET(
  request: NextRequest,
  context: { params: { id: string } }
) {
  try {
    // Get the id and await it according to Next.js requirement
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

    // Проверяем подключение к SQLite
    const isConnected = await checkConnection();
    if (!isConnected) {
      console.error("SQLite connection failed");
      return NextResponse.json(
        { error: "Database connection failed" },
        { status: 500 }
      );
    }
    
    // Получаем данные из таблицы hourly_parking_data
    const hourlyStats = await query(
      `SELECT 
        hour, 
        free_spaces as avgFreeSpaces,
        total_spaces as totalSpaces
       FROM hourly_parking_data 
       WHERE parking_id = ? 
       ORDER BY hour`,
      [parkingId]
    );
    
    // Если данных нет, возвращаем пустой массив
    if (!hourlyStats || hourlyStats.length === 0) {
      return NextResponse.json({ stats: [] });
    }
    
    // Формируем данные в нужном формате
    const formattedStats: ParkingStats[] = hourlyStats.map(stat => {
      // Рассчитываем заполненность (occupancy) на основе свободных и общих мест
      const occupancy = stat.totalSpaces > 0 
        ? 1 - (stat.avgFreeSpaces / stat.totalSpaces) 
        : 0;
        
      return {
        hour: stat.hour,
        avg_free_spaces: stat.avgFreeSpaces,
        avg_occupancy: occupancy
      };
    });
    
    const result = { stats: formattedStats };
    
    // Update cache
    cache.set(parkingId, { data: result, timestamp: now });
    
    return NextResponse.json(result);
  } catch (error) {
    console.error(`Error fetching parking stats: ${error}`);
    return NextResponse.json(
      { error: "Failed to fetch parking statistics" },
      { status: 500 }
    );
  }
} 