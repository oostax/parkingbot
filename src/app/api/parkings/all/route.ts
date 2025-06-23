import { NextRequest, NextResponse } from "next/server";
import fs from "fs";
import path from "path";
import { ParkingInfo } from "@/types/parking";

// Кэш для данных о парковках
let parkingsCache: ParkingInfo[] | null = null;
let lastCacheTime = 0;
// Время жизни кэша - 30 минут
const CACHE_TTL = 30 * 60 * 1000;

// Кэш для данных о парковках по регионам
interface RegionCache {
  [region: string]: {
    parkings: ParkingInfo[];
    timestamp: number;
  }
}
const regionCache: RegionCache = {};

// Интерфейс для формата данных парковки в файле all_parking_data.json
interface ParkingData {
  _id: number;
  name: {
    ru: string;
    en: string;
  };
  description: {
    ru: string;
    en: string;
  };
  contacts: {
    ru: string;
    en: string;
  };
  spaces: {
    total: number;
    common: number;
    handicapped: number;
  };
  location: {
    type: string;
    coordinates: Array<[number, number]>;
  };
  address: {
    street: {
      ru: string;
      en: string;
    };
    house: {
      ru: string;
      en: string;
    };
  };
  resolutionAddress: string;
  subway: {
    ru: string;
    en: string;
  };
  blocked: boolean;
  customType: {
    ru: string;
    en: string;
  };
  city: string;
  center: {
    type: string;
    coordinates: [number, number];
  };
  zone: {
    _id: number;
    number: string;
    type: string;
    description: {
      ru: string;
      en: string;
    };
    active: boolean;
    prices: Array<{
      vehicleType: string;
      price: {
        min: number;
        max: number;
      };
    }>;
    city: string;
  };
  category?: {
    _id: number;
    zonePurpose: string;
  };
}

// Интерфейс для формата данных в файле all_parking_data.json
interface AllParkingData {
  parkings: ParkingData[];
}

// Функция для определения региона по координатам
function getRegionFromCoordinates(lat: number, lon: number): string {
  // Разделяем Москву на квадранты для оптимизации
  // Центр Москвы примерно 55.75, 37.62
  if (lat >= 55.75) {
    return lon >= 37.62 ? "ne" : "nw"; // северо-восток или северо-запад
  } else {
    return lon >= 37.62 ? "se" : "sw"; // юго-восток или юго-запад
  }
}

export async function GET(request: NextRequest) {
  try {
    const searchParams = request.nextUrl.searchParams;
    const noCache = searchParams.get("noCache") === "true";
    const region = searchParams.get("region") || "all";
    const limit = parseInt(searchParams.get("limit") || "5000");
    const offset = parseInt(searchParams.get("offset") || "0");
    const bounds = searchParams.get("bounds"); // формат: "minLat,minLon,maxLat,maxLon"
    
    // Путь к файлу с данными о парковках
    const filePath = path.join(process.cwd(), "public", "data", "all_parking_data.json");
    
    // Проверяем существование файла
    if (!fs.existsSync(filePath)) {
      console.error("Файл с данными о всех парковках не найден:", filePath);
      return NextResponse.json(
        { error: "Файл с данными о парковках не найден" },
        { status: 404 }
      );
    }
    
    let parkings: ParkingInfo[] = [];
    
    // Если запрошен конкретный регион и он есть в кэше и кэш не устарел
    if (region !== "all" && regionCache[region] && !noCache && (Date.now() - regionCache[region].timestamp < CACHE_TTL)) {
      console.log(`Используем кэш для региона ${region}`);
      parkings = regionCache[region].parkings;
    }
    // Если запрошены все парковки и есть актуальный кэш
    else if (region === "all" && parkingsCache && !noCache && (Date.now() - lastCacheTime < CACHE_TTL)) {
      console.log("Используем общий кэш для всех парковок");
      parkings = parkingsCache;
    }
    // Иначе загружаем данные из файла
    else {
      console.log("Загружаем данные из файла");
      
      // Читаем файл
      const fileContent = fs.readFileSync(filePath, "utf-8");
      const data: AllParkingData = JSON.parse(fileContent);
      
      // Проверяем формат данных
      if (!data.parkings || !Array.isArray(data.parkings)) {
        console.error("Неверный формат данных в файле all_parking_data.json");
        return NextResponse.json(
          { error: "Неверный формат данных в файле" },
          { status: 500 }
        );
      }
      
      console.log(`Найдено ${data.parkings.length} парковок в файле all_parking_data.json`);
      
      // Преобразуем данные в формат ParkingInfo
      parkings = data.parkings.map(parking => {
        // Получаем координаты из центра парковки
        const [lon, lat] = parking.center?.coordinates || [0, 0];
        
        // Получаем цену из объекта prices для типа car
        const carPrice = parking.zone?.prices?.find(p => p.vehicleType === "car");
        const priceMin = carPrice?.price?.min || 0;
        const priceMax = carPrice?.price?.max || 0;
        const priceText = priceMin === priceMax 
          ? `${priceMin / 100} руб/час` 
          : `${priceMin / 100}-${priceMax / 100} руб/час`;
        
        // Определяем тип парковки (перехватывающая или обычная)
        const isIntercepting = parking.category?.zonePurpose === "intercepting";
        
        return {
          id: parking._id.toString(),
          name: parking.name.ru,
          street: parking.address?.street?.ru || "",
          house: parking.address?.house?.ru || "",
          subway: parking.subway?.ru || "",
          lat,
          lon,
          lng: lon, // Дублируем lon в lng для совместимости
          price: priceText,
          schedule: "Ежедневно, круглосуточно",
          totalSpaces: parking.spaces?.total || 0,
          handicappedTotal: parking.spaces?.handicapped || 0,
          type: isIntercepting ? "intercepting" : "regular",
          // Преобразуем линию в полигон, если это линия
          polygon: parking.location?.type === "LineString" && Array.isArray(parking.location.coordinates) 
            ? parking.location.coordinates.map(coord => [coord[0], coord[1]]) 
            : undefined,
          // Добавляем регион для оптимизации
          region: getRegionFromCoordinates(lat, lon)
        };
      });
      
      // Обновляем общий кэш
      parkingsCache = parkings;
      lastCacheTime = Date.now();
      
      // Обновляем кэш по регионам
      const regionParkings: Record<string, ParkingInfo[]> = {
        ne: [],
        nw: [],
        se: [],
        sw: []
      };
      
      parkings.forEach(parking => {
        if (parking.region) {
          regionParkings[parking.region].push(parking);
        }
      });
      
      // Сохраняем данные по регионам в кэше
      Object.keys(regionParkings).forEach(r => {
        regionCache[r] = {
          parkings: regionParkings[r],
          timestamp: Date.now()
        };
      });
    }
    
    // Фильтруем парковки по границам карты, если указаны
    if (bounds) {
      const [minLat, minLon, maxLat, maxLon] = bounds.split(',').map(Number);
      parkings = parkings.filter(p => 
        p.lat >= minLat && p.lat <= maxLat && 
        (p.lng ?? p.lon ?? 0) >= minLon && (p.lng ?? p.lon ?? 0) <= maxLon
      );
      console.log(`Отфильтровано ${parkings.length} парковок по границам карты`);
    }
    
    // Фильтруем по региону, если указан конкретный регион
    if (region !== "all" && region !== "ne" && region !== "nw" && region !== "se" && region !== "sw") {
      // Можно добавить дополнительную фильтрацию по другим критериям
      console.log(`Неизвестный регион: ${region}, возвращаем все парковки`);
    } else if (region !== "all") {
      parkings = parkings.filter(p => p.region === region);
      console.log(`Отфильтровано ${parkings.length} парковок для региона ${region}`);
    }
    
    // Применяем пагинацию
    const totalCount = parkings.length;
    parkings = parkings.slice(offset, offset + limit);
    
    console.log(`Возвращаем ${parkings.length} парковок (всего: ${totalCount}, смещение: ${offset}, лимит: ${limit})`);
    
    // Возвращаем данные с информацией о пагинации
    return NextResponse.json({
      parkings,
      pagination: {
        total: totalCount,
        offset,
        limit,
        hasMore: offset + limit < totalCount
      }
    });
  } catch (error) {
    console.error("Ошибка при получении данных о парковках:", error);
    return NextResponse.json(
      { error: "Ошибка при получении данных о парковках" },
      { status: 500 }
    );
  }
} 