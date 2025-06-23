// Типы для админ-панели

// Интерфейс для администратора
export interface AdminUser {
  id: string;
  telegramId: string;
  username?: string | null;
  fullName?: string | null;
  role: string;
  isActive: boolean;
  addedById?: string | null;
  createdAt: string;
}

// Интерфейс для Challenge
export interface AdminChallenge {
  id: string;
  title: string;
  description: string;
  reward: number;
  startDate: string;
  endDate: string;
  isActive: number | boolean;
  type: string;
  requirement: number;
  districtIds?: string | null;
  imageUrl?: string | null;
  parkIds?: string | null;
  completionsCount?: number;
}

// Интерфейс для PromoCode
export interface AdminPromoCode {
  id: string;
  code: string;
  reward: number;
  type: string;
  description?: string | null;
  isActive: boolean;
  expiresAt?: string | null;
  usageLimit?: number | null;
  usageCount: number;
  createdAt: string;
  createdBy?: string | null;
  redemptions?: { userId: string; redeemedAt: string }[];
}

// Интерфейс для Achievement
export interface AdminAchievement {
  id: string;
  name: string;
  description: string;
  category: string;
  reward: number;
  thresholds: number[];
  iconUrl?: string | null;
  earnedCount?: number;
} 