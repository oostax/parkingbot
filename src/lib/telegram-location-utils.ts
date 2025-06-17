import { UserLocation } from "./recommendation-service";

declare global {
  interface Window {
    Telegram?: {
      WebApp?: {
        ready: () => void;
        isExpanded: boolean;
        expand: () => void;
        MainButton: {
          text: string;
          color: string;
          textColor: string;
          isVisible: boolean;
          isActive: boolean;
          isProgressVisible: boolean;
          onClick: (callback: Function) => void;
          offClick: (callback: Function) => void;
          show: () => void;
          hide: () => void;
          enable: () => void;
          disable: () => void;
          showProgress: (leaveActive: boolean) => void;
          hideProgress: () => void;
          setText: (text: string) => void;
          setBackgroundColor: (color: string) => void;
          setTextColor: (color: string) => void;
        };
        BackButton: {
          isVisible: boolean;
          onClick: (callback: Function) => void;
          offClick: (callback: Function) => void;
          show: () => void;
          hide: () => void;
        };
        onEvent: (eventType: string, callback: Function) => void;
        offEvent: (eventType: string, callback: Function) => void;
        sendData: (data: any) => void;
        receiveEvent: (eventName: string, eventData: any) => void;
        version: string;
        colorScheme: string;
        themeParams: Record<string, string>;
        isClosingConfirmationEnabled: boolean;
        enableClosingConfirmation: () => void;
        disableClosingConfirmation: () => void;
        headerColor: string;
        backgroundColor: string;
        initData: string;
        initDataUnsafe: {
          query_id: string;
          user?: {
            id: number;
            first_name: string;
            last_name?: string;
            username?: string;
            language_code?: string;
          };
          auth_date: number;
          hash: string;
          start_param?: string;
        };
      };
    };
    TelegramWebviewProxy?: {
      postEvent: (eventType: string, eventData?: any) => void;
    };
  }
}

/**
 * Проверка, загружено ли приложение в контексте Telegram WebApp
 */
export function isTelegramWebAppAvailable(): boolean {
  return typeof window !== 'undefined' && !!window.Telegram?.WebApp;
}

/**
 * Запрос местоположения пользователя через Telegram WebApp API
 * @returns Promise с объектом UserLocation или ошибкой
 */
export async function requestUserLocation(): Promise<UserLocation> {
  if (!isTelegramWebAppAvailable()) {
    throw new Error('Telegram WebApp API не доступен');
  }

  return new Promise((resolve, reject) => {
    // Функция-обработчик для события location_requested
    function handleLocationRequested(eventData: any) {
      // Удаляем обработчик события после получения ответа
      window.Telegram!.WebApp!.offEvent('location_requested', handleLocationRequested);
      
      if (eventData.status === 'allowed' && eventData.latitude && eventData.longitude) {
        resolve({
          latitude: eventData.latitude,
          longitude: eventData.longitude
        });
      } else {
        reject(new Error('Не удалось получить местоположение пользователя'));
      }
    }

    try {
      // Регистрируем обработчик для события location_requested
      window.Telegram!.WebApp!.onEvent('location_requested', handleLocationRequested);
      
      // Отправляем запрос на получение местоположения
      if (window.TelegramWebviewProxy) {
        window.TelegramWebviewProxy.postEvent('web_app_request_location');
      } else {
        window.Telegram!.WebApp!.receiveEvent('web_app_request_location', null);
      }
      
      // Устанавливаем таймаут для случая, если ответ не будет получен
      setTimeout(() => {
        window.Telegram!.WebApp!.offEvent('location_requested', handleLocationRequested);
        reject(new Error('Время ожидания ответа истекло'));
      }, 30000); // 30 секунд таймаут
    } catch (error) {
      reject(error);
    }
  });
}

/**
 * Получение местоположения пользователя 
 * Сначала пытаемся через Telegram WebApp API, при неудаче - через браузерное геопозиционирование
 */
export async function getUserLocation(): Promise<UserLocation | null> {
  try {
    // Пробуем получить местоположение через Telegram WebApp API
    if (isTelegramWebAppAvailable()) {
      return await requestUserLocation();
    }
    
    // Если Telegram WebApp недоступен, используем стандартное браузерное геопозиционирование
    return await new Promise<UserLocation>((resolve, reject) => {
      if (!navigator.geolocation) {
        reject(new Error('Геолокация не поддерживается этим браузером'));
        return;
      }

      navigator.geolocation.getCurrentPosition(
        (position) => {
          resolve({
            latitude: position.coords.latitude,
            longitude: position.coords.longitude
          });
        },
        (error) => {
          reject(new Error(`Ошибка получения местоположения: ${error.message}`));
        },
        {
          enableHighAccuracy: true,
          timeout: 15000,
          maximumAge: 0
        }
      );
    });
  } catch (error) {
    console.error('Ошибка при получении местоположения:', error);
    return null;
  }
} 