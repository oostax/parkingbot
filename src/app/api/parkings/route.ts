import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth/next";
import { authOptions } from "@/app/api/auth/[...nextauth]/options";
import { prisma } from "@/lib/prisma";
import { ParkingInfo } from "@/types/parking";
import path from 'path';
import fs from 'fs/promises';

export async function GET(request: NextRequest) {
  try {
    const session = await getServerSession(authOptions);
    const url = new URL(request.url);
    const type = url.searchParams.get('type') || 'all'; // all, intercepting, paid
    const page = parseInt(url.searchParams.get('page') || '1');
    const limit = parseInt(url.searchParams.get('limit') || '50'); // Оптимальное количество на странице
    const search = url.searchParams.get('search') || '';

    const interceptingFilePath = path.join(process.cwd(), 'public', 'data', 'parking_data.json');
    
    // Загружаем перехватывающие парковки (их немного, можно целиком)
    const interceptingContent = await fs.readFile(interceptingFilePath, 'utf-8');
    const interceptingParkings = JSON.parse(interceptingContent) as ParkingInfo[];
    
    let allParkings: ParkingInfo[] = [];
    
    // Если запрошены все парковки или только платные, загружаем и платные тоже
    if (type === 'all' || type === 'paid') {
      // Для платных парковок применим стратегию частичной загрузки через stream
      // Это один из подходов, но для простоты реализации используем базовый подход
      const paidFilePath = path.join(process.cwd(), 'public', 'data', 'all_parking_data.json');
      
      try {
        // Для демонстрации - загружаем с ограничением. 
        // В реальном сценарии здесь можно использовать потоки и частичное чтение файла
        const paidContent = await fs.readFile(paidFilePath, 'utf-8');
        const paidData = JSON.parse(paidContent);
        
        // Проверяем структуру данных - данные в all_parking_data.json хранятся в поле "parkings"
        let paidParkings: ParkingInfo[] = [];
        
        if (paidData && paidData.parkings && Array.isArray(paidData.parkings)) {
          // Файл имеет структуру { parkings: [...] }
          paidParkings = paidData.parkings.map((parking: any) => {
            // Нормализуем данные для совместимости с нашим форматом
            return {
              id: String(parking._id || parking.id || Date.now() + Math.random().toString(36).substring(2, 9)),
              name: parking.name?.ru || parking.name?.en || "Парковка",
              street: parking.address?.street?.ru || parking.address?.street?.en || "",
              house: parking.address?.house?.ru || parking.address?.house?.en || "",
              subway: parking.subway?.ru || parking.subway?.en || "",
              lat: parking.location?.coordinates?.[1] || 0,
              lng: parking.location?.coordinates?.[0] || 0,
              lon: parking.location?.coordinates?.[0] || 0,
              totalSpaces: parking.spaces?.total || 0,
              handicappedTotal: parking.spaces?.handicapped || 0,
              price: parking.category?.price || "Платная",
              schedule: parking.workingHours || "Круглосуточно",
              polygon: parking.location?.type === 'Polygon' ? parking.location.coordinates[0] : []
            };
          });
        } else if (Array.isArray(paidData)) {
          paidParkings = paidData;
        } else if (paidData && typeof paidData === 'object') {
          // Другие возможные структуры как в предыдущей версии
          const keys = Object.keys(paidData);
          if (keys.length > 0 && keys[0] !== 'parkings') {
            // Проверяем, содержит ли первый ключ объект с информацией о парковке
            const firstKey = keys[0];
            if (paidData[firstKey] && typeof paidData[firstKey] === 'object') {
              paidParkings = keys.map(key => ({
                id: key,
                ...paidData[key]
              }));
            }
          }
        }
        
        console.log(`Загружено ${paidParkings.length} платных парковок`);
        
        // Добавляем все парковки в общий массив
        if (type === 'all') {
          allParkings = [...interceptingParkings, ...paidParkings];
        } else {
          allParkings = paidParkings;
        }
      } catch (paidError) {
        console.error('Error loading paid parkings:', paidError);
        // Если не удалось загрузить платные, используем только перехватывающие
        allParkings = interceptingParkings;
      }
    } else {
      // Если запрошены только перехватывающие
      allParkings = interceptingParkings;
    }
    
    // Проверяем, что allParkings точно массив
    if (!Array.isArray(allParkings)) {
      console.error('allParkings is not an array:', typeof allParkings);
      allParkings = [];
    }
    
    // Добавляем флаги для каждой парковки и гарантируем уникальность ID
    const idSet = new Set<string>();
    const processedParkings = allParkings
      .filter((parking: ParkingInfo) => {
        // Проверяем, что у парковки есть ID
        if (!parking.id) {
          // Если ID отсутствует, присваиваем новый уникальный ID
          parking.id = Date.now() + Math.random().toString(36).substring(2, 9);
        }
        // Проверяем на дубликаты ID
        if (idSet.has(parking.id)) {
          // Если ID дублируется, генерируем новый
          parking.id = parking.id + "-" + Date.now() + Math.random().toString(36).substring(2, 5);
        }
        idSet.add(parking.id);
        return true; // Оставляем парковку в массиве
      })
      .map((parking: ParkingInfo) => {
        // Проверяем, является ли парковка перехватывающей по имени
        const isIntercepting = parking.name?.toLowerCase().includes('перехватывающая парковка') || false;
        return {
          ...parking,
          isIntercepting,
          isPaid: !isIntercepting // Если не перехватывающая, то платная
        };
      });
    
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
    
    // Применяем фильтрацию по поисковому запросу
    let filteredParkings = processedParkings;
    if (search) {
      const searchLower = search.toLowerCase();
      filteredParkings = processedParkings.filter(parking => 
        (parking.name && parking.name.toLowerCase().includes(searchLower)) || 
        (parking.street && parking.street.toLowerCase().includes(searchLower)) ||
        (parking.subway && parking.subway.toLowerCase().includes(searchLower))
      );
    }

    // Применяем фильтрацию по типу
    if (type === 'intercepting') {
      // Для перехватывающих парковок используем только данные из parking_data.json
      try {
        const interceptingFilePath = path.join(process.cwd(), 'public', 'data', 'parking_data.json');
        const interceptingContent = await fs.readFile(interceptingFilePath, 'utf-8');
        const interceptingParkings = JSON.parse(interceptingContent) as ParkingInfo[];
        
        // Добавляем флаги isIntercepting и isPaid для всех парковок из этого файла
        filteredParkings = interceptingParkings.map(parking => ({
          ...parking,
          isIntercepting: true,
          isPaid: false, // Перехватывающие парковки не являются платными
          isFavorite: favorites.includes(parking.id)
        }));
        
        console.log(`Загружено ${filteredParkings.length} перехватывающих парковок из parking_data.json`);
      } catch (error) {
        console.error("Ошибка при загрузке перехватывающих парковок:", error);
        // Если не удалось загрузить из файла, используем фильтрацию
        filteredParkings = filteredParkings.filter(p => p.isIntercepting);
      }
    } else if (type === 'paid') {
      // Для платных парковок фильтруем только неперехватывающие
      filteredParkings = filteredParkings.filter(p => !p.isIntercepting);
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
    console.log(`API: Всего загружено ${processedParkings.length} парковок, отфильтровано ${filteredParkings.length}, на странице ${finalParkings.length}`);
    
    // Проверка уникальности ID в финальных данных
    const finalIds = new Set();
    const hasDuplicates = finalParkings.some(p => {
      if (finalIds.has(p.id)) return true;
      finalIds.add(p.id);
      return false;
    });
    
    if (hasDuplicates) {
      console.error("Warning: Duplicate IDs found in final parkings data");
    }
    
    // Возвращаем данные с метаинформацией для пагинации
    return NextResponse.json({
      parkings: finalParkings,
      pagination: {
        page,
        limit,
        totalItems,
        totalPages
      }
    });
    
  } catch (error) {
    console.error('Error fetching parkings:', error);
    return NextResponse.json(
      { error: 'Failed to fetch parkings' },
      { status: 500 }
    );
  }
} 