import { createClient } from 'redis';

// Создаем Redis клиент
const redis = createClient({
  url: process.env.REDIS_URL || 'redis://localhost:6379',
  socket: {
    connectTimeout: 10000,
    lazyConnect: true,
  },
});

// Обработка ошибок подключения
redis.on('error', (err) => {
  console.error('Redis Client Error:', err);
});

redis.on('connect', () => {
  console.log('Redis Client Connected');
});

redis.on('ready', () => {
  console.log('Redis Client Ready');
});

// Подключаемся к Redis
if (!redis.isOpen) {
  redis.connect().catch(console.error);
}

// Время жизни кэша в секундах
export const CACHE_TTL = {
  PARKINGS: 300, // 5 минут
  PARKING_DETAILS: 180, // 3 минуты
  USER_PROFILE: 900, // 15 минут
  FAVORITES: 600, // 10 минут
  STATS: 3600, // 1 час
  LEADERBOARD: 300, // 5 минут
} as const;

// Утилиты для работы с кэшем
export class CacheService {
  // Получить данные из кэша
  static async get<T>(key: string): Promise<T | null> {
    try {
      if (!redis.isOpen) {
        await redis.connect();
      }
      
      const cached = await redis.get(key);
      return cached ? JSON.parse(cached) : null;
    } catch (error) {
      console.error('Cache get error:', error);
      return null;
    }
  }

  // Сохранить данные в кэш
  static async set(key: string, value: any, ttl: number = CACHE_TTL.PARKINGS): Promise<void> {
    try {
      if (!redis.isOpen) {
        await redis.connect();
      }
      
      await redis.setEx(key, ttl, JSON.stringify(value));
    } catch (error) {
      console.error('Cache set error:', error);
    }
  }

  // Удалить данные из кэша
  static async del(key: string): Promise<void> {
    try {
      if (!redis.isOpen) {
        await redis.connect();
      }
      
      await redis.del(key);
    } catch (error) {
      console.error('Cache delete error:', error);
    }
  }

  // Удалить все ключи по паттерну
  static async delPattern(pattern: string): Promise<void> {
    try {
      if (!redis.isOpen) {
        await redis.connect();
      }
      
      const keys = await redis.keys(pattern);
      if (keys.length > 0) {
        await redis.del(keys);
      }
    } catch (error) {
      console.error('Cache delete pattern error:', error);
    }
  }

  // Проверить существование ключа
  static async exists(key: string): Promise<boolean> {
    try {
      if (!redis.isOpen) {
        await redis.connect();
      }
      
      const result = await redis.exists(key);
      return result === 1;
    } catch (error) {
      console.error('Cache exists error:', error);
      return false;
    }
  }

  // Получить TTL ключа
  static async ttl(key: string): Promise<number> {
    try {
      if (!redis.isOpen) {
        await redis.connect();
      }
      
      return await redis.ttl(key);
    } catch (error) {
      console.error('Cache TTL error:', error);
      return -1;
    }
  }
}

// Генераторы ключей кэша
export const CacheKeys = {
  parkings: (type: string, page: number = 1, limit: number = 50, search?: string) => 
    `parkings:${type}:${page}:${limit}${search ? `:${search}` : ''}`,
  
  parkingDetails: (id: string) => 
    `parking:${id}`,
  
  userFavorites: (userId: string) => 
    `favorites:${userId}`,
  
  userProfile: (userId: string) => 
    `profile:${userId}`,
  
  stats: (parkingId: string, hour?: number) => 
    `stats:${parkingId}${hour ? `:${hour}` : ''}`,
  
  leaderboard: (type: string = 'tokens') => 
    `leaderboard:${type}`,
  
  achievements: (userId: string) => 
    `achievements:${userId}`,
} as const;

export default redis;
