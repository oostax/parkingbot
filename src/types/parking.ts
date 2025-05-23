export type Polygon = [number, number][];

export interface ParkingData {
  id: string;
  name: string;
  street: string;
  house?: string;
  subway?: string;
  lat: number;
  lng: number;
  lon?: number; // Для совместимости
  carCapacity?: number;
  price: string;
  schedule: string;
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
  polygon?: Polygon;
}

export interface ParkingStats {
  hour: number;
  avg_free_spaces: number;
  avg_occupancy: number;
} 