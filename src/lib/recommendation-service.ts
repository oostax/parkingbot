import { Forecast, ParkingInfo } from "@/types/parking";

/**
 * Интерфейс для координат пользователя
 */
export interface UserLocation {
  latitude: number;
  longitude: number;
}

/**
 * Интерфейс для рекомендации
 */
export interface ParkingRecommendation {
  parking: ParkingInfo;
  recommendationType: 'good' | 'alternative' | 'negative';
  message: string;
  estimatedDriveTimeMinutes: number;
  estimatedFreeSpacesOnArrival: number;
  alternatives?: ParkingInfo[];
}

/**
 * Пороги доступности мест для разных типов рекомендаций
 */
const AVAILABILITY_THRESHOLDS = {
  high: 30, // Высокая доступность (более 30% мест свободно)
  medium: 15, // Средняя доступность (15-30% мест свободно)
  low: 5, // Низкая доступность (5-15% мест свободно)
  critical: 5 // Критически мало (менее 5% мест свободно)
};

/**
 * Пороговые значения времени в пути для принятия решений
 */
const TIME_THRESHOLDS = {
  short: 15, // Короткая поездка (до 15 минут)
  medium: 30, // Средняя поездка (15-30 минут)
  long: 45 // Длинная поездка (более 30 минут)
};

/**
 * Расчет расстояния между двумя точками по координатам (формула гаверсинусов)
 */
export function calculateDistance(
  lat1: number, 
  lon1: number, 
  lat2: number, 
  lon2: number
): number {
  const R = 6371; // Радиус Земли в километрах
  const dLat = toRad(lat2 - lat1);
  const dLon = toRad(lon2 - lon1);
  const a = 
    Math.sin(dLat / 2) * Math.sin(dLat / 2) +
    Math.cos(toRad(lat1)) * Math.cos(toRad(lat2)) * 
    Math.sin(dLon / 2) * Math.sin(dLon / 2);
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
  return R * c;
}

function toRad(value: number): number {
  return value * Math.PI / 180;
}

/**
 * Оценка времени в пути на автомобиле на основе расстояния
 * Примечание: это грубая оценка, не учитывающая пробки и маршруты
 */
export function estimateDriveTime(distanceKm: number): number {
  // Предположим среднюю скорость 30 км/ч в городе (с учетом светофоров, пробок и т.д.)
  const averageSpeedKmh = 30;
  
  // Время в минутах
  return Math.ceil((distanceKm / averageSpeedKmh) * 60);
}

/**
 * Прогнозирование количества свободных мест к моменту приезда пользователя
 */
export function estimateFreeSpotsOnArrival(
  parking: ParkingInfo,
  driveTimeMinutes: number,
  forecasts?: Forecast[]
): number {
  if (!parking.freeSpaces || !parking.totalSpaces || parking.totalSpaces === 0) {
    return 0;
  }

  // Если нет прогнозов, используем простую линейную экстраполяцию
  if (!forecasts || forecasts.length === 0) {
    // Предположим, что в час заполняется примерно 10% от общего числа мест (в часы пик)
    const hourlyOccupancyRate = parking.totalSpaces * 0.1;
    // Количество часов в пути
    const travelTimeHours = driveTimeMinutes / 60;
    
    // Прогнозируемое количество свободных мест при прибытии
    const estimatedFreeSpots = Math.max(0, Math.floor(parking.freeSpaces - (hourlyOccupancyRate * travelTimeHours)));
    return estimatedFreeSpots;
  }

  // Если есть прогнозы, используем их
  // Определяем, какой прогноз использовать на основе времени в пути
  const currentTime = new Date();
  const arrivalTime = new Date(currentTime.getTime() + (driveTimeMinutes * 60 * 1000));

  // Ищем прогноз, ближайший ко времени прибытия
  let closestForecast = forecasts[0];
  let minTimeDiff = Infinity;

  for (const forecast of forecasts) {
    const forecastTime = new Date(forecast.timestamp);
    const timeDiff = Math.abs(forecastTime.getTime() - arrivalTime.getTime());
    
    if (timeDiff < minTimeDiff) {
      minTimeDiff = timeDiff;
      closestForecast = forecast;
    }
  }

  return Math.max(0, Math.floor(closestForecast.expected_free_spaces));
}

/**
 * Проверка, достаточно ли свободных мест на парковке
 */
export function hasEnoughSpaces(parking: ParkingInfo, estimatedFreeSpaces: number): boolean {
  if (!parking.totalSpaces) return false;
  
  const freePercentage = (estimatedFreeSpaces / parking.totalSpaces) * 100;
  return freePercentage >= AVAILABILITY_THRESHOLDS.medium;
}

/**
 * Поиск ближайших альтернативных парковок с достаточным количеством свободных мест
 */
export function findNearbyAlternatives(
  userLocation: UserLocation,
  currentParking: ParkingInfo,
  allParkings: ParkingInfo[],
  maxDistanceKm: number = 5
): ParkingInfo[] {
  if (!userLocation) return [];

  // Фильтрация парковок:
  // 1. Не текущая парковка
  // 2. В пределах maxDistanceKm от пользователя
  // 3. С достаточным количеством свободных мест
  // 4. Только перехватывающие парковки (по типу)
  return allParkings
    .filter(parking => 
      parking.id !== currentParking.id &&
      parking.type === 'перехватывающая' &&
      parking.freeSpaces && 
      parking.totalSpaces &&
      (parking.freeSpaces / parking.totalSpaces) >= (AVAILABILITY_THRESHOLDS.medium / 100) &&
      calculateDistance(
        userLocation.latitude, 
        userLocation.longitude,
        parking.lat,
        parking.lng || parking.lon || 0
      ) <= maxDistanceKm
    )
    .sort((a, b) => {
      // Сортировка по расстоянию от пользователя
      const distA = calculateDistance(
        userLocation.latitude, 
        userLocation.longitude,
        a.lat,
        a.lng || a.lon || 0
      );
      const distB = calculateDistance(
        userLocation.latitude, 
        userLocation.longitude,
        b.lat,
        b.lng || b.lon || 0
      );
      return distA - distB;
    })
    .slice(0, 3); // Возвращаем максимум 3 альтернативы
}

/**
 * Формирование рекомендации для пользователя
 */
export async function generateRecommendation(
  parking: ParkingInfo,
  userLocation: UserLocation,
  allParkings: ParkingInfo[],
  forecasts?: Forecast[]
): Promise<ParkingRecommendation | null> {
  if (!parking || !userLocation || !parking.totalSpaces || !parking.freeSpaces) {
    return null;
  }

  // Расстояние от пользователя до парковки
  const distanceKm = calculateDistance(
    userLocation.latitude,
    userLocation.longitude,
    parking.lat,
    parking.lng || parking.lon || 0
  );

  // Оценка времени в пути
  const driveTimeMinutes = estimateDriveTime(distanceKm);

  // Оценка свободных мест к моменту прибытия
  const estimatedFreeSpaces = estimateFreeSpotsOnArrival(parking, driveTimeMinutes, forecasts);
  
  // Процент свободных мест от общего количества
  const freePercentage = (estimatedFreeSpaces / parking.totalSpaces) * 100;

  // Формируем рекомендацию на основе прогноза
  if (freePercentage >= AVAILABILITY_THRESHOLDS.high) {
    return {
      parking,
      recommendationType: 'good',
      message: `На этой парковке будет достаточно мест (примерно ${estimatedFreeSpaces}) через ${driveTimeMinutes} минут, когда вы доедете.`,
      estimatedDriveTimeMinutes: driveTimeMinutes,
      estimatedFreeSpacesOnArrival: estimatedFreeSpaces
    };
  } else if (freePercentage >= AVAILABILITY_THRESHOLDS.medium) {
    return {
      parking,
      recommendationType: 'good',
      message: `На этой парковке должны остаться свободные места (примерно ${estimatedFreeSpaces}) к вашему приезду через ${driveTimeMinutes} минут.`,
      estimatedDriveTimeMinutes: driveTimeMinutes,
      estimatedFreeSpacesOnArrival: estimatedFreeSpaces
    };
  } else if (freePercentage >= AVAILABILITY_THRESHOLDS.low) {
    // Ищем альтернативы
    const alternatives = findNearbyAlternatives(userLocation, parking, allParkings);
    
    if (alternatives.length > 0) {
      return {
        parking,
        recommendationType: 'alternative',
        message: `На этой парковке мало свободных мест (${estimatedFreeSpaces}). Рекомендуем рассмотреть близлежащие альтернативы.`,
        estimatedDriveTimeMinutes: driveTimeMinutes,
        estimatedFreeSpacesOnArrival: estimatedFreeSpaces,
        alternatives
      };
    } else {
      return {
        parking,
        recommendationType: 'negative',
        message: `На этой парковке мало свободных мест (${estimatedFreeSpaces}), а поблизости нет альтернативных перехватывающих парковок.`,
        estimatedDriveTimeMinutes: driveTimeMinutes,
        estimatedFreeSpacesOnArrival: estimatedFreeSpaces
      };
    }
  } else {
    // Критически мало мест или их нет
    const alternatives = findNearbyAlternatives(userLocation, parking, allParkings);
    
    if (alternatives.length > 0) {
      return {
        parking,
        recommendationType: 'alternative',
        message: `На этой парковке скорее всего не будет свободных мест к вашему прибытию. Рекомендуем рассмотреть близлежащие альтернативы.`,
        estimatedDriveTimeMinutes: driveTimeMinutes,
        estimatedFreeSpacesOnArrival: estimatedFreeSpaces,
        alternatives
      };
    } else {
      return {
        parking,
        recommendationType: 'negative',
        message: `На этой парковке скорее всего не будет свободных мест, а поблизости нет альтернативных перехватывающих парковок. Рекомендуем искать другие варианты.`,
        estimatedDriveTimeMinutes: driveTimeMinutes,
        estimatedFreeSpacesOnArrival: estimatedFreeSpaces
      };
    }
  }
} 