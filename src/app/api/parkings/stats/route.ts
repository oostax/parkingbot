import { NextRequest, NextResponse } from "next/server";
import { query, checkConnection } from "@/lib/db";

// Cache responses for 15 minutes
const CACHE_TIME = 900; // seconds (15 minutes)
const cache: { data: any; timestamp: number } = { data: null, timestamp: 0 };

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
    
    // Get occupancy data for all parkings for the current hour from hourly_parking_data
    const hourlyStats = await query(
      `SELECT 
        parking_id as parkingId, 
        free_spaces as freeSpaces,
        total_spaces as totalSpaces
       FROM hourly_parking_data 
       WHERE hour = ?
       ORDER BY parking_id`,
      [currentHour]
    );
    
    // Format the data for easy consumption by the front-end
    const occupancyData = hourlyStats.reduce((acc, stat) => {
      // Рассчитываем заполненность (occupancy) на основе свободных и общих мест
      const occupancy = stat.totalSpaces > 0 
        ? 1 - (stat.freeSpaces / stat.totalSpaces) 
        : 0;
        
      acc[stat.parkingId] = {
        occupancy,
        freeSpaces: stat.freeSpaces,
      };
      return acc;
    }, {});
    
    // Update cache
    cache.data = { parkings: occupancyData };
    cache.timestamp = now;
    
    return NextResponse.json(cache.data);
  } catch (error) {
    console.error(`Error fetching all parking stats: ${error}`);
    return NextResponse.json(
      { error: "Failed to fetch parking statistics", parkings: {} },
      { status: 500 }
    );
  }
} 