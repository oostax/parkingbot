import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth/next";
import { authOptions } from "@/app/api/auth/[...nextauth]/options";
import { prisma } from "@/lib/prisma";
import { ParkingInfo } from "@/types/parking";
import { CacheService, CacheKeys, CACHE_TTL } from "@/lib/redis";
import { parkingsQuerySchema, validateData } from "@/lib/validations";
import { withRateLimit, rateLimiters, addRateLimitHeaders } from "@/lib/rate-limit";
import { logger, measureTimeAsync } from "@/lib/logger";
import { parkingDataOptimizer } from "@/lib/parking-data-optimizer";
import path from 'path';
import fs from 'fs/promises';

export async function GET(request: NextRequest) {
  try {
    // Проверяем rate limit
    const rateLimitResponse = withRateLimit(request, rateLimiters.general);
    if (rateLimitResponse) {
      return rateLimitResponse;
    }

    const session = await getServerSession(authOptions);
    const url = new URL(request.url);
    
    // Валидируем параметры запроса
    const queryParams = {
      type: url.searchParams.get('type') || 'all',
      page: url.searchParams.get('page') || '1',
      limit: url.searchParams.get('limit') || '50',
      search: url.searchParams.get('search') || '',
      noCache: url.searchParams.get('noCache') === 'true'
    };

    const validation = validateData(parkingsQuerySchema, queryParams);
    if (!validation.success) {
      return NextResponse.json(
        { error: 'Invalid query parameters', details: validation.errors },
        { status: 400 }
      );
    }

    const { type, page, limit, search, noCache } = validation.data;

    // Генерируем ключ кэша
    const cacheKey = CacheKeys.parkings(type, page, limit, search);
    
    // Проверяем кэш, если не запрошено обновление
    if (!noCache) {
      const cachedData = await CacheService.get(cacheKey);
      if (cachedData) {
        logger.cacheHit(cacheKey);
        const response = NextResponse.json(cachedData);
        return addRateLimitHeaders(response, rateLimiters.general, request);
      }
      logger.cacheMiss(cacheKey);
    }

    // Используем оптимизированную загрузку данных
    const { parkings: optimizedParkings, total } = await measureTimeAsync(
      `Load ${type} parkings`,
      () => parkingDataOptimizer.searchParkings(
        type as 'intercepting' | 'paid' | 'all',
        search || undefined,
        undefined,
        limit * 2, // Загружаем больше для фильтрации
        0
      )
    );

    // Конвертируем оптимизированные данные в формат ParkingInfo
    const allParkings: ParkingInfo[] = optimizedParkings.map(parking => ({
      id: parking.id,
      name: parking.name,
      street: parking.street,
      house: parking.house,
      subway: parking.subway,
      lat: parking.lat,
      lng: parking.lng,
      lon: parking.lng, // Для совместимости
      totalSpaces: parking.totalSpaces,
      freeSpaces: parking.freeSpaces,
      handicappedTotal: parking.handicappedTotal,
      handicappedFree: parking.handicappedFree,
      price: parking.price,
      schedule: parking.schedule,
      isIntercepting: parking.isIntercepting,
      isPaid: parking.isPaid,
      region: parking.region
    }));
    
    // Если пользователь авторизован, загружаем его избранные парковки
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
    
    // Применяем фильтрацию по типу (поиск уже выполнен в оптимизаторе)
    let filteredParkings = allParkings;
    if (type === 'intercepting') {
      filteredParkings = allParkings.filter(p => p.isIntercepting);
    } else if (type === 'paid') {
      filteredParkings = allParkings.filter(p => p.isPaid);
    }
    
    // Вычисляем общее количество результатов и страниц
    const totalItems = filteredParkings.length;
    const totalPages = Math.ceil(totalItems / limit);
    
    // Применяем пагинацию
    const startIndex = (page - 1) * limit;
    const endIndex = page * limit;
    const paginatedParkings = filteredParkings.slice(startIndex, endIndex);
    
    // Добавляем флаги избранного для пагинированных данных
    const finalParkings = paginatedParkings.map(parking => ({
      ...parking,
      isFavorite: favorites.includes(parking.id)
    }));
    
    // Логируем информацию для отладки
    logger.info(`API: Всего загружено ${allParkings.length} парковок, отфильтровано ${filteredParkings.length}, на странице ${finalParkings.length}`, {
      type,
      search,
      page,
      limit,
      totalItems,
      totalPages
    });
    
    // Проверка уникальности ID в финальных данных
    const finalIds = new Set();
    const hasDuplicates = finalParkings.some(p => {
      if (finalIds.has(p.id)) return true;
      finalIds.add(p.id);
      return false;
    });
    
    if (hasDuplicates) {
      logger.warn("Duplicate IDs found in final parkings data");
    }
    
    // Формируем ответ
    const responseData = {
      parkings: finalParkings,
      pagination: {
        page,
        limit,
        totalItems,
        totalPages
      }
    };

    // Сохраняем в кэш
    await CacheService.set(cacheKey, responseData, CACHE_TTL.PARKINGS);
    logger.cacheSet(cacheKey, CACHE_TTL.PARKINGS);

    // Возвращаем данные с метаинформацией для пагинации
    const response = NextResponse.json(responseData);
    return addRateLimitHeaders(response, rateLimiters.general, request);
    
  } catch (error) {
    console.error('Error fetching parkings:', error);
    return NextResponse.json(
      { error: 'Failed to fetch parkings' },
      { status: 500 }
    );
  }
} 