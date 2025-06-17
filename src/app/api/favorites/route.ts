import { NextRequest, NextResponse } from "next/server";
import prisma from "@/lib/prisma";
import { getServerSession } from "next-auth";
import { authOptions } from "../auth/options";
import fs from "fs";
import path from "path";
import { ParkingInfo } from "@/types/parking";

// Helper function to get parkings from JSON file
function getParkingData(): ParkingInfo[] {
  try {
    const dataPath = path.join(process.cwd(), "public", "data", "parking_data.json");
    const fileContents = fs.readFileSync(dataPath, "utf8");
    return JSON.parse(fileContents);
  } catch (error) {
    console.error("Error loading parking data:", error);
    return [];
  }
}

export async function GET() {
  try {
    const session = await getServerSession(authOptions);
    const userId = session?.user?.id;

    if (!userId) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const favorites = await prisma.favorites.findMany({
      where: { user_id: userId },
    });

    // Get all parkings from JSON 
    const parkingList = getParkingData();
    
    // Merge favorite parking IDs with full parking data
    const favoritesParkings = favorites.map(favorite => {
      const parkingData = parkingList.find((p: ParkingInfo) => p.id === favorite.parking_id);
      return {
        ...favorite,
        parking: parkingData || { id: favorite.parking_id },
        // Для совместимости с существующим кодом
        parkingId: favorite.parking_id,
        userId: favorite.user_id
      };
    });

    return NextResponse.json(favoritesParkings);
  } catch (error) {
    console.error("Error fetching favorites:", error);
    return NextResponse.json({ error: "Failed to fetch favorites" }, { status: 500 });
  }
}

export async function POST(request: NextRequest) {
  try {
    const session = await getServerSession(authOptions);
    const userId = session?.user?.id;

    if (!userId) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const { parkingId } = await request.json();

    if (!parkingId) {
      return NextResponse.json({ error: "Parking ID is required" }, { status: 400 });
    }

    // Verify parking exists in JSON data
    const parkingList = getParkingData();
    const parkingExists = parkingList.some((p: ParkingInfo) => p.id === parkingId);
    
    if (!parkingExists) {
      return NextResponse.json({ error: "Parking not found" }, { status: 404 });
    }

    // Create favorite
    const favorite = await prisma.favorites.create({
      data: {
        user_id: userId,
        parking_id: parkingId,
      },
    });

    // Для совместимости с существующим кодом
    return NextResponse.json({
      ...favorite,
      parkingId: favorite.parking_id,
      userId: favorite.user_id
    });
  } catch (error) {
    console.error("Error creating favorite:", error);
    return NextResponse.json({ error: "Failed to create favorite" }, { status: 500 });
  }
}

export async function DELETE(request: NextRequest) {
  try {
    const session = await getServerSession(authOptions);
    const userId = session?.user?.id;

    if (!userId) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const { parkingId } = await request.json();

    if (!parkingId) {
      return NextResponse.json({ error: "Parking ID is required" }, { status: 400 });
    }

    // Delete favorite - используем findFirst для поиска записи по составному ключу
    const favorite = await prisma.favorites.findFirst({
      where: {
        user_id: userId,
        parking_id: parkingId,
      },
    });

    if (favorite) {
      await prisma.favorites.delete({
        where: {
          id: favorite.id,
        },
      });
    }

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error("Error deleting favorite:", error);
    return NextResponse.json({ error: "Failed to delete favorite" }, { status: 500 });
  }
} 