import { NextApiRequest, NextApiResponse } from "next";
import { getServerSession } from "next-auth";
import { authOptions } from "@/app/api/auth/options";
import prisma from "@/lib/prisma";
import { UserProfile } from "@/types/gamification";

export default async function handler(
  req: NextApiRequest,
  res: NextApiResponse
) {
  const session = await getServerSession(req, res, authOptions);

  if (!session || !session.user) {
    return res.status(401).json({ error: "Не авторизован" });
  }

  try {
    // Получаем пользователя из базы данных
    const user = await prisma.user.findUnique({
      where: {
        id: session.user.id,
      },
    });

    if (!user) {
      return res.status(404).json({ error: "Пользователь не найден" });
    }

    // Получаем профиль пользователя из базы данных или создаем новый
    let userProfile = await prisma.userProfile.findUnique({
      where: {
        userId: user.id,
      },
    });

    // Если профиля нет, создаем новый с начальными значениями
    if (!userProfile) {
      userProfile = await prisma.userProfile.create({
        data: {
          userId: user.id,
          tokenBalance: 0,
          status: "Regular",
          totalParksVisited: 0,
          uniqueParksVisited: 0,
          consecutiveLoginDays: 1,
          totalTokensEarned: 0,
          totalTokensSpent: 0,
          referralsCount: 0,
          challengesCompleted: 0,
        },
      });

      // Добавляем начальные токены для нового пользователя
      await prisma.tokenTransaction.create({
        data: {
          userId: user.id,
          amount: 10,
          type: "WELCOME_BONUS",
          description: "Приветственный бонус",
        },
      });

      // Обновляем баланс токенов
      userProfile = await prisma.userProfile.update({
        where: {
          userId: user.id,
        },
        data: {
          tokenBalance: 10,
          totalTokensEarned: 10,
        },
      });
    }

    // Обновляем дату последнего входа
    await prisma.userProfile.update({
      where: {
        userId: user.id,
      },
      data: {
        lastLoginAt: new Date(),
      },
    });

    // Получаем посещенные районы
    const userDistricts = await prisma.userDistrict.findMany({
      where: {
        userId: user.id,
      },
      select: {
        district: true,
      },
    });

    // Форматируем данные для ответа
    const formattedProfile: UserProfile = {
      id: user.id,
      telegramId: user.telegramId || undefined,
      username: user.username || undefined,
      displayName: `${user.firstName || ''} ${user.lastName || ''}`.trim() || "Пользователь",
      avatarUrl: user.image || undefined,
      tokenBalance: userProfile.tokenBalance,
      status: userProfile.status as any,
      joinedAt: user.createdAt,
      lastLoginAt: userProfile.lastLoginAt,
      carModel: userProfile.carModel || undefined,
      district: userProfile.district || undefined,
      stats: {
        totalParksVisited: userProfile.totalParksVisited,
        uniqueParksVisited: userProfile.uniqueParksVisited,
        consecutiveLoginDays: userProfile.consecutiveLoginDays,
        totalTokensEarned: userProfile.totalTokensEarned,
        totalTokensSpent: userProfile.totalTokensSpent,
        referralsCount: userProfile.referralsCount,
        challengesCompleted: userProfile.challengesCompleted,
        districtsVisited: userDistricts.map(d => d.district),
      },
      friends: [],
    };

    return res.status(200).json({ profile: formattedProfile });
  } catch (error) {
    console.error("Error fetching user profile:", error);
    return res.status(500).json({ error: "Ошибка сервера" });
  }
} 