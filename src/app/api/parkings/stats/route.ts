import { NextRequest, NextResponse } from "next/server";
import prisma from "@/lib/prisma";

// Cache responses for 15 minutes
const CACHE_TIME = 900; // seconds (15 minutes)
const cache: { data: any; timestamp: number } = { data: null, timestamp: 0 };

export async function GET(request: NextRequest) {
  try {
    // Check cache first
    const now = Math.floor(Date.now() / 1000);
    if (cache.data && now - cache.timestamp < CACHE_TIME) {
      return NextResponse.json(cache.data);
    }

    // Get the current hour
    const currentHour = new Date().getHours();
    
    // Get occupancy data for all parkings for the current hour
    const parkingStats = await prisma.dailyStats.findMany({
      where: {
        hour: currentHour,
      },
      select: {
        parkingId: true,
        avgFreeSpaces: true,
        avgOccupancy: true,
      }
    });
    
    // Format the data for easy consumption by the front-end
    const occupancyData = parkingStats.reduce((acc, stat) => {
      acc[stat.parkingId] = {
        occupancy: stat.avgOccupancy,
        freeSpaces: stat.avgFreeSpaces,
      };
      return acc;
    }, {} as Record<string, { occupancy: number, freeSpaces: number }>);
    
    // Update cache
    cache.data = { parkings: occupancyData };
    cache.timestamp = now;
    
    return NextResponse.json(cache.data);
  } catch (error) {
    console.error(`Error fetching all parking stats: ${error}`);
    return NextResponse.json(
      { error: "Failed to fetch parking statistics" },
      { status: 500 }
    );
  }
} 