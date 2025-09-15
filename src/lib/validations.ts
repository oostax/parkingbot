import { z } from 'zod';

// Валидация данных парковки
export const parkingSchema = z.object({
  id: z.string().min(1, "ID парковки обязателен"),
  name: z.string().min(1, "Название парковки обязательно"),
  street: z.string().optional(),
  house: z.string().optional(),
  subway: z.string().optional(),
  lat: z.number().min(-90).max(90, "Некорректная широта"),
  lng: z.number().min(-180).max(180, "Некорректная долгота"),
  totalSpaces: z.number().min(0).optional(),
  freeSpaces: z.number().min(0).optional(),
  handicappedTotal: z.number().min(0).optional(),
  handicappedFree: z.number().min(0).optional(),
  price: z.string().optional(),
  schedule: z.string().optional(),
  isIntercepting: z.boolean().optional(),
  isPaid: z.boolean().optional(),
});

// Валидация запроса API парковок
export const parkingsQuerySchema = z.object({
  type: z.enum(['all', 'intercepting', 'paid']).default('all'),
  page: z.coerce.number().min(1).default(1),
  limit: z.coerce.number().min(1).max(100).default(50),
  search: z.string().optional(),
  noCache: z.coerce.boolean().optional(),
});

// Валидация данных избранного
export const favoriteSchema = z.object({
  parkingId: z.string().min(1, "ID парковки обязателен"),
});

// Валидация данных пользователя
export const userSchema = z.object({
  id: z.string().min(1),
  username: z.string().optional(),
  firstName: z.string().optional(),
  lastName: z.string().optional(),
  telegramId: z.string().optional(),
  email: z.string().email().optional(),
  image: z.string().url().optional(),
});

// Валидация Telegram данных
export const telegramAuthSchema = z.object({
  id: z.union([z.string(), z.number()]).transform(String),
  first_name: z.string().optional(),
  last_name: z.string().optional(),
  username: z.string().optional(),
  photo_url: z.string().url().optional(),
  auth_date: z.number().optional(),
  hash: z.string().optional(),
});

// Валидация данных профиля пользователя
export const userProfileSchema = z.object({
  userId: z.string().min(1),
  tokenBalance: z.number().min(0).default(0),
  status: z.enum(['Regular', 'Silver', 'Gold', 'Platinum']).default('Regular'),
  carModel: z.string().optional(),
  district: z.string().optional(),
  lastLoginAt: z.string().optional(),
  totalParksVisited: z.number().min(0).default(0),
  uniqueParksVisited: z.number().min(0).default(0),
  consecutiveLoginDays: z.number().min(1).default(1),
  totalTokensEarned: z.number().min(0).default(0),
  totalTokensSpent: z.number().min(0).default(0),
  referralsCount: z.number().min(0).default(0),
  challengesCompleted: z.number().min(0).default(0),
  districtsVisited: z.string().default("[]"),
});

// Валидация транзакций токенов
export const tokenTransactionSchema = z.object({
  userId: z.string().min(1),
  amount: z.number().int(),
  type: z.enum([
    'daily_login',
    'achievement', 
    'referral',
    'profile_completion',
    'wheel_spin',
    'challenge',
    'premium',
    'park_visit',
    'spend',
    'other'
  ]),
  description: z.string().min(1),
});

// Валидация челленджей
export const challengeSchema = z.object({
  title: z.string().min(1, "Название челленджа обязательно"),
  description: z.string().min(1, "Описание челленджа обязательно"),
  reward: z.number().min(0, "Награда не может быть отрицательной"),
  startDate: z.string().datetime(),
  endDate: z.string().datetime(),
  isActive: z.boolean().default(true),
  type: z.enum(['visit_parks', 'daily_login', 'invite_friends', 'use_specific_parks', 'other']),
  requirement: z.number().min(1, "Требование должно быть больше 0"),
  districtIds: z.string().optional(),
  imageUrl: z.string().url().optional(),
  parkIds: z.string().optional(),
});

// Валидация промокодов
export const promoCodeSchema = z.object({
  code: z.string().min(1, "Код промокода обязателен"),
  reward: z.number().min(0, "Награда не может быть отрицательной"),
  type: z.enum(['tokens', 'discount', 'status_boost']).default('tokens'),
  description: z.string().optional(),
  isActive: z.boolean().default(true),
  expiresAt: z.string().datetime().optional(),
  usageLimit: z.number().min(0).default(0),
});

// Валидация админских данных
export const adminUserSchema = z.object({
  telegramId: z.string().min(1, "Telegram ID обязателен"),
  username: z.string().optional(),
  fullName: z.string().optional(),
  role: z.enum(['admin', 'super_admin']).default('admin'),
  isActive: z.boolean().default(true),
  addedById: z.string().optional(),
});

// Валидация данных для оплаты парковки
export const parkingPaymentSchema = z.object({
  parkingId: z.string().min(1, "ID парковки обязателен"),
  vehicleType: z.enum(['car', 'motorcycle', 'truck']),
  vehicleNumber: z.string().min(1, "Номер транспортного средства обязателен"),
  duration: z.number().min(1, "Длительность должна быть больше 0"),
  startTime: z.string().datetime().optional(),
});

// Валидация данных для поиска
export const searchSchema = z.object({
  query: z.string().min(1, "Поисковый запрос не может быть пустым"),
  type: z.enum(['all', 'intercepting', 'paid']).optional(),
  location: z.object({
    lat: z.number().min(-90).max(90),
    lng: z.number().min(-180).max(180),
    radius: z.number().min(100).max(10000).default(1000), // радиус в метрах
  }).optional(),
});

// Утилиты для валидации
export function validateData<T>(schema: z.ZodSchema<T>, data: unknown): { success: true; data: T } | { success: false; errors: string[] } {
  try {
    const validatedData = schema.parse(data);
    return { success: true, data: validatedData };
  } catch (error) {
    if (error instanceof z.ZodError) {
      return {
        success: false,
        errors: error.errors.map(err => `${err.path.join('.')}: ${err.message}`)
      };
    }
    return {
      success: false,
      errors: ['Неизвестная ошибка валидации']
    };
  }
}

// Middleware для валидации API запросов
export function createValidationMiddleware<T>(schema: z.ZodSchema<T>) {
  return (data: unknown) => {
    const result = validateData(schema, data);
    if (!result.success) {
      throw new Error(`Validation failed: ${result.errors.join(', ')}`);
    }
    return result.data;
  };
}
