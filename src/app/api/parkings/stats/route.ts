import { NextRequest, NextResponse } from "next/server";
import { query, checkConnection } from "@/lib/sqlite/db";

// Cache responses for 15 minutes
const CACHE_TIME = 900; // seconds (15 minutes)
const cache: { data: any; timestamp: number } = { data: null, timestamp: 0 };

interface DailyStats {
  parking_id: string;
  hour: number;
  avg_free_spaces: number;
  avg_occupancy: number;
}

export async function GET(request: NextRequest) {
  try {
    // Проверяем наличие параметра noCache в запросе
    const url = new URL(request.url);
    const noCache = url.searchParams.has('noCache');
    
    // Check cache first, если не передан параметр noCache
    const now = Math.floor(Date.now() / 1000);
    if (!noCache && cache.data && now - cache.timestamp < CACHE_TIME) {
      return NextResponse.json(cache.data);
    }

    // Проверяем подключение к SQLite
    const isConnected = await checkConnection();
    if (!isConnected) {
      console.error("SQLite connection failed");
      return NextResponse.json(
        { error: "Database connection failed", parkings: {} },
        { status: 500 }
      );
    }

    // Get the current hour
    const currentHour = new Date().getHours();
    
    // Get occupancy data for all parkings for the current hour from SQLite
    const stats: DailyStats[] = await query<DailyStats>(
      `SELECT 
        parking_id, 
        hour, 
        avg_free_spaces, 
        avg_occupancy 
       FROM daily_stats 
       WHERE hour = ?
       ORDER BY parking_id`,
      [currentHour]
    );
    
    // Format the data for easy consumption by the front-end
    const occupancyData = stats.reduce((acc, stat) => {
      acc[stat.parking_id] = {
        occupancy: stat.avg_occupancy,
        freeSpaces: stat.avg_free_spaces,
      };
      return acc;
    }, {} as Record<string, { occupancy: number, freeSpaces: number }>);
    
    // Update cache
    cache.data = { parkings: occupancyData };
    cache.timestamp = now;
    
    return NextResponse.json(cache.data);
  } catch (error) {
    console.error(`Error fetching all parking stats from SQLite: ${error}`);
    return NextResponse.json(
      { error: "Failed to fetch parking statistics", parkings: {} },
      { status: 500 }
    );
  }
} 