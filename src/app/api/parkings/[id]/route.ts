import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getServerSession } from "next-auth/next";
import { authOptions } from "@/app/api/auth/options";
import { ParkingData } from "@/types/parking";
import path from 'path';
import fs from 'fs/promises';

// Определяем типы параметров
type RouteParams = { id: string };

export async function GET(
  request: NextRequest,
  context: { params: RouteParams }
): Promise<Response> {
  try {
    const session = await getServerSession(authOptions);
    const params = await context.params;
    const parkingId = params.id;

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