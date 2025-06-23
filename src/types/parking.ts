export type Polygon = [number, number][];

export interface ParkingData {
  id: string;
  name: string;
  street?: string;
  house?: string;
  subway?: string;
  lat: number;
  lng: number;
  lon?: number; // Для совместимости
  carCapacity?: number;
  price?: string;
  schedule?: string;
  workingHours?: string;
  type?: string;
  paidEntrance?: boolean;
  isClosedBarrier?: boolean;
  polygon?: Polygon;
}

export interface ParkingInfo extends ParkingData {
  totalSpaces?: number;
  freeSpaces?: number;
  handicappedTotal?: number;
  handicappedFree?: number;
  isFavorite?: boolean;
  isIntercepting?: boolean; // Флаг, указывающий, является ли парковка перехватывающей
  isPaid?: boolean; // Флаг, указывающий, является ли парковка платной
  polygon?: Polygon;
  region?: string; // Регион для оптимизации запросов (ne, nw, se, sw)
  price?: string; // Информация о стоимости
  schedule?: string; // График работы
  address?: {
    street?: {
      ru?: string;
      en?: string;
    };
    house?: {
      ru?: string;
      en?: string;
    };
  };
  spaces?: {
    total?: number;
    handicapped?: number;
  };
}

export interface ParkingStats {
  hour: number;
  avg_free_spaces: number;
  avgFreeSpaces?: number;
  avg_occupancy: number;
}

export interface Forecast {
  timestamp: string;
  expected_occupancy: number;
  expected_free_spaces: number;
}

// Типы для оплаты парковки
export type VehicleType = 'car' | 'motorcycle' | 'truck';

export interface ParkingPaymentInfo {
  parkingId: string;
  vehicleType: VehicleType;
  vehicleNumber: string;
  duration: number; // Длительность парковки в часах
  startTime?: Date | string; // Время начала парковки (может быть строкой ISO)
}

export interface ParkingPaymentCalculation {
  parkingId: string;
  totalCost: number;
  currency: string;
  duration: number;
  hourlyRate: number;
  discount?: number;
  startTime?: Date;
  endTime?: Date;
} 