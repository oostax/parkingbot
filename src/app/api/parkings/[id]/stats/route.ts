import { NextRequest, NextResponse } from "next/server";
import { ParkingStats } from "@/types/parking";
import { query, checkConnection } from "@/lib/sqlite/db";

// Cache responses for 6 hours
const CACHE_TIME = 21600; // seconds (6 hours)
const cache = new Map<string, { data: any; timestamp: number }>();

interface DailyStats {
  parkingId: string;
  hour: number;
  avgFreeSpaces: number;
  avg_occupancy: number;
}

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
      return generateMockResponse(parkingId, now);
    }
    
    // Получаем данные из SQLite
    const stats: DailyStats[] = await query<DailyStats>(
      `SELECT 
        parkingId, 
        hour, 
        avgFreeSpaces, 
        avg_occupancy 
       FROM daily_stats 
       WHERE parkingId = ? 
       ORDER BY hour`,
      [parkingId]
    );
    
    // Если данных нет, используем мок-данные
    if (!stats || stats.length === 0) {
      return generateMockResponse(parkingId, now);
    }
    
    // Формируем данные в нужном формате
    const formattedStats: ParkingStats[] = stats.map(stat => ({
      hour: stat.hour,
      avg_free_spaces: stat.avgFreeSpaces,
      avgFreeSpaces: stat.avgFreeSpaces,
      avg_occupancy: stat.avg_occupancy
    }));
    
    const result = { stats: formattedStats };
    
    // Update cache
    cache.set(parkingId, { data: result, timestamp: now });
    
    return NextResponse.json(result);
  } catch (error) {
    console.error(`Error fetching parking stats from SQLite: ${error}`);
    return NextResponse.json(
      { error: "Failed to fetch parking statistics" },
      { status: 500 }
    );
  }
}

// Функция генерации мок-данных как запасной вариант
function generateMockResponse(parkingId: string, now: number) {
  // Generate statistics based on parking ID to ensure consistent results
  const parkingIdNumber = parseInt(parkingId, 10) || 0;
  const stats: ParkingStats[] = [];
  
  // Seed for pseudo-random generation that's consistent for the same parking ID
  const seed = parkingIdNumber % 100;
  
  for (let hour = 0; hour < 24; hour++) {
    // Generate a pattern where early morning has more free spaces
    // and rush hours (8-10 AM, 5-7 PM) have fewer
    let baseAvailability = 0.7;
    
    // Morning rush hour: 8-10 AM
    if (hour >= 8 && hour <= 10) {
      baseAvailability = 0.3;
    }
    // Evening rush hour: 5-7 PM
    else if (hour >= 17 && hour <= 19) {
      baseAvailability = 0.2;
    }
    // Late night: more available spaces
    else if (hour >= 22 || hour <= 5) {
      baseAvailability = 0.9;
    }
    
    // Add some variation based on the parking ID
    const variation = ((seed * (hour + 1)) % 20) / 100; // +/- 10%
    let freePercentage = baseAvailability + variation - 0.1;
    
    // Ensure it's within bounds (0-1)
    freePercentage = Math.max(0.05, Math.min(0.95, freePercentage));
    
    // Assume total spaces is between 50-200 based on parking ID
    const totalSpaces = 50 + (parkingIdNumber % 150);
    const freeSpaces = Math.round(totalSpaces * freePercentage);
    const occupancy = 1 - freePercentage;
    
    stats.push({
      hour,
      avg_free_spaces: freeSpaces,
      avg_occupancy: occupancy,
    });
  }
  
  const result = { stats };
  
  // Update cache
  cache.set(parkingId, { data: result, timestamp: now });
  
  return NextResponse.json(result);
} 