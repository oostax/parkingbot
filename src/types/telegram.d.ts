// Общие типы для Telegram API
interface TelegramAuthData {
  id: string | number;
  first_name?: string;
  last_name?: string;
  username?: string;
  photo_url?: string;
  auth_date: number;
  [key: string]: string | number | undefined;
}

interface TelegramLoginWidget {
  new (
    element: HTMLElement, 
    options: {
      botName: string;
      buttonSize: 'large' | 'medium' | 'small';
      cornerRadius: number;
      requestAccess: 'write' | 'read';
      usePic: boolean;
      lang: string;
      onAuth: (user: TelegramAuthData) => void;
    }
  ): unknown;
}

// Расширяем глобальный объект Window с типами Telegram
declare global {
  interface Window {
    Telegram?: {
      WebApp?: {
        initDataUnsafe: {
          user?: {
            id: number;
            first_name: string;
            last_name?: string;
            username?: string;
            photo_url?: string;
          };
        };
        ready?: () => void;
        onEvent?: (eventName: string, callback: (event: any) => void) => void;
        offEvent?: (eventName: string, callback: (event: any) => void) => void;
        postEvent?: (eventName: string, eventData?: any) => void;
      };
      Login?: {
        Widget: TelegramLoginWidget;
      };
    };
    TelegramWebviewProxy?: {
      postEvent: (eventName: string, eventData?: any) => void;
    };
    external?: {
      notify?: Function;
    };
  }
}

export type { TelegramAuthData, TelegramLoginWidget }; 