import { useState, useEffect, useCallback, useRef } from 'react';

// Определение типов для Telegram WebApp API
declare global {
  interface Window {
    Telegram?: {
      WebApp: any;
    };
    TelegramWebviewProxy?: {
      postEvent: (eventName: string, eventData?: any) => void;
    };
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

/**
 * Безопасная отправка события в Telegram WebApp
 * Проверяет различные методы отправки согласно документации Telegram
 */
function sendTelegramEvent(eventName: string, eventData: any = {}): boolean {
  try {
    // Проверяем доступные способы отправки событий
    if (window.TelegramWebviewProxy && window.TelegramWebviewProxy.postEvent) {
      // Способ 1: WebviewProxy (мобильные приложения)
      window.TelegramWebviewProxy.postEvent(eventName, eventData);
      return true;
    } else if (window.external && 'notify' in window.external) {
      // Способ 2: window.external.notify (для некоторых клиентов)
      const notifyMethod = (window.external as any).notify;
      if (typeof notifyMethod === 'function') {
        notifyMethod(JSON.stringify({eventType: eventName, eventData: eventData}));
        return true;
      }
    } else if (window.Telegram && window.Telegram.WebApp) {
      // Проверяем доступ к методу postEvent в Telegram.WebApp
      const tg = window.Telegram.WebApp;
      if (typeof tg.postEvent === 'function') {
        tg.postEvent(eventName, eventData);
        return true;
      }
    }
    
    // Способ 3: postMessage API (для веб-клиентов в iframe)
    if (window !== window.parent) {
      window.parent.postMessage(JSON.stringify({eventType: eventName, eventData: eventData}), '*');
      return true;
    }
    
    console.warn('Не удалось найти метод для отправки события Telegram:', eventName);
    return false;
  } catch (e) {
    console.error('Ошибка при отправке события Telegram:', e);
    return false;
  }
}

/**
 * Настройка обработчика событий от Telegram
 */
function setupTelegramEventListener(eventName: string, callback: (event: any) => void): () => void {
  if (window.Telegram && window.Telegram.WebApp && typeof window.Telegram.WebApp.onEvent === 'function') {
    // Функция для установки слушателя
    window.Telegram.WebApp.onEvent(eventName, callback);
    
    // Возвращаем функцию для удаления слушателя
    return () => {
      if (window.Telegram?.WebApp?.offEvent) {
        window.Telegram.WebApp.offEvent(eventName, callback);
      }
    };
  }
  
  // Для поддержки postMessage API
  const messageHandler = (e: MessageEvent) => {
    try {
      const data = JSON.parse(e.data);
      if (data.eventType === eventName) {
        callback(data.eventData);
      }
    } catch (err) {
      // Игнорируем ошибки парсинга
    }
  };
  
  window.addEventListener('message', messageHandler);
  
  // Возвращаем функцию для удаления слушателя
  return () => {
    window.removeEventListener('message', messageHandler);
  };
}

export function useTelegramLocation(): LocationHookResult {
  const [location, setLocation] = useState<TelegramLocationData | null>(null);
  const [loading, setLoading] = useState<boolean>(false);
  const [error, setError] = useState<string | null>(null);
  
  // Флаг, чтобы предотвратить одновременные запросы
  const requestInProgressRef = useRef<boolean>(false);

  // Проверяем доступность Telegram API
  const isTelegramAvailable = typeof window !== 'undefined' && 
    ((window.Telegram && window.Telegram.WebApp) || window.TelegramWebviewProxy);

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
        if (window.Telegram?.WebApp?.ready) {
          window.Telegram.WebApp.ready();
        }
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
        // Отправляем событие проверки местоположения
        const sent = sendTelegramEvent('web_app_check_location', {});
        
        if (!sent) {
          // Если не удалось отправить событие, используем встроенное API геолокации браузера
          console.log('Не удалось отправить событие Telegram, используем геолокацию браузера');
          resolve();
          return;
        }
        
        // Устанавливаем обработчик события
        const removeListener = setupTelegramEventListener('location_checked', (event: any) => {
          if (event.status === 'not_allowed') {
            // Если доступ запрещен, просим открыть настройки
            sendTelegramEvent('web_app_open_location_settings', {});
          }
          removeListener();
          resolve();
        });
        
        // Таймаут для случая, если ответ от Telegram не придет
        setTimeout(() => {
          removeListener();
          resolve();
        }, 1500);
      });

      // Сначала пробуем запросить местоположение через Telegram API
      const telegramLocation = await new Promise<TelegramLocationData | null>((resolve) => {
        // Отправляем запрос на получение местоположения
        const sent = sendTelegramEvent('web_app_request_location', {});
        
        if (!sent) {
          // Если не удалось отправить событие, переходим к запросу через API браузера
          resolve(null);
          return;
        }
        
        // Устанавливаем обработчик события
        const removeListener = setupTelegramEventListener('location_requested', (event: any) => {
          removeListener();
          
          if (event.status === 'allowed' && event.location) {
            resolve({
              latitude: event.location.latitude,
              longitude: event.location.longitude,
              horizontal_accuracy: event.location.horizontal_accuracy
            });
          } else {
            resolve(null);
          }
        });
        
        // Таймаут для случая, если ответ от Telegram не придет
        setTimeout(() => {
          removeListener();
          resolve(null);
        }, 1500);
      });
      
      // Если удалось получить местоположение через Telegram API
      if (telegramLocation) {
        setLocation(telegramLocation);
        setLoading(false);
        cacheLocation(telegramLocation);
        requestInProgressRef.current = false;
        return telegramLocation;
      }
      
      // Запасной вариант - используем API геолокации браузера
      if (navigator.geolocation) {
        return await new Promise<TelegramLocationData | null>((resolve) => {
          navigator.geolocation.getCurrentPosition(
            (position) => {
              const browserLocation: TelegramLocationData = {
                latitude: position.coords.latitude,
                longitude: position.coords.longitude,
                horizontal_accuracy: position.coords.accuracy
              };
              
              setLocation(browserLocation);
              setLoading(false);
              cacheLocation(browserLocation);
              requestInProgressRef.current = false;
              resolve(browserLocation);
            },
            (error) => {
              console.error('Ошибка получения геолокации браузера:', error);
              let errorMessage = 'Не удалось получить местоположение';
              
              switch (error.code) {
                case error.PERMISSION_DENIED:
                  errorMessage = 'Доступ к местоположению запрещен пользователем';
                  break;
                case error.POSITION_UNAVAILABLE:
                  errorMessage = 'Данные о местоположении недоступны';
                  break;
                case error.TIMEOUT:
                  errorMessage = 'Истекло время запроса на получение местоположения';
                  break;
              }
              
              setError(errorMessage);
              setLoading(false);
              requestInProgressRef.current = false;
              resolve(null);
            },
            { enableHighAccuracy: true, timeout: 5000, maximumAge: 0 }
          );
        });
      }
      
      setError('API геолокации недоступно');
      setLoading(false);
      requestInProgressRef.current = false;
      return null;
      
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