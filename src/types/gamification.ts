export type UserStatus = 'Regular' | 'Silver' | 'Gold' | 'Platinum';

export interface UserAchievement {
  id: string;
  name: string;
  description: string;
  imageUrl: string;
  earned: boolean;
  earnedAt?: Date;
  progress?: number; // Процент выполнения (0-100)
  totalRequired?: number; // Общее количество для выполнения
  currentProgress?: number; // Текущий прогресс
}

export interface UserStats {
  totalParksVisited: number;
  uniqueParksVisited: number;
  consecutiveLoginDays: number;
  totalTokensEarned: number;
  totalTokensSpent: number;
  referralsCount: number;
  challengesCompleted: number;
  districtsVisited: string[]; // Список посещенных районов
}

export interface TokenTransaction {
  id: string;
  userId: string;
  amount: number; // Положительное число - начисление, отрицательное - списание
  type: 'daily_login' | 'achievement' | 'referral' | 'profile_completion' | 'wheel_spin' | 'challenge' | 'premium' | 'park_visit' | 'spend' | 'other';
  description: string;
  createdAt: Date;
}

export interface UserProfile {
  id: string;
  telegramId?: string;
  username?: string;
  displayName: string;
  avatarUrl?: string;
  district?: string; // Район проживания
  carModel?: string;
  carColor?: string;
  tokenBalance: number;
  status: UserStatus;
  joinedAt: Date;
  lastLoginAt: Date;
  stats: UserStats;
  friends: string[]; // Массив ID друзей (до 3-х)
}

export interface Challenge {
  id: string;
  title: string;
  description: string;
  imageUrl: string;
  tokenReward: number;
  startDate: Date;
  endDate: Date;
  type: 'visit_parks' | 'daily_login' | 'invite_friends' | 'use_specific_parks' | 'other';
  requirements: {
    count?: number; // Количество для выполнения
    parkIds?: string[]; // Список ID парковок для посещения
    districtIds?: string[]; // Список районов для посещения
  };
  progress?: number; // Процент выполнения (0-100)
}

export interface WheelPrize {
  id: string;
  name: string;
  description: string;
  imageUrl?: string;
  type: 'tokens' | 'discount' | 'partner_reward' | 'status_boost';
  value: number | string; // Количество токенов или описание приза
  probability: number; // Вероятность выпадения (0-100)
}

export interface LeaderboardEntry {
  id: string;
  rank: number;
  displayName: string;
  avatarUrl?: string;
  score: number;
  isCurrentUser: boolean;
  status: UserStatus;
}

export interface StatusRequirement {
  status: UserStatus;
  requiredTokenBalance: number;
  benefits: {
    dailyWheelSpins: number;
    loginBonus: number; // Множитель для ежедневного бонуса
    partnerDiscountMultiplier: number; // Множитель для скидок у партнеров
  };
} 