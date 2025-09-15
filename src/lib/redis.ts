import { createClient } from 'redis';

// Создаем Redis клиент только если мы не в процессе сборки
let redis: any = null;

function getRedisClient() {
  // Не создаем Redis клиент во время сборки Next.js
  if (process.env.NEXT_PHASE === 'phase-production-build') {
    return null;
  }
  
  if (!redis) {
    try {
      redis = createClient({
        url: process.env.REDIS_URL || 'redis://localhost:6379',
        socket: {
          connectTimeout: 10000,
          lazyConnect: true,
        },
      });

      // Обработка ошибок подключения
      redis.on('error', (err: any) => {
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
    } catch (error) {
      console.warn('Redis connection failed, continuing without cache:', error);
      return null;
    }
  }
  
  return redis;
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
      const client = getRedisClient();
      if (!client) return null;
      
      if (!client.isOpen) {
        await client.connect();
      }
      
      const cached = await client.get(key);
      return cached ? JSON.parse(cached) : null;
    } catch (error) {
      console.error('Cache get error:', error);
      return null;
    }
  }

  // Сохранить данные в кэш
  static async set(key: string, value: any, ttl: number = CACHE_TTL.PARKINGS): Promise<void> {
    try {
      const client = getRedisClient();
      if (!client) return;
      
      if (!client.isOpen) {
        await client.connect();
      }
      
      await client.setEx(key, ttl, JSON.stringify(value));
    } catch (error) {
      console.error('Cache set error:', error);
    }
  }

  // Удалить данные из кэша
  static async del(key: string): Promise<void> {
    try {
      const client = getRedisClient();
      if (!client) return;
      
      if (!client.isOpen) {
        await client.connect();
      }
      
      await client.del(key);
    } catch (error) {
      console.error('Cache delete error:', error);
    }
  }

  // Удалить все ключи по паттерну
  static async delPattern(pattern: string): Promise<void> {
    try {
      const client = getRedisClient();
      if (!client) return;
      
      if (!client.isOpen) {
        await client.connect();
      }
      
      const keys = await client.keys(pattern);
      if (keys.length > 0) {
        await client.del(keys);
      }
    } catch (error) {
      console.error('Cache delete pattern error:', error);
    }
  }

  // Проверить существование ключа
  static async exists(key: string): Promise<boolean> {
    try {
      const client = getRedisClient();
      if (!client) return false;
      
      if (!client.isOpen) {
        await client.connect();
      }
      
      const result = await client.exists(key);
      return result === 1;
    } catch (error) {
      console.error('Cache exists error:', error);
      return false;
    }
  }

  // Получить TTL ключа
  static async ttl(key: string): Promise<number> {
    try {
      const client = getRedisClient();
      if (!client) return -1;
      
      if (!client.isOpen) {
        await client.connect();
      }
      
      return await client.ttl(key);
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

export default getRedisClient;
