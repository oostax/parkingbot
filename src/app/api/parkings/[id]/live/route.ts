import { NextRequest, NextResponse } from "next/server";

// Cache responses for 2 minutes
const CACHE_TIME = 120; // seconds
const cache = new Map<string, { data: Record<string, number>; timestamp: number }>();

export async function GET(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const parkingId = await params.id;
    
    // Check cache first
    const now = Math.floor(Date.now() / 1000);
    const cachedResponse = cache.get(parkingId);
    if (cachedResponse && now - cachedResponse.timestamp < CACHE_TIME) {
      return NextResponse.json(cachedResponse.data);
    }
    
    // Fetch real-time data from Moscow parking API
    const apiUrl = `https://lk.parking.mos.ru/api/3.0/parkings/${parkingId}`;
    const response = await fetch(apiUrl, {
      headers: {
        "Accept": "application/json",
      },
      cache: "no-store",
    });

    if (!response.ok) {
      throw new Error(`API request failed with status ${response.status}`);
    }

    const data = await response.json();
    
    if (!data.parking) {
      throw new Error("Invalid response format");
    }
    
    // Extract relevant data
    const parkingData = data.parking;
    const spaces = parkingData.congestion?.spaces || {};
    const overall = spaces.overall || {};
    const handicapped = spaces.handicapped || {};
    
    const result = {
      totalSpaces: overall.total || 0,
      freeSpaces: overall.free || 0,
      handicappedTotal: handicapped.total || 0,
      handicappedFree: handicapped.free || 0,
    };
    
    // Update cache
    cache.set(parkingId, { data: result, timestamp: now });
    
    return NextResponse.json(result);
  } catch (error) {
    console.error(`Error fetching real-time data: ${error}`);
    return NextResponse.json(
      { error: "Failed to fetch real-time parking data" },
      { status: 500 }
    );
  }
} 