import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getDistance } from "@/lib/utils";
import { ParkingInfo } from "@/types/parking";
import path from 'path';
import fs from 'fs/promises';

export async function GET(request: NextRequest) {
  try {
    // Получаем параметры запроса
    const searchParams = request.nextUrl.searchParams;
    const lat = parseFloat(searchParams.get("lat") || "");
    const lon = parseFloat(searchParams.get("lon") || "");
    const targetId = searchParams.get("targetId");

    // Проверяем наличие необходимых параметров
    if (isNaN(lat) || isNaN(lon)) {
      return NextResponse.json(
        { error: "Необходимо указать координаты (lat, lon)" },
        { status: 400 }
      );
    }

    // Загружаем данные о парковках из файла
    const dataFilePath = path.join(process.cwd(), 'public', 'data', 'parking_data.json');
    const fileContent = await fs.readFile(dataFilePath, 'utf-8');
    const parkings: ParkingInfo[] = JSON.parse(fileContent);

    // Получаем целевую парковку
    let targetParking: ParkingInfo | null = null;
    if (targetId) {
      const foundParking = parkings.find(p => p.id === targetId);
      if (foundParking) {
        targetParking = foundParking;
      } else {
        return NextResponse.json(
          { error: "Указанная парковка не найдена" },
          { status: 404 }
        );
      }
    }

    // Загружаем данные о реальном времени для парковок
    const realTimeData = await prisma.parking_stats.findMany({
      orderBy: {
        timestamp: 'desc'
      },
      distinct: ['parking_id']
    });

    // Создаем словарь для быстрого доступа к данным реального времени
    const realTimeDataMap = new Map();
    realTimeData.forEach(item => {
      realTimeDataMap.set(item.parking_id, {
        freeSpaces: item.free_spaces,
        totalSpaces: item.total_spaces
      });
    });

    // Фильтруем парковки по расстоянию и наличию данных
    const nearbyParkings = parkings
      .map(parking => {
        // Вычисляем расстояние от пользователя до парковки
        const distance = getDistance(
          lat,
          lon,
          parking.lat,
          parking.lng || (parking.lon as number)
        );

        // Получаем данные реального времени для парковки, если они есть
        const rtData = realTimeDataMap.get(parking.id);

        // Добавляем информацию о расстоянии и времени в пути
        return {
          ...parking,
          distance: parseFloat(distance.toFixed(1)),
          time: Math.round(distance * 20), // Примерное время в минутах (1 км ≈ 20 минут пешком)
          freeSpaces: rtData?.freeSpaces || parking.freeSpaces || 0,
          totalSpaces: rtData?.totalSpaces || parking.totalSpaces || 0
        };
      })
      .filter(parking => parking.distance <= 2) // Только парковки в радиусе 2 км
      .sort((a, b) => a.distance - b.distance); // Сортируем по расстоянию

    // Формируем альтернативы (максимум 5 ближайших парковок)
    const alternatives = nearbyParkings
      .slice(0, 5)
      .map(parking => ({
        id: parking.id,
        name: parking.name,
        address: `${parking.street} ${parking.house || ''}`,
        distance: parking.distance,
        time: parking.time,
        freeSpaces: parking.freeSpaces,
        totalSpaces: parking.totalSpaces,
        subway: parking.subway
      }));

    // Формируем ответ
    const response = {
      userLocation: { latitude: lat, longitude: lon },
      targetParkingId: targetId,
      alternatives
    };

    return NextResponse.json(response);
  } catch (error) {
    console.error("Error in parking recommendations API:", error);
    return NextResponse.json(
      { error: "Внутренняя ошибка сервера" },
      { status: 500 }
    );
  }
} 