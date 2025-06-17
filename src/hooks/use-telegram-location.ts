import { useState, useEffect, useCallback, useRef } from 'react';

// Определение типов для Telegram WebApp API
declare global {
  interface Window {
    Telegram?: {
      WebApp: {
        ready: () => void;
        postEvent: (eventName: string, eventData?: any) => void;
        onEvent: (eventName: string, callback: (event: any) => void) => void;
        initDataUnsafe: {
          user?: {
            id: number;
            first_name: string;
            last_name?: string;
            username?: string;
            photo_url?: string;
          }
        }
      }
    }
  }
}

interface TelegramLocationData {
  latitude: number;
  longitude: number;
  horizontal_accuracy?: number;
}

interface LocationHookResult {
  location: TelegramLocationData | null;
  loading: boolean;
  error: string | null;
  requestLocation: () => Promise<TelegramLocationData | null>;
}

// Ключ для хранения местоположения в sessionStorage
const LOCATION_STORAGE_KEY = 'telegram_location_data';
// Время истечения кеша местоположения (5 минут)
const LOCATION_CACHE_EXPIRY = 5 * 60 * 1000;

export function useTelegramLocation(): LocationHookResult {
  const [location, setLocation] = useState<TelegramLocationData | null>(null);
  const [loading, setLoading] = useState<boolean>(false);
  const [error, setError] = useState<string | null>(null);
  
  // Флаг, чтобы предотвратить одновременные запросы
  const requestInProgressRef = useRef<boolean>(false);

  // Проверяем доступность Telegram API
  const isTelegramAvailable = typeof window !== 'undefined' && 
    window.Telegram && 
    window.Telegram.WebApp;

  // Загрузка кешированных данных местоположения
  useEffect(() => {
    const loadCachedLocation = () => {
      try {
        const cachedData = sessionStorage.getItem(LOCATION_STORAGE_KEY);
        
        if (cachedData) {
          const parsedData = JSON.parse(cachedData);
          const timestamp = parsedData.timestamp;
          const now = Date.now();
          
          // Проверяем действительность кеша
          if (timestamp && now - timestamp < LOCATION_CACHE_EXPIRY) {
            const { latitude, longitude, horizontal_accuracy } = parsedData;
            setLocation({
              latitude,
              longitude,
              horizontal_accuracy
            });
            return true;
          }
        }
      } catch (e) {
        console.error('Ошибка при чтении кеша местоположения:', e);
      }
      return false;
    };
    
    // Пытаемся загрузить из кеша при монтировании
    loadCachedLocation();
  }, []);

  // Инициализируем Telegram WebApp
  useEffect(() => {
    if (isTelegramAvailable) {
      // Инициализируем веб-приложение
      try {
        window.Telegram?.WebApp.ready();
      } catch (e) {
        console.error('Ошибка инициализации Telegram WebApp:', e);
      }
    }
  }, [isTelegramAvailable]);

  // Функция для сохранения местоположения в кеш
  const cacheLocation = useCallback((locationData: TelegramLocationData) => {
    try {
      const dataToCache = {
        ...locationData,
        timestamp: Date.now()
      };
      sessionStorage.setItem(LOCATION_STORAGE_KEY, JSON.stringify(dataToCache));
    } catch (e) {
      console.error('Ошибка при сохранении местоположения в кеш:', e);
    }
  }, []);

  // Функция для запроса местоположения
  const requestLocation = useCallback(async (): Promise<TelegramLocationData | null> => {
    // Если уже есть в процессе запрос, возвращаем текущее местоположение
    if (requestInProgressRef.current) {
      return location;
    }
    
    if (!isTelegramAvailable) {
      setError('Telegram API не доступен');
      return null;
    }

    setLoading(true);
    setError(null);
    requestInProgressRef.current = true;

    try {
      // Проверяем статус доступа к геолокации
      await new Promise<void>((resolve) => {
        window.Telegram?.WebApp.postEvent('web_app_check_location', {});
        
        window.Telegram?.WebApp.onEvent('location_checked', (event: any) => {
          if (event.status === 'not_allowed') {
            // Если доступ запрещен, просим открыть настройки
            window.Telegram?.WebApp.postEvent('web_app_open_location_settings', {});
          }
          resolve();
        });
      });

      // Запрашиваем текущее местоположение
      return await new Promise<TelegramLocationData | null>((resolve) => {
        window.Telegram?.WebApp.postEvent('web_app_request_location', {});
        
        window.Telegram?.WebApp.onEvent('location_requested', (event: any) => {
          requestInProgressRef.current = false;
          
          if (event.status === 'allowed' && event.location) {
            const locationData: TelegramLocationData = {
              latitude: event.location.latitude,
              longitude: event.location.longitude,
              horizontal_accuracy: event.location.horizontal_accuracy
            };
            
            setLocation(locationData);
            setLoading(false);
            
            // Кешируем полученное местоположение
            cacheLocation(locationData);
            
            resolve(locationData);
          } else {
            setError('Доступ к местоположению не предоставлен');
            setLoading(false);
            resolve(null);
          }
        });
      });
    } catch (err: any) {
      requestInProgressRef.current = false;
      setError(err.message || 'Ошибка при получении местоположения');
      setLoading(false);
      return null;
    }
  }, [isTelegramAvailable, location, cacheLocation]);

  return {
    location,
    loading,
    error,
    requestLocation
  };
} 