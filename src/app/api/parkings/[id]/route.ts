import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getServerSession } from "next-auth/next";
import { authOptions } from "@/app/api/auth/options";
import { ParkingData } from "@/types/parking";
import path from 'path';
import fs from 'fs/promises';

// We'll keep this function commented as reference but remove it from active code
/*
// In a real application, this data would be loaded once at server startup
function getParkingData(): Record<string, ParkingData> {
  try {
    const dataPath = path.join(process.cwd(), "public", "data", "parking_data.json");
    const fileContents = fs.readFileSync(dataPath, "utf8");
    const parkingList = JSON.parse(fileContents);
    
    // Create a map for faster lookup
    const parkingMap: Record<string, ParkingData> = {};
    for (const parking of parkingList) {
      parkingMap[parking.id] = parking;
    }
    
    return parkingMap;
  } catch (error) {
    console.error("Error loading parking data:", error);
    return {};
  }
}
*/

// We'll keep this function commented as reference
/*
async function getLiveData(parkingId: string): Promise<Partial<ParkingInfo> | null> {
  try {
    // We'll simulate API call to the Moscow parking API
    // In a real application, you would call the actual API
    // This is based on the Python code that calls 'https://lk.parking.mos.ru/api/3.0/parkings/{id}'
    
    // For now, we'll return simulated data
    const randomFree = Math.floor(Math.random() * 100);
    const randomTotal = randomFree + Math.floor(Math.random() * 100) + 10;
    const randomHandicappedFree = Math.floor(Math.random() * 10);
    const randomHandicappedTotal = randomHandicappedFree + Math.floor(Math.random() * 10);
    
    return {
      totalSpaces: randomTotal,
      freeSpaces: randomFree,
      handicappedTotal: randomHandicappedTotal,
      handicappedFree: randomHandicappedFree,
      id: parkingId,
    };
  } catch (error) {
    console.error("Error fetching live parking data:", error);
    return null;
  }
}
*/

// We'll keep this function commented as reference
/*
async function getParkingStats(parkingId: string) {
  try {
    // Get the statistics for each hour
    const stats = await prisma.dailyStats.findMany({
      where: { parkingId },
      orderBy: { hour: "asc" },
    });
    
    if (stats.length === 0) {
      // If no stats, generate some placeholder data
      return Array.from({ length: 24 }, (_, i) => ({
        hour: i,
        avgFreeSpaces: Math.floor(Math.random() * 100),
        avg_occupancy: Math.random(),
      }));
    }
    
    return stats.map(s => ({
      hour: s.hour,
      avgFreeSpaces: s.avgFreeSpaces,
      avg_occupancy: s.avg_occupancy,
    }));
  } catch (error) {
    console.error("Error fetching parking stats:", error);
    return [];
  }
}
*/

export async function GET(
  request: NextRequest,
  context: { params: { id: string } }
) {
  try {
    const session = await getServerSession(authOptions);
    const { id } = await context.params;
    const parkingId = id;

    // Read parking data directly from the filesystem instead of using fetch
    const dataFilePath = path.join(process.cwd(), 'public', 'data', 'parking_data.json');
    const fileContent = await fs.readFile(dataFilePath, 'utf-8');
    const parkingData = JSON.parse(fileContent);
    
    const parking = parkingData.find((p: ParkingData) => p.id === parkingId);
    
    if (!parking) {
      return NextResponse.json(
        { error: 'Parking not found' },
        { status: 404 }
      );
    }
    
    // Next, fetch real-time data for the parking
    try {
      const liveDataResponse = await fetch(
        `${process.env.NEXTAUTH_URL || request.nextUrl.origin}/api/parkings/${parkingId}/live`,
        { cache: 'no-store' }
      );
      
      if (liveDataResponse.ok) {
        const liveData = await liveDataResponse.json();
        parking.totalSpaces = liveData.totalSpaces;
        parking.freeSpaces = liveData.freeSpaces;
        parking.handicappedTotal = liveData.handicappedTotal;
        parking.handicappedFree = liveData.handicappedFree;
      }
    } catch (error) {
      console.error('Failed to fetch live parking data:', error);
      // Continue without live data
    }
    
    // Finally, check if this parking is in the user's favorites
    let isFavorite = false;
    if (session?.user?.id) {
      const favorite = await prisma.favorites.findFirst({
        where: {
          user_id: session.user.id,
          parking_id: parkingId,
        },
      });
      isFavorite = !!favorite;
    }
    
    return NextResponse.json({
      parking: {
        ...parking,
        isFavorite,
      },
    });
  } catch (error) {
    console.error('Error fetching parking details:', error);
    return NextResponse.json(
      { error: 'Failed to fetch parking details' },
      { status: 500 }
    );
  }
} 