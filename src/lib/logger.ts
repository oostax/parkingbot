// Система логирования для приложения
export enum LogLevel {
  ERROR = 0,
  WARN = 1,
  INFO = 2,
  DEBUG = 3,
}

export interface LogEntry {
  timestamp: string;
  level: LogLevel;
  message: string;
  context?: Record<string, any>;
  userId?: string;
  requestId?: string;
  duration?: number;
}

class Logger {
  private level: LogLevel;
  private isDevelopment: boolean;

  constructor() {
    this.level = process.env.NODE_ENV === 'production' ? LogLevel.INFO : LogLevel.DEBUG;
    this.isDevelopment = process.env.NODE_ENV === 'development';
  }

  private formatMessage(level: LogLevel, message: string, context?: Record<string, any>): LogEntry {
    return {
      timestamp: new Date().toISOString(),
      level,
      message,
      context,
    };
  }

  private shouldLog(level: LogLevel): boolean {
    return level <= this.level;
  }

  private log(level: LogLevel, message: string, context?: Record<string, any>): void {
    if (!this.shouldLog(level)) return;

    const entry = this.formatMessage(level, message, context);
    
    if (this.isDevelopment) {
      // В development режиме выводим в консоль с цветами
      const colors = {
        [LogLevel.ERROR]: '\x1b[31m', // красный
        [LogLevel.WARN]: '\x1b[33m',  // желтый
        [LogLevel.INFO]: '\x1b[36m',  // голубой
        [LogLevel.DEBUG]: '\x1b[90m', // серый
      };
      const reset = '\x1b[0m';
      
      console.log(
        `${colors[level]}[${LogLevel[level]}]${reset} ${entry.timestamp} - ${entry.message}`,
        context ? JSON.stringify(context, null, 2) : ''
      );
    } else {
      // В production режиме выводим в формате JSON
      console.log(JSON.stringify(entry));
    }
  }

  error(message: string, context?: Record<string, any>): void {
    this.log(LogLevel.ERROR, message, context);
  }

  warn(message: string, context?: Record<string, any>): void {
    this.log(LogLevel.WARN, message, context);
  }

  info(message: string, context?: Record<string, any>): void {
    this.log(LogLevel.INFO, message, context);
  }

  debug(message: string, context?: Record<string, any>): void {
    this.log(LogLevel.DEBUG, message, context);
  }

  // Специальные методы для API
  apiRequest(method: string, path: string, userId?: string, duration?: number): void {
    this.info(`API Request: ${method} ${path}`, {
      method,
      path,
      userId,
      duration: duration ? `${duration}ms` : undefined,
    });
  }

  apiError(method: string, path: string, error: Error, userId?: string): void {
    this.error(`API Error: ${method} ${path}`, {
      method,
      path,
      error: error.message,
      stack: error.stack,
      userId,
    });
  }

  // Специальные методы для кэша
  cacheHit(key: string, ttl?: number): void {
    this.debug(`Cache hit: ${key}`, { key, ttl });
  }

  cacheMiss(key: string): void {
    this.debug(`Cache miss: ${key}`, { key });
  }

  cacheSet(key: string, ttl: number): void {
    this.debug(`Cache set: ${key}`, { key, ttl });
  }

  cacheInvalidate(key: string): void {
    this.debug(`Cache invalidate: ${key}`, { key });
  }

  // Специальные методы для базы данных
  dbQuery(query: string, duration?: number, params?: any[]): void {
    this.debug(`DB Query executed`, {
      query: query.substring(0, 100) + (query.length > 100 ? '...' : ''),
      duration: duration ? `${duration}ms` : undefined,
      params: params?.length ? params.length : undefined,
    });
  }

  dbError(query: string, error: Error): void {
    this.error(`DB Query error`, {
      query: query.substring(0, 100) + (query.length > 100 ? '...' : ''),
      error: error.message,
    });
  }

  // Специальные методы для производительности
  performance(operation: string, duration: number, context?: Record<string, any>): void {
    this.info(`Performance: ${operation}`, {
      operation,
      duration: `${duration}ms`,
      ...context,
    });
  }

  // Специальные методы для пользователей
  userAction(userId: string, action: string, context?: Record<string, any>): void {
    this.info(`User action: ${action}`, {
      userId,
      action,
      ...context,
    });
  }

  // Специальные методы для безопасности
  security(event: string, context?: Record<string, any>): void {
    this.warn(`Security event: ${event}`, {
      event,
      ...context,
    });
  }
}

// Создаем единственный экземпляр логгера
export const logger = new Logger();

// Утилиты для измерения производительности
export function measureTime<T>(operation: string, fn: () => T): T {
  const start = Date.now();
  try {
    const result = fn();
    const duration = Date.now() - start;
    logger.performance(operation, duration);
    return result;
  } catch (error) {
    const duration = Date.now() - start;
    logger.error(`Performance error: ${operation}`, {
      operation,
      duration: `${duration}ms`,
      error: error instanceof Error ? error.message : 'Unknown error',
    });
    throw error;
  }
}

export async function measureTimeAsync<T>(operation: string, fn: () => Promise<T>): Promise<T> {
  const start = Date.now();
  try {
    const result = await fn();
    const duration = Date.now() - start;
    logger.performance(operation, duration);
    return result;
  } catch (error) {
    const duration = Date.now() - start;
    logger.error(`Performance error: ${operation}`, {
      operation,
      duration: `${duration}ms`,
      error: error instanceof Error ? error.message : 'Unknown error',
    });
    throw error;
  }
}

// Middleware для логирования API запросов
export function logApiRequest(method: string, path: string, userId?: string) {
  return function (target: any, propertyKey: string, descriptor: PropertyDescriptor) {
    const originalMethod = descriptor.value;
    
    descriptor.value = async function (...args: any[]) {
      const start = Date.now();
      try {
        const result = await originalMethod.apply(this, args);
        const duration = Date.now() - start;
        logger.apiRequest(method, path, userId, duration);
        return result;
      } catch (error) {
        logger.apiError(method, path, error as Error, userId);
        throw error;
      }
    };
    
    return descriptor;
  };
}
