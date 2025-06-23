import { ParkingInfo, ParkingStats, ParkingData, VehicleType, ParkingPaymentCalculation, ParkingPaymentInfo } from "@/types/parking";

/**
 * Fetch all parking locations from the data file
 */
export async function getAllParkings(): Promise<ParkingInfo[]> {
  try {
    const response = await fetch('/data/parking_data.json');
    const data = await response.json();
    
    return data.map((parking: any) => {
      // Определяем является ли парковка перехватывающей по названию
      const isIntercepting = parking.name.toLowerCase().includes('перехватывающая парковка');
      
      return {
        id: parking.id,
        name: parking.name,
        street: parking.street || "",
        house: parking.house || "",
        subway: parking.subway || "",
        lat: parking.lat,
        lng: parking.lon || parking.lng,
        lon: parking.lon || parking.lng,
        polygon: parking.polygon || [],
        isFavorite: false,
        isIntercepting, // Добавляем флаг перехватывающей парковки
        // Initialize with null values for real-time data
        totalSpaces: null,
        freeSpaces: null,
        handicappedTotal: null,
        handicappedFree: null,
      };
    });
  } catch (error) {
    console.error("Error fetching parking data:", error);
    return [];
  }
}

/**
 * Fetch real-time data for a specific parking
 */
export async function getParkingRealTimeData(parkingId: string): Promise<{
  totalSpaces: number;
  freeSpaces: number;
  handicappedTotal: number;
  handicappedFree: number;
  dataAvailable?: boolean;
  isStale?: boolean;
} | null> {
  try {
    const response = await fetch(`/api/parkings/${parkingId}/live`);
    if (!response.ok) {
      throw new Error(`Failed to fetch parking data: ${response.statusText}`);
    }
    
    const data = await response.json();
    
    // Проверяем наличие флага dataAvailable
    if ('dataAvailable' in data && data.dataAvailable === false) {
      return {
        totalSpaces: 0,
        freeSpaces: 0,
        handicappedTotal: 0,
        handicappedFree: 0,
        dataAvailable: false
      };
    }
    
    return {
      totalSpaces: data.totalSpaces || 0,
      freeSpaces: data.freeSpaces || 0,
      handicappedTotal: data.handicappedTotal || 0,
      handicappedFree: data.handicappedFree || 0,
      isStale: data.isStale || false
    };
  } catch (error) {
    console.error(`Error fetching real-time data for parking ${parkingId}:`, error);
    return null;
  }
}

/**
 * Get the occupancy status class based on percentage of free spaces
 */
export function getOccupancyStatusClass(freeSpaces: number, totalSpaces: number): string {
  if (totalSpaces === 0) return 'status-unknown';
  
  const percentage = (freeSpaces / totalSpaces) * 100;
  
  if (percentage >= 30) return 'status-free';
  if (percentage >= 10) return 'status-limited';
  return 'status-full';
}

/**
 * Format parking statistics for display
 */
export function formatParkingStats(stats: ParkingStats[]): {
  labels: string[];
  data: number[];
  colors: string[];
} {
  const hours = stats.map(stat => `${stat.hour}:00`);
  const freeSpaces = stats.map(stat => stat.avg_free_spaces);
  
  // Generate colors based on occupancy
  const colors = stats.map(stat => {
    const occupancyPercent = stat.avg_occupancy * 100;
    if (occupancyPercent >= 90) return '#ef4444'; // red-500
    if (occupancyPercent >= 70) return '#f97316'; // orange-500
    return '#22c55e'; // green-500
  });
  
  return {
    labels: hours,
    data: freeSpaces,
    colors,
  };
}

/**
 * Получение информации о стоимости парковки из данных зон
 */
export async function getParkingPriceInfo(parkingId: string): Promise<{
  hourlyRate: number;
  currency: string;
} | null> {
  try {
    // Загружаем данные о зонах парковок из файла
    // Используем абсолютный URL с origin для работы на сервере
    const origin = typeof window !== 'undefined' ? window.location.origin : 'http://localhost:3000';
    const response = await fetch(`${origin}/data/all_zones_parking_data.json`);
    
    if (!response.ok) {
      throw new Error('Не удалось загрузить данные о зонах парковок');
    }
    
    const data = await response.json();
    
    // Проверяем структуру данных и логируем для отладки
    console.log('Структура данных:', typeof data, Array.isArray(data));
    
    // Проверяем, является ли data массивом, если нет - ищем массив внутри объекта
    let parkingsArray;
    if (Array.isArray(data)) {
      parkingsArray = data;
    } else if (data && typeof data === 'object') {
      // Ищем массив в свойствах объекта
      const possibleArrays = Object.values(data).filter(val => Array.isArray(val));
      if (possibleArrays.length > 0) {
        parkingsArray = possibleArrays[0];
        console.log('Найден массив парковок в объекте данных, длина:', parkingsArray.length);
      } else {
        console.error('Не удалось найти массив парковок в данных');
        parkingsArray = [];
      }
    } else {
      console.error('Неожиданный формат данных:', data);
      parkingsArray = [];
    }
    
    // Ищем парковку по ID
    const parkingZone = parkingsArray.find((zone: any) => zone.id === parkingId || zone.id?.toString() === parkingId);
    
    if (!parkingZone) {
      console.warn(`Парковка с ID ${parkingId} не найдена в данных о зонах`);
      // Если парковка не найдена, возвращаем стандартную стоимость
      return {
        hourlyRate: 40, // Стандартная стоимость 40 руб/час
        currency: 'RUB'
      };
    }
    
    // Извлекаем стоимость из данных
    // Формат может быть разным, поэтому обрабатываем несколько вариантов
    let hourlyRate = 0;
    const priceString = parkingZone.price || '';
    
    console.log('Информация о цене парковки:', priceString);
    
    // Пытаемся извлечь числовое значение из строки с ценой
    const priceMatch = priceString.match(/(\d+)/);
    if (priceMatch) {
      hourlyRate = parseInt(priceMatch[1], 10);
      console.log('Извлеченная стоимость:', hourlyRate);
    }
    
    // Если не удалось извлечь стоимость, используем стандартную
    if (hourlyRate === 0) {
      hourlyRate = 40; // Стандартная стоимость 40 руб/час
      console.log('Используем стандартную стоимость:', hourlyRate);
    }
    
    return {
      hourlyRate,
      currency: 'RUB' // Валюта всегда рубли
    };
  } catch (error) {
    console.error('Ошибка при получении информации о стоимости парковки:', error);
    // В случае ошибки возвращаем стандартную стоимость
    return {
      hourlyRate: 40, // Стандартная стоимость 40 руб/час
      currency: 'RUB'
    };
  }
}

/**
 * Расчет стоимости парковки
 */
export async function calculateParkingCost(paymentInfo: ParkingPaymentInfo): Promise<ParkingPaymentCalculation | null> {
  try {
    const priceInfo = await getParkingPriceInfo(paymentInfo.parkingId);
    
    if (!priceInfo) {
      throw new Error('Не удалось получить информацию о стоимости парковки');
    }
    
    let { hourlyRate } = priceInfo;
    
    // Применяем коэффициенты в зависимости от типа транспортного средства
    switch (paymentInfo.vehicleType) {
      case 'motorcycle':
        hourlyRate *= 0.5; // 50% от базовой стоимости для мотоциклов
        break;
      case 'truck':
        hourlyRate *= 2; // 200% от базовой стоимости для грузовиков
        break;
      default:
        // Для автомобилей базовая стоимость
        break;
    }
    
    const totalCost = hourlyRate * paymentInfo.duration;
    
    // Время начала и окончания парковки
    const startTime = paymentInfo.startTime ? 
      (typeof paymentInfo.startTime === 'string' ? new Date(paymentInfo.startTime) : paymentInfo.startTime) : 
      new Date();
    
    const endTime = new Date(startTime);
    endTime.setHours(endTime.getHours() + paymentInfo.duration);
    
    return {
      parkingId: paymentInfo.parkingId,
      totalCost,
      currency: priceInfo.currency,
      duration: paymentInfo.duration,
      hourlyRate,
      startTime,
      endTime
    };
  } catch (error) {
    console.error('Ошибка при расчете стоимости парковки:', error);
    return null;
  }
}

/**
 * Формирование URL для перехода на страницу оплаты
 */
export function getPaymentRedirectUrl(calculation: ParkingPaymentCalculation, vehicleNumber: string): string {
  // Используем Яндекс.Карты для оплаты парковки
  // Согласно https://rb.ru/news/yandex-parking/ Яндекс добавил функцию оплаты парковки в Москве
  return 'https://yandex.ru/maps/';
} 