import fs from 'fs/promises';
import path from 'path';
import { ParkingInfo } from '@/types/parking';
import { logger } from './logger';

// Интерфейс для оптимизированных данных парковок
interface OptimizedParkingData {
  id: string;
  name: string;
  street?: string;
  house?: string;
  subway?: string;
  lat: number;
  lng: number;
  totalSpaces?: number;
  freeSpaces?: number;
  handicappedTotal?: number;
  handicappedFree?: number;
  price?: string;
  schedule?: string;
  isIntercepting: boolean;
  isPaid: boolean;
  region: string; // NE, NW, SE, SW для оптимизации поиска
  lastUpdated: string;
}

// Класс для оптимизации данных парковок
export class ParkingDataOptimizer {
  private static instance: ParkingDataOptimizer;
  private cache: Map<string, OptimizedParkingData[]> = new Map();
  private lastUpdate: Map<string, number> = new Map();
  private readonly CACHE_TTL = 5 * 60 * 1000; // 5 минут

  static getInstance(): ParkingDataOptimizer {
    if (!ParkingDataOptimizer.instance) {
      ParkingDataOptimizer.instance = new ParkingDataOptimizer();
    }
    return ParkingDataOptimizer.instance;
  }

  // Определяем регион по координатам
  private getRegion(lat: number, lng: number): string {
    // Центр Москвы примерно 55.7558, 37.6176
    const centerLat = 55.7558;
    const centerLng = 37.6176;
    
    if (lat >= centerLat && lng >= centerLng) return 'NE'; // Северо-восток
    if (lat >= centerLat && lng < centerLng) return 'NW';  // Северо-запад
    if (lat < centerLat && lng >= centerLng) return 'SE';  // Юго-восток
    return 'SW'; // Юго-запад
  }

  // Оптимизируем данные парковки
  private optimizeParkingData(parking: any): OptimizedParkingData {
    const lat = parking.location?.coordinates?.[1] || parking.lat || 0;
    const lng = parking.location?.coordinates?.[0] || parking.lng || parking.lon || 0;
    
    return {
      id: String(parking._id || parking.id || Date.now() + Math.random().toString(36).substring(2, 9)),
      name: parking.name?.ru || parking.name?.en || parking.name || "Парковка",
      street: parking.address?.street?.ru || parking.address?.street?.en || parking.street || "",
      house: parking.address?.house?.ru || parking.address?.house?.en || parking.house || "",
      subway: parking.subway?.ru || parking.subway?.en || parking.subway || "",
      lat,
      lng,
      totalSpaces: parking.spaces?.total || parking.totalSpaces || 0,
      freeSpaces: parking.freeSpaces || 0,
      handicappedTotal: parking.spaces?.handicapped || parking.handicappedTotal || 0,
      handicappedFree: parking.handicappedFree || 0,
      price: parking.category?.price || parking.price || "Платная",
      schedule: parking.workingHours || parking.schedule || "Круглосуточно",
      isIntercepting: parking.name?.toLowerCase().includes('перехватывающая парковка') || false,
      isPaid: !parking.name?.toLowerCase().includes('перехватывающая парковка'),
      region: this.getRegion(lat, lng),
      lastUpdated: new Date().toISOString()
    };
  }

  // Загружаем и оптимизируем данные парковок
  async loadOptimizedData(type: 'intercepting' | 'paid' | 'all'): Promise<OptimizedParkingData[]> {
    const cacheKey = `parkings_${type}`;
    const now = Date.now();
    
    // Проверяем кэш
    if (this.cache.has(cacheKey) && this.lastUpdate.has(cacheKey)) {
      const lastUpdate = this.lastUpdate.get(cacheKey)!;
      if (now - lastUpdate < this.CACHE_TTL) {
        logger.debug(`Using cached data for ${type} parkings`);
        return this.cache.get(cacheKey)!;
      }
    }

    logger.info(`Loading and optimizing ${type} parking data`);
    const startTime = Date.now();

    try {
      let allParkings: OptimizedParkingData[] = [];

      if (type === 'intercepting' || type === 'all') {
        const interceptingPath = path.join(process.cwd(), 'public', 'data', 'parking_data.json');
        const interceptingContent = await fs.readFile(interceptingPath, 'utf-8');
        const interceptingData = JSON.parse(interceptingContent) as any[];
        
        const optimizedIntercepting = interceptingData.map(parking => this.optimizeParkingData(parking));
        allParkings = [...allParkings, ...optimizedIntercepting];
        
        logger.info(`Loaded ${optimizedIntercepting.length} intercepting parkings`);
      }

      if (type === 'paid' || type === 'all') {
        const paidPath = path.join(process.cwd(), 'public', 'data', 'all_parking_data.json');
        const paidContent = await fs.readFile(paidPath, 'utf-8');
        const paidData = JSON.parse(paidContent);
        
        let paidParkings: any[] = [];
        if (paidData && paidData.parkings && Array.isArray(paidData.parkings)) {
          paidParkings = paidData.parkings;
        } else if (Array.isArray(paidData)) {
          paidParkings = paidData;
        }
        
        const optimizedPaid = paidParkings.map(parking => this.optimizeParkingData(parking));
        allParkings = [...allParkings, ...optimizedPaid];
        
        logger.info(`Loaded ${optimizedPaid.length} paid parkings`);
      }

      // Удаляем дубликаты по ID
      const uniqueParkings = allParkings.filter((parking, index, self) => 
        index === self.findIndex(p => p.id === parking.id)
      );

      // Сохраняем в кэш
      this.cache.set(cacheKey, uniqueParkings);
      this.lastUpdate.set(cacheKey, now);

      const duration = Date.now() - startTime;
      logger.performance(`Load and optimize ${type} parkings`, duration, {
        count: uniqueParkings.length,
        type
      });

      return uniqueParkings;
    } catch (error) {
      logger.error(`Error loading ${type} parking data`, { error: error instanceof Error ? error.message : 'Unknown error' });
      throw error;
    }
  }

  // Поиск парковок с оптимизацией
  async searchParkings(
    type: 'intercepting' | 'paid' | 'all',
    searchQuery?: string,
    region?: string,
    limit: number = 50,
    offset: number = 0
  ): Promise<{ parkings: OptimizedParkingData[]; total: number }> {
    const allParkings = await this.loadOptimizedData(type);
    let filteredParkings = allParkings;

    // Фильтрация по поисковому запросу
    if (searchQuery) {
      const query = searchQuery.toLowerCase();
      filteredParkings = filteredParkings.filter(parking =>
        parking.name.toLowerCase().includes(query) ||
        parking.street?.toLowerCase().includes(query) ||
        parking.subway?.toLowerCase().includes(query)
      );
    }

    // Фильтрация по региону
    if (region) {
      filteredParkings = filteredParkings.filter(parking => parking.region === region);
    }

    // Применяем пагинацию
    const total = filteredParkings.length;
    const parkings = filteredParkings.slice(offset, offset + limit);

    logger.debug(`Search completed`, {
      type,
      searchQuery,
      region,
      total,
      returned: parkings.length,
      offset,
      limit
    });

    return { parkings, total };
  }

  // Получение статистики по регионам
  async getRegionStats(type: 'intercepting' | 'paid' | 'all'): Promise<Record<string, number>> {
    const allParkings = await this.loadOptimizedData(type);
    const stats: Record<string, number> = {};

    allParkings.forEach(parking => {
      stats[parking.region] = (stats[parking.region] || 0) + 1;
    });

    return stats;
  }

  // Очистка кэша
  clearCache(): void {
    this.cache.clear();
    this.lastUpdate.clear();
    logger.info('Parking data cache cleared');
  }

  // Получение информации о кэше
  getCacheInfo(): { size: number; lastUpdates: Record<string, string> } {
    const lastUpdates: Record<string, string> = {};
    this.lastUpdate.forEach((timestamp, key) => {
      lastUpdates[key] = new Date(timestamp).toISOString();
    });

    return {
      size: this.cache.size,
      lastUpdates
    };
  }
}

// Экспортируем единственный экземпляр
export const parkingDataOptimizer = ParkingDataOptimizer.getInstance();
