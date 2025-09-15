import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getServerSession } from "next-auth";
import { authOptions } from "@/app/api/auth/[...nextauth]/options";
import { CacheService, CacheKeys, CACHE_TTL } from "@/lib/redis";
import { favoriteSchema, validateData } from "@/lib/validations";
import { withRateLimit, rateLimiters } from "@/lib/rate-limit";
import { logger } from "@/lib/logger";
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

export async function GET(request: NextRequest) {
  try {
    // Проверяем rate limit
    const rateLimitResponse = withRateLimit(request, rateLimiters.general);
    if (rateLimitResponse) {
      return rateLimitResponse;
    }

    const session = await getServerSession(authOptions);
    const userId = session?.user?.id;

    if (!userId) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    // Проверяем кэш
    const cacheKey = CacheKeys.userFavorites(userId);
    const cachedFavorites = await CacheService.get(cacheKey);
    
    if (cachedFavorites) {
      logger.cacheHit(cacheKey);
      return NextResponse.json(cachedFavorites);
    }
    logger.cacheMiss(cacheKey);

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

    // Сохраняем в кэш
    await CacheService.set(cacheKey, favoritesParkings, CACHE_TTL.FAVORITES);
    logger.cacheSet(cacheKey, CACHE_TTL.FAVORITES);

    return NextResponse.json(favoritesParkings);
  } catch (error) {
    console.error("Error fetching favorites:", error);
    return NextResponse.json({ error: "Failed to fetch favorites" }, { status: 500 });
  }
}

export async function POST(request: NextRequest) {
  try {
    // Проверяем rate limit
    const rateLimitResponse = withRateLimit(request, rateLimiters.general);
    if (rateLimitResponse) {
      return rateLimitResponse;
    }

    const session = await getServerSession(authOptions);
    const userId = session?.user?.id;

    if (!userId) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const body = await request.json();
    
    // Валидируем данные
    const validation = validateData(favoriteSchema, body);
    if (!validation.success) {
      return NextResponse.json(
        { error: 'Invalid request data', details: validation.errors },
        { status: 400 }
      );
    }

    const { parkingId } = validation.data;

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

    // Инвалидируем кэш избранного
    const cacheKey = CacheKeys.userFavorites(userId);
    await CacheService.del(cacheKey);
    logger.cacheInvalidate(cacheKey);

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
    // Проверяем rate limit
    const rateLimitResponse = withRateLimit(request, rateLimiters.general);
    if (rateLimitResponse) {
      return rateLimitResponse;
    }

    const session = await getServerSession(authOptions);
    const userId = session?.user?.id;

    if (!userId) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const body = await request.json();
    
    // Валидируем данные
    const validation = validateData(favoriteSchema, body);
    if (!validation.success) {
      return NextResponse.json(
        { error: 'Invalid request data', details: validation.errors },
        { status: 400 }
      );
    }

    const { parkingId } = validation.data;

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

      // Инвалидируем кэш избранного
      const cacheKey = CacheKeys.userFavorites(userId);
      await CacheService.del(cacheKey);
      logger.cacheInvalidate(cacheKey);
    }

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error("Error deleting favorite:", error);
    return NextResponse.json({ error: "Failed to delete favorite" }, { status: 500 });
  }
} 