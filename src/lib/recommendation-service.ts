import { ParkingInfo } from '@/types/parking';

interface UserLocation {
  latitude: number;
  longitude: number;
}

interface RouteInfo {
  travelTimeMinutes: number;
  distanceKm: number;
}

interface ParkingRecommendation {
  parking: ParkingInfo;
  recommendation: 'recommended' | 'alternative' | 'not_recommended';
  reason: string;
  travelTime?: number; // в минутах
  availableSpots?: number;
  alternatives?: Array<{
    parking: ParkingInfo;
    travelTime?: number;
    availableSpots?: number;
  }>;
}

// Пороговые значения для рекомендаций
const MINIMUM_FREE_SPACES = 5; // Минимальное количество свободных мест для рекомендации
const CRITICAL_FREE_SPACES = 2; // Критическое значение свободных мест
const MAX_SAFE_ARRIVAL_TIME = 20; // Максимальное время в пути (мин) для комфортного прибытия

// Кеш для хранения расчетов маршрутов
// Ключ: startLat_startLng_endLat_endLng, значение: RouteInfo
const routeCache: Map<string, RouteInfo> = new Map();

// Время истечения кеша в миллисекундах (10 минут)
const CACHE_EXPIRATION = 10 * 60 * 1000; 

// Временные метки для кешированных маршрутов
const routeCacheTimestamps: Map<string, number> = new Map();

/**
 * Рассчитывает примерное время в пути до парковки
 * Использует Yandex Map API для расчета
 */
export async function calculateRouteInfo(
  startLocation: UserLocation,
  endLocation: { lat: number; lng?: number; lon?: number }
): Promise<RouteInfo> {
  try {
    // Получаем долготу из объекта парковки
    const longitude = endLocation.lng ?? endLocation.lon ?? 0;
    
    // Создаем ключ для кеша, округляя координаты до 5 знаков после запятой
    const cacheKey = `${startLocation.latitude.toFixed(5)}_${startLocation.longitude.toFixed(5)}_${endLocation.lat.toFixed(5)}_${longitude.toFixed(5)}`;
    
    // Проверяем наличие и актуальность кешированных данных
    const currentTime = Date.now();
    if (routeCache.has(cacheKey)) {
      const cacheTimestamp = routeCacheTimestamps.get(cacheKey) || 0;
      if (currentTime - cacheTimestamp < CACHE_EXPIRATION) {
        return routeCache.get(cacheKey)!;
      }
    }

    // Формируем URL для Yandex Maps API
    const apiUrl = `https://api.routing.yandex.net/v2/route?apikey=${process.env.NEXT_PUBLIC_YANDEX_MAPS_API_KEY}&waypoints=${startLocation.latitude},${startLocation.longitude}|${endLocation.lat},${longitude}&mode=driving`;

    // В реальном проекте здесь должен быть запрос к API
    // Для демонстрации используем упрощенный расчет
    // Примечание: для полной реализации потребуется API-ключ Яндекс Карт

    // Рассчитываем примерное время в пути, используя упрощенную формулу
    // Расстояние по прямой между двумя точками
    const R = 6371; // радиус Земли в км
    const dLat = (endLocation.lat - startLocation.latitude) * Math.PI / 180;
    const dLon = (longitude - startLocation.longitude) * Math.PI / 180;
    const a = 
      Math.sin(dLat/2) * Math.sin(dLat/2) +
      Math.cos(startLocation.latitude * Math.PI / 180) * Math.cos(endLocation.lat * Math.PI / 180) * 
      Math.sin(dLon/2) * Math.sin(dLon/2); 
    const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1-a)); 
    const distanceKm = R * c;
    
    // Примерное время в пути (средняя скорость 30 км/ч с учетом пробок)
    const travelTimeMinutes = Math.ceil(distanceKm / 30 * 60);
    
    const routeInfo = {
      travelTimeMinutes,
      distanceKm
    };
    
    // Сохраняем результат в кеш
    routeCache.set(cacheKey, routeInfo);
    routeCacheTimestamps.set(cacheKey, currentTime);
    
    return routeInfo;
  } catch (error) {
    console.error('Ошибка расчета маршрута:', error);
    // Возвращаем примерную оценку
    return {
      travelTimeMinutes: 30, // 30 минут по умолчанию
      distanceKm: 15 // 15 км по умолчанию
    };
  }
}

/**
 * Анализирует парковки и дает рекомендации с учетом местоположения пользователя
 */
export async function getParkingRecommendations(
  userLocation: UserLocation | null,
  selectedParking: ParkingInfo,
  nearbyParkings: ParkingInfo[]
): Promise<ParkingRecommendation> {
  // Если местоположение пользователя недоступно
  if (!userLocation) {
    return {
      parking: selectedParking,
      recommendation: 'not_recommended',
      reason: 'Невозможно дать рекомендацию без доступа к вашему местоположению'
    };
  }

  // Если парковка не имеет данных о загруженности
  if (selectedParking.freeSpaces === undefined || selectedParking.totalSpaces === undefined) {
    return {
      parking: selectedParking,
      recommendation: 'not_recommended',
      reason: 'Нет данных о загруженности парковки'
    };
  }

  // Получаем данные о времени в пути
  const routeInfo = await calculateRouteInfo(userLocation, selectedParking);
  
  // Если на выбранной парковке достаточно мест и время в пути приемлемое
  if (selectedParking.freeSpaces >= MINIMUM_FREE_SPACES && routeInfo.travelTimeMinutes <= MAX_SAFE_ARRIVAL_TIME) {
    return {
      parking: selectedParking,
      recommendation: 'recommended',
      reason: `На парковке достаточно свободных мест (${selectedParking.freeSpaces}), время в пути: ${routeInfo.travelTimeMinutes} мин`,
      travelTime: routeInfo.travelTimeMinutes,
      availableSpots: selectedParking.freeSpaces
    };
  }
  
  // Если на выбранной парковке мало мест или долгое время в пути
  // Ищем альтернативные варианты
  const alternativeResults = await findAlternativeParkings(userLocation, selectedParking, nearbyParkings);
  
  if (alternativeResults.alternatives && alternativeResults.alternatives.length > 0) {
    // Есть альтернативные варианты
    return {
      parking: selectedParking,
      recommendation: 'alternative',
      reason: alternativeResults.reason,
      travelTime: routeInfo.travelTimeMinutes,
      availableSpots: selectedParking.freeSpaces,
      alternatives: alternativeResults.alternatives
    };
  }
  
  // Нет хороших альтернатив
  return {
    parking: selectedParking,
    recommendation: 'not_recommended',
    reason: selectedParking.freeSpaces <= CRITICAL_FREE_SPACES 
      ? `На парковке осталось всего ${selectedParking.freeSpaces} мест, рекомендуем поискать другие варианты`
      : `Время в пути ${routeInfo.travelTimeMinutes} мин, возможно, не удастся найти место по прибытии`,
    travelTime: routeInfo.travelTimeMinutes,
    availableSpots: selectedParking.freeSpaces
  };
}

/**
 * Поиск альтернативных парковок с лучшими условиями
 */
async function findAlternativeParkings(
  userLocation: UserLocation,
  selectedParking: ParkingInfo,
  allParkings: ParkingInfo[]
): Promise<{ 
  reason: string;
  alternatives?: Array<{
    parking: ParkingInfo;
    travelTime?: number;
    availableSpots?: number;
  }> 
}> {
  // Фильтруем парковки - исключаем выбранную и те, что не имеют данных о свободных местах
  const potentialAlternatives = allParkings.filter(parking => 
    parking.id !== selectedParking.id && 
    parking.freeSpaces !== undefined && 
    parking.freeSpaces >= MINIMUM_FREE_SPACES
  );
  
  if (potentialAlternatives.length === 0) {
    return {
      reason: 'Подходящих альтернативных парковок не найдено'
    };
  }

  // Ограничиваем количество анализируемых альтернатив до 5 для производительности
  const limitedAlternatives = potentialAlternatives.slice(0, 5);

  // Получаем информацию о маршруте для каждой альтернативы
  const alternativesWithRoutes = await Promise.all(
    limitedAlternatives.map(async (parking) => {
      const routeInfo = await calculateRouteInfo(userLocation, parking);
      return {
        parking,
        travelTime: routeInfo.travelTimeMinutes,
        availableSpots: parking.freeSpaces
      };
    })
  );
  
  // Сортируем альтернативы по времени в пути
  const sortedAlternatives = alternativesWithRoutes
    .sort((a, b) => (a.travelTime || 0) - (b.travelTime || 0))
    .slice(0, 3); // Берем только 3 ближайшие альтернативы
  
  // Выбираем лучшую альтернативу
  const bestAlternative = sortedAlternatives[0];
  
  if (bestAlternative && bestAlternative.travelTime && bestAlternative.travelTime < MAX_SAFE_ARRIVAL_TIME) {
    const freeSpaces = selectedParking.freeSpaces || 0;
    return {
      reason: freeSpaces <= CRITICAL_FREE_SPACES 
        ? `На выбранной парковке мало мест (${freeSpaces}), рекомендуем альтернативы` 
        : `Время в пути до выбранной парковки (${freeSpaces} мин), есть варианты ближе`,
      alternatives: sortedAlternatives
    };
  }
  
  return {
    reason: 'Нет подходящих альтернативных парковок поблизости',
    alternatives: sortedAlternatives
  };
} 