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

interface ParkingForecast {
  hour: number;
  expected_occupancy: number;
  expected_free_spaces: number;
}

// Пороговые значения для рекомендаций
const MINIMUM_FREE_SPACES = 5; // Минимальное количество свободных мест для рекомендации
const CRITICAL_FREE_SPACES = 2; // Критическое значение свободных мест
const MAX_SAFE_ARRIVAL_TIME = 20; // Максимальное время в пути (мин) для комфортного прибытия
const HIGH_AVAILABILITY_THRESHOLD = 0.3; // Если свободно более 30% мест, считаем парковку свободной
const NIGHT_HOURS_START = 22; // Начало "ночного" периода (22:00)
const NIGHT_HOURS_END = 7; // Конец "ночного" периода (7:00)
const COMFORTABLE_FREE_RATIO = 0.15; // Если свободно более 15% мест, считается достаточным для комфортной парковки

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
 * Получает прогноз загруженности парковки на указанный час
 */
async function getParkingForecastForHour(parkingId: string, targetHour: number): Promise<ParkingForecast | null> {
  try {
    const response = await fetch(`/api/parkings/${parkingId}/forecast?hour=${targetHour}`, {
      headers: {
        'Cache-Control': 'no-cache'
      }
    });
    
    if (!response.ok) {
      console.error(`Ошибка при получении прогноза для парковки ${parkingId}: ${response.status}`);
      return null;
    }
    
    const data = await response.json();
    
    if (data && data.forecasts && data.forecasts.length > 0) {
      // Находим прогноз для запрашиваемого часа
      const forecast = data.forecasts.find((f: any) => {
        const forecastDate = new Date(f.timestamp);
        return forecastDate.getHours() === targetHour;
      });
      
      if (forecast) {
        return {
          hour: targetHour,
          expected_occupancy: forecast.expected_occupancy,
          expected_free_spaces: forecast.expected_free_spaces
        };
      }
    }
    
    return null;
  } catch (error) {
    console.error(`Ошибка получения прогноза для парковки ${parkingId}:`, error);
    return null;
  }
}

/**
 * Проверяет, является ли текущее время ночным периодом
 * когда парковки обычно пустые
 */
function isNightTime(): boolean {
  const currentHour = new Date().getHours();
  return currentHour >= NIGHT_HOURS_START || currentHour < NIGHT_HOURS_END;
}

/**
 * Предсказывает, будет ли парковка доступна к моменту прибытия
 * учитывая текущую загрузку, прогнозы и время суток
 */
async function predictParkingAvailability(
  parking: ParkingInfo, 
  travelTimeMinutes: number
): Promise<{ willBeAvailable: boolean; reason: string; expectedFreeSpaces?: number }> {
  // Если нет данных о свободных местах, не можем предсказать
  if (parking.freeSpaces === undefined || parking.totalSpaces === undefined) {
    return { 
      willBeAvailable: false, 
      reason: 'Нет данных о загруженности парковки'
    };
  }
  
  // Текущая доступность (процент свободных мест)
  const currentAvailabilityRatio = parking.freeSpaces / parking.totalSpaces;
  
  // Если парковка уже почти пустая (много свободных мест), считаем что она будет доступна
  if (currentAvailabilityRatio >= HIGH_AVAILABILITY_THRESHOLD) {
    return { 
      willBeAvailable: true, 
      reason: `На парковке достаточно свободных мест (${parking.freeSpaces})`,
      expectedFreeSpaces: parking.freeSpaces
    };
  }
  
  // Если сейчас ночь (период низкой активности), повышаем вероятность доступности
  if (isNightTime()) {
    return { 
      willBeAvailable: true, 
      reason: 'Ночное время - парковки обычно свободны',
      expectedFreeSpaces: parking.freeSpaces
    };
  }
  
  // Рассчитываем примерный час прибытия
  const now = new Date();
  const arrivalTime = new Date(now.getTime() + travelTimeMinutes * 60 * 1000);
  const arrivalHour = arrivalTime.getHours();
  
  // Получаем прогноз загруженности парковки на час прибытия
  const forecast = await getParkingForecastForHour(parking.id, arrivalHour);
  
  // Если есть прогноз на час прибытия
  if (forecast) {
    // Проверяем, будет ли достаточно мест к моменту прибытия
    if (forecast.expected_free_spaces >= MINIMUM_FREE_SPACES) {
      return {
        willBeAvailable: true,
        reason: `По прогнозу к ${arrivalHour}:00 будет доступно около ${forecast.expected_free_spaces} мест`,
        expectedFreeSpaces: forecast.expected_free_spaces
      };
    }
    
    // Проверяем процент свободных мест
    const expectedAvailabilityRatio = (forecast.expected_free_spaces / parking.totalSpaces);
    if (expectedAvailabilityRatio >= COMFORTABLE_FREE_RATIO) {
      return {
        willBeAvailable: true,
        reason: `По прогнозу к ${arrivalHour}:00 будет доступно около ${forecast.expected_free_spaces} мест`,
        expectedFreeSpaces: forecast.expected_free_spaces
      };
    }
    
    return {
      willBeAvailable: false,
      reason: `По прогнозу к ${arrivalHour}:00 будет мало свободных мест (${forecast.expected_free_spaces})`,
      expectedFreeSpaces: forecast.expected_free_spaces
    };
  }
  
  // Если нет прогноза, но сейчас много свободных мест и они не заполнятся так быстро
  if (parking.freeSpaces > MINIMUM_FREE_SPACES * 2) {
    return {
      willBeAvailable: true,
      reason: `Сейчас на парковке ${parking.freeSpaces} свободных мест`,
      expectedFreeSpaces: parking.freeSpaces
    };
  }
  
  // Если ничего не известно точно, делаем вывод на основе текущего состояния
  return {
    willBeAvailable: parking.freeSpaces >= MINIMUM_FREE_SPACES,
    reason: parking.freeSpaces >= MINIMUM_FREE_SPACES 
      ? `На парковке ${parking.freeSpaces} свободных мест` 
      : `Мало свободных мест (${parking.freeSpaces})`,
    expectedFreeSpaces: parking.freeSpaces
  };
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
  const travelTimeMinutes = routeInfo.travelTimeMinutes;
  
  // Предсказываем доступность парковки к моменту прибытия
  const availabilityPrediction = await predictParkingAvailability(selectedParking, travelTimeMinutes);
  
  // Если парковка будет доступна к моменту прибытия - рекомендуем её
  if (availabilityPrediction.willBeAvailable) {
    // Если время в пути приемлемое - рекомендуем эту парковку
    if (travelTimeMinutes <= MAX_SAFE_ARRIVAL_TIME) {
      return {
        parking: selectedParking,
        recommendation: 'recommended',
        reason: `${availabilityPrediction.reason}, время в пути: ${travelTimeMinutes} мин`,
        travelTime: travelTimeMinutes,
        availableSpots: availabilityPrediction.expectedFreeSpaces
      };
    }
    // Если время в пути большое, но парковка будет доступна - всё равно рекомендуем
    else {
      return {
        parking: selectedParking,
        recommendation: 'recommended',
        reason: `${availabilityPrediction.reason}, но время в пути большое: ${travelTimeMinutes} мин`,
        travelTime: travelTimeMinutes,
        availableSpots: availabilityPrediction.expectedFreeSpaces
      };
    }
  }
  
  // Парковка, вероятно, не будет доступна к моменту прибытия - ищем альтернативы
  const alternativeResults = await findAlternativeParkings(userLocation, selectedParking, nearbyParkings, travelTimeMinutes);
  
  if (alternativeResults.alternatives && alternativeResults.alternatives.length > 0) {
    // Есть альтернативные варианты
    return {
      parking: selectedParking,
      recommendation: 'alternative',
      reason: alternativeResults.reason,
      travelTime: travelTimeMinutes,
      availableSpots: availabilityPrediction.expectedFreeSpaces,
      alternatives: alternativeResults.alternatives
    };
  }
  
  // Нет хороших альтернатив и выбранная парковка не рекомендуется
  return {
    parking: selectedParking,
    recommendation: 'not_recommended',
    reason: availabilityPrediction.reason,
    travelTime: travelTimeMinutes,
    availableSpots: availabilityPrediction.expectedFreeSpaces
  };
}

/**
 * Поиск альтернативных парковок с лучшими условиями
 */
async function findAlternativeParkings(
  userLocation: UserLocation,
  selectedParking: ParkingInfo,
  allParkings: ParkingInfo[],
  travelTimeToSelected: number
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
  const alternativesData = await Promise.all(
    limitedAlternatives.map(async (parking) => {
      const routeInfo = await calculateRouteInfo(userLocation, parking);
      
      // Проверяем прогноз доступности к моменту прибытия
      const availabilityPrediction = await predictParkingAvailability(
        parking, 
        routeInfo.travelTimeMinutes
      );
      
      return {
        parking,
        travelTime: routeInfo.travelTimeMinutes,
        availableSpots: availabilityPrediction.expectedFreeSpaces || parking.freeSpaces,
        willBeAvailable: availabilityPrediction.willBeAvailable
      };
    })
  );
  
  // Фильтруем только доступные альтернативы
  const availableAlternatives = alternativesData.filter(alt => alt.willBeAvailable);
  
  if (availableAlternatives.length === 0) {
    return {
      reason: 'Нет подходящих альтернативных парковок поблизости',
    };
  }
  
  // Сортируем альтернативы по времени в пути
  const sortedAlternatives = availableAlternatives
    .sort((a, b) => (a.travelTime || 0) - (b.travelTime || 0))
    .slice(0, 3); // Берем только 3 ближайшие альтернативы
  
  // Преобразуем в формат для ответа API
  const alternativesForResponse = sortedAlternatives.map(alt => ({
    parking: alt.parking,
    travelTime: alt.travelTime,
    availableSpots: alt.availableSpots
  }));
  
  // Выбираем лучшую альтернативу
  const bestAlternative = sortedAlternatives[0];
  
  if (bestAlternative && bestAlternative.travelTime) {
    // Если лучшая альтернатива ближе выбранной парковки
    if (bestAlternative.travelTime < travelTimeToSelected) {
      return {
        reason: `Найдена ближайшая парковка с ${bestAlternative.availableSpots} свободными местами в ${bestAlternative.travelTime} мин от вас`,
        alternatives: alternativesForResponse
      };
    }
    
    // Если лучшая альтернатива примерно так же далеко, но с большим числом мест
    return {
      reason: `Найдены альтернативные парковки с более высокой доступностью`,
      alternatives: alternativesForResponse
    };
  }
  
  return {
    reason: 'Есть альтернативные варианты парковки поблизости',
    alternatives: alternativesForResponse
  };
} 