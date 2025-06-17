import { useState, useEffect } from 'react';

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

export function useTelegramLocation(): LocationHookResult {
  const [location, setLocation] = useState<TelegramLocationData | null>(null);
  const [loading, setLoading] = useState<boolean>(false);
  const [error, setError] = useState<string | null>(null);

  // Проверяем доступность Telegram API
  const isTelegramAvailable = typeof window !== 'undefined' && 
    window.Telegram && 
    window.Telegram.WebApp;

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

  // Функция для запроса местоположения
  const requestLocation = async (): Promise<TelegramLocationData | null> => {
    if (!isTelegramAvailable) {
      setError('Telegram API не доступен');
      return null;
    }

    setLoading(true);
    setError(null);

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
          if (event.status === 'allowed' && event.location) {
            const locationData: TelegramLocationData = {
              latitude: event.location.latitude,
              longitude: event.location.longitude,
              horizontal_accuracy: event.location.horizontal_accuracy
            };
            setLocation(locationData);
            setLoading(false);
            resolve(locationData);
          } else {
            setError('Доступ к местоположению не предоставлен');
            setLoading(false);
            resolve(null);
          }
        });
      });
    } catch (err: any) {
      setError(err.message || 'Ошибка при получении местоположения');
      setLoading(false);
      return null;
    }
  };

  return {
    location,
    loading,
    error,
    requestLocation
  };
} 