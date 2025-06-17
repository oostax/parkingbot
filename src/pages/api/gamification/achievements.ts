import { NextApiRequest, NextApiResponse } from "next";
import { getServerSession } from "next-auth";
import { authOptions } from "@/app/api/auth/options";
import prisma from "@/lib/prisma";
import { UserAchievement } from "@/types/gamification";

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
      // Проверяем, что у пользователя есть id
      if (!session.user.id) {
        return res.status(400).json({ error: "Некорректный ID пользователя" });
      }

      // Получаем или создаем пользователя в базе данных
      let user = await prisma.user.findUnique({
        where: {
          id: session.user.id,
        },
      });

      // Если пользователя нет, создаем нового
      if (!user) {
        try {
          user = await prisma.user.create({
            data: {
              id: session.user.id,
              username: session.user.name?.toLowerCase().replace(/\s+/g, '') || undefined,
              firstName: session.user.name?.split(' ')[0] || undefined,
              lastName: session.user.name?.split(' ').slice(1).join(' ') || undefined,
              email: session.user.email || undefined,
              image: session.user.image || undefined,
            },
          });
        } catch (error) {
          console.error("Error creating user:", error);
          return res.status(500).json({ error: "Ошибка при создании пользователя" });
        }
      }

      // Получаем достижения пользователя
      let userAchievements: { id: string; achievementId: string; earned: boolean; earnedAt?: Date }[] = [];
      try {
        userAchievements = await prisma.achievement.findMany({
          where: {
            userId: user.id,
          },
        });
      } catch (error) {
        console.error("Error fetching achievements:", error);
        // Продолжаем выполнение, это не критическая ошибка
      }

      // Получаем все возможные достижения
      const allAchievements = [
        {
          id: "first-parking",
          name: "Первая парковка",
          description: "Воспользуйтесь приложением для поиска парковки впервые",
          imageUrl: "/achievements/first-park.svg",
          totalRequired: 1,
        },
        {
          id: "district-explorer",
          name: "Исследователь района",
          description: "Посетите 5 разных парковок в одном районе",
          imageUrl: "/achievements/district-explorer.svg",
          totalRequired: 5,
        },
        {
          id: "city-traveler",
          name: "Городской путешественник",
          description: "Посетите парковки в 3 разных районах",
          imageUrl: "/achievements/city-traveler.svg",
          totalRequired: 3,
        },
        {
          id: "parking-master",
          name: "Мастер парковки",
          description: "Посетите 20 разных парковок",
          imageUrl: "/achievements/parking-master.svg",
          totalRequired: 20,
        },
        {
          id: "loyal-user",
          name: "Лояльный пользователь",
          description: "Используйте приложение 30 дней подряд",
          imageUrl: "/achievements/loyal-user.svg",
          totalRequired: 30,
        },
      ];

      // Получаем или создаем профиль пользователя
      let userProfile;
      try {
        userProfile = await prisma.userProfile.findUnique({
          where: {
            userId: user.id,
          },
        });
      } catch (error) {
        console.error("Error finding user profile:", error);
        // Продолжаем выполнение, это не критическая ошибка
      }

      // Если профиля нет, создаем новый с начальными значениями
      if (!userProfile) {
        try {
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
        } catch (error) {
          console.error("Error creating user profile:", error);
          // Продолжаем выполнение, это не критическая ошибка
          // Используем пустой профиль для расчетов
          userProfile = {
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
          };
        }
      }

      // Получаем количество посещенных районов
      let districtsCount = 0;
      try {
        districtsCount = await prisma.userDistrict.count({
          where: {
            userId: user.id,
          },
        });
      } catch (error) {
        console.error("Error counting districts:", error);
        // Продолжаем выполнение, это не критическая ошибка
      }

      // Форматируем достижения для ответа
      const formattedAchievements: UserAchievement[] = allAchievements.map((achievement) => {
        const userAchievement = userAchievements.find(
          (ua) => ua.achievementId === achievement.id
        );

        let currentProgress = 0;
        
        // Рассчитываем текущий прогресс на основе статистики пользователя
        if (userProfile) {
          switch (achievement.id) {
            case "first-parking":
              currentProgress = userProfile.totalParksVisited > 0 ? 1 : 0;
              break;
            case "district-explorer":
              // Предполагаем, что у нас есть данные о количестве парковок в одном районе
              currentProgress = Math.min(5, userProfile.uniqueParksVisited);
              break;
            case "city-traveler":
              currentProgress = Math.min(3, districtsCount);
              break;
            case "parking-master":
              currentProgress = Math.min(20, userProfile.uniqueParksVisited);
              break;
            case "loyal-user":
              currentProgress = Math.min(30, userProfile.consecutiveLoginDays);
              break;
          }
        }

        const earned = userAchievement?.earned || currentProgress >= achievement.totalRequired;
        const progress = Math.min(100, (currentProgress / achievement.totalRequired) * 100);

        return {
          id: achievement.id,
          name: achievement.name,
          description: achievement.description,
          imageUrl: achievement.imageUrl,
          earned,
          earnedAt: userAchievement?.earnedAt || (earned ? new Date() : undefined),
          progress,
          totalRequired: achievement.totalRequired,
          currentProgress,
        };
      });

      return res.status(200).json({ achievements: formattedAchievements });
    } catch (error) {
      console.error("Error fetching achievements:", error);
      return res.status(500).json({ error: "Ошибка сервера при получении достижений" });
    }
  } catch (error) {
    console.error("Error in session handling:", error);
    return res.status(500).json({ error: "Ошибка сервера при обработке сессии" });
  }
} 