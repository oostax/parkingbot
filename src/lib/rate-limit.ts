import { NextRequest, NextResponse } from 'next/server';

// Простая реализация rate limiting для Next.js API routes
class RateLimiter {
  private requests: Map<string, { count: number; resetTime: number }> = new Map();
  private windowMs: number;
  private maxRequests: number;

  constructor(windowMs: number = 15 * 60 * 1000, maxRequests: number = 100) {
    this.windowMs = windowMs;
    this.maxRequests = maxRequests;
  }

  private getClientId(request: NextRequest): string {
    // Получаем IP адрес клиента
    const forwarded = request.headers.get('x-forwarded-for');
    const realIp = request.headers.get('x-real-ip');
    const ip = forwarded?.split(',')[0] || realIp || 'unknown';
    
    // Для авторизованных пользователей используем их ID
    const userId = request.headers.get('x-user-id');
    return userId || ip;
  }

  private cleanup(): void {
    const now = Date.now();
    for (const [key, value] of this.requests.entries()) {
      if (now > value.resetTime) {
        this.requests.delete(key);
      }
    }
  }

  isAllowed(request: NextRequest): { allowed: boolean; remaining: number; resetTime: number } {
    this.cleanup();
    
    const clientId = this.getClientId(request);
    const now = Date.now();
    const windowStart = now - this.windowMs;
    
    const clientData = this.requests.get(clientId);
    
    if (!clientData || now > clientData.resetTime) {
      // Новое окно или первый запрос
      this.requests.set(clientId, {
        count: 1,
        resetTime: now + this.windowMs
      });
      
      return {
        allowed: true,
        remaining: this.maxRequests - 1,
        resetTime: now + this.windowMs
      };
    }
    
    if (clientData.count >= this.maxRequests) {
      return {
        allowed: false,
        remaining: 0,
        resetTime: clientData.resetTime
      };
    }
    
    // Увеличиваем счетчик
    clientData.count++;
    this.requests.set(clientId, clientData);
    
    return {
      allowed: true,
      remaining: this.maxRequests - clientData.count,
      resetTime: clientData.resetTime
    };
  }
}

// Создаем экземпляры rate limiter для разных типов запросов
export const rateLimiters = {
  // Общий лимит для API
  general: new RateLimiter(15 * 60 * 1000, 100), // 100 запросов за 15 минут
  
  // Строгий лимит для авторизации
  auth: new RateLimiter(15 * 60 * 1000, 10), // 10 запросов за 15 минут
  
  // Лимит для поиска
  search: new RateLimiter(5 * 60 * 1000, 30), // 30 запросов за 5 минут
  
  // Лимит для геймификации
  gamification: new RateLimiter(1 * 60 * 1000, 20), // 20 запросов за минуту
};

// Middleware для проверки rate limit
export function withRateLimit(
  request: NextRequest,
  limiter: RateLimiter = rateLimiters.general
): NextResponse | null {
  const result = limiter.isAllowed(request);
  
  if (!result.allowed) {
    return NextResponse.json(
      {
        error: 'Too Many Requests',
        message: 'Превышен лимит запросов. Попробуйте позже.',
        retryAfter: Math.ceil((result.resetTime - Date.now()) / 1000)
      },
      {
        status: 429,
        headers: {
          'Retry-After': Math.ceil((result.resetTime - Date.now()) / 1000).toString(),
          'X-RateLimit-Limit': '100',
          'X-RateLimit-Remaining': result.remaining.toString(),
          'X-RateLimit-Reset': result.resetTime.toString(),
        }
      }
    );
  }
  
  return null;
}

// Декоратор для API routes
export function rateLimit(limiter: RateLimiter = rateLimiters.general) {
  return function (target: any, propertyKey: string, descriptor: PropertyDescriptor) {
    const originalMethod = descriptor.value;
    
    descriptor.value = async function (request: NextRequest, ...args: any[]) {
      const rateLimitResponse = withRateLimit(request, limiter);
      if (rateLimitResponse) {
        return rateLimitResponse;
      }
      
      return originalMethod.apply(this, [request, ...args]);
    };
    
    return descriptor;
  };
}

// Утилита для добавления заголовков rate limit в ответ
export function addRateLimitHeaders(response: NextResponse, limiter: RateLimiter, request: NextRequest): NextResponse {
  const result = limiter.isAllowed(request);
  
  response.headers.set('X-RateLimit-Limit', '100');
  response.headers.set('X-RateLimit-Remaining', result.remaining.toString());
  response.headers.set('X-RateLimit-Reset', result.resetTime.toString());
  
  return response;
}
