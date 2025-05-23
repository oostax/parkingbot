import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth/next";
import { authOptions } from "@/app/api/auth/options";
import prisma from "@/lib/prisma";
import { ParkingInfo } from "@/types/parking";

export async function GET(request: NextRequest) {
  try {
    const session = await getServerSession(authOptions);
    
    // Fetch all parkings from the JSON file
    const response = await fetch(`${process.env.NEXTAUTH_URL || request.nextUrl.origin}/data/parking_data.json`);
    if (!response.ok) {
      throw new Error('Failed to fetch parking data');
    }
    
    const parkings = await response.json();
    
    // If user is logged in, fetch their favorites
    let favorites: string[] = [];
    if (session?.user?.id) {
      const userFavorites = await prisma.favorite.findMany({
        where: {
          userId: session.user.id,
        },
        select: {
          parkingId: true,
        },
      });
      
      favorites = userFavorites.map((fav) => fav.parkingId);
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