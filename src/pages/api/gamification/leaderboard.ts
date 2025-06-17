import { NextApiRequest, NextApiResponse } from "next";
import { getServerSession } from "next-auth";
import { authOptions } from "@/app/api/auth/options";
import prisma from "@/lib/prisma";
import { LeaderboardEntry } from "@/types/gamification";

export default async function handler(
  req: NextApiRequest,
  res: NextApiResponse
) {
  try {
    const session = await getServerSession(req, res, authOptions);

    if (!session || !session.user) {
      return res.status(401).json({ error: "Не авторизован" });
    }

    try {
      // Получаем всех пользователей с их профилями
      const usersWithProfiles = await prisma.user.findMany({
        include: {
          userProfile: true,
        },
        orderBy: {
          userProfile: {
            tokenBalance: 'desc',
          },
        },
        take: 20, // Ограничиваем количество записей для производительности
      });

      // Форматируем данные для таблицы лидеров
      const leaderboard: LeaderboardEntry[] = usersWithProfiles
        .filter(user => user.userProfile) // Фильтруем пользователей без профиля
        .map((user, index) => {
          // Определяем, является ли текущий пользователь текущим пользователем сессии
          const isCurrentUser = user.id === session.user!.id;

          // Анонимизируем имена пользователей, кроме текущего пользователя
          const displayName = isCurrentUser 
            ? `${user.firstName || ''} ${user.lastName || ''}`.trim() || "Пользователь"
            : `Пользователь ${index + 1}`;

          return {
            id: user.id,
            rank: index + 1,
            displayName,
            avatarUrl: isCurrentUser ? user.image || undefined : undefined,
            score: user.userProfile!.tokenBalance,
            isCurrentUser,
            status: user.userProfile!.status as any,
          };
        });

      return res.status(200).json({ leaderboard });
    } catch (error) {
      console.error("Error fetching leaderboard:", error);
      return res.status(500).json({ error: "Ошибка сервера при получении таблицы лидеров" });
    }
  } catch (error) {
    console.error("Error in session handling:", error);
    return res.status(500).json({ error: "Ошибка сервера при обработке сессии" });
  }
} 