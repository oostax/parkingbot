import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth/next";
import { authOptions } from "@/app/api/auth/options";
import { prisma } from "@/lib/prisma";
import { ParkingInfo } from "@/types/parking";
import path from 'path';
import fs from 'fs/promises';

export async function GET(request: NextRequest) {
  try {
    const session = await getServerSession(authOptions);
    
    // Change approach to read the file directly from the filesystem instead of using fetch
    const dataFilePath = path.join(process.cwd(), 'public', 'data', 'parking_data.json');
    const fileContent = await fs.readFile(dataFilePath, 'utf-8');
    const parkings = JSON.parse(fileContent);
    
    // If user is logged in, fetch their favorites
    let favorites: string[] = [];
    if (session?.user?.id) {
      const userFavorites = await prisma.favorites.findMany({
        where: {
          user_id: session.user.id,
        },
        select: {
          parking_id: true,
        },
      });
      
      favorites = userFavorites.map((fav) => fav.parking_id);
    }
    
    // Add favorite flag to each parking
    const parkingsWithFavorites = parkings.map((parking: ParkingInfo) => ({
      ...parking,
      isFavorite: favorites.includes(parking.id),
    }));
    
    return NextResponse.json(parkingsWithFavorites);
    
  } catch (error) {
    console.error('Error fetching parkings:', error);
    return NextResponse.json(
      { error: 'Failed to fetch parkings' },
      { status: 500 }
    );
  }
} 