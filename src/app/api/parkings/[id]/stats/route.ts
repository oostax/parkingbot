import { NextRequest, NextResponse } from "next/server";
import { ParkingStats } from "@/types/parking";

// Cache responses for 1 hour
const CACHE_TIME = 3600; // seconds
const cache = new Map<string, { data: Record<string, unknown>; timestamp: number }>();

/**
 * Generate mock hourly stats for a parking
 * In a production app, this would fetch real historical data
 */
function generateMockStats(parkingId: string): ParkingStats[] {
  const stats: ParkingStats[] = [];
  
  // Base values for this parking (deterministic based on ID)
  const idSum = parkingId.split('').reduce((sum, char) => sum + char.charCodeAt(0), 0);
  const baseCapacity = 50 + (idSum % 200); // Between 50 and 250 spaces
  const baseOccupancy = 0.4 + ((idSum % 40) / 100); // Between 0.4 and 0.8
  
  // Generate stats for each hour
  for (let hour = 0; hour < 24; hour++) {
    // Peak hours have higher occupancy (morning and evening rush hours)
    const isPeakHour = (hour >= 7 && hour <= 10) || (hour >= 16 && hour <= 19);
    const isNightHour = hour < 6 || hour > 21;
    
    // Calculate occupancy based on hour
    let occupancy = baseOccupancy;
    if (isPeakHour) occupancy += 0.3;
    if (isNightHour) occupancy -= 0.2;
    
    // Add some variation but ensure it's between 0.1 and 0.95
    const randomFactor = Math.sin(idSum * hour) * 0.15;
    occupancy = Math.max(0.1, Math.min(0.95, occupancy + randomFactor));
    
    // Calculate free spaces
    const freeSpaces = Math.round(baseCapacity * (1 - occupancy));
    
    stats.push({
      hour,
      avg_free_spaces: freeSpaces,
      avg_occupancy: occupancy,
    });
  }
  
  return stats;
}

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
    
    // In a real app, this would fetch from a database
    // For now, we'll generate mock statistics
    const stats = generateMockStats(parkingId);
    
    const result = { stats };
    
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