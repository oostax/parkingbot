import { NextApiRequest, NextApiResponse } from "next";
import { getServerSession } from "next-auth";
import { authOptions } from "@/app/api/auth/options";
import prisma from "@/lib/prisma";
import { Challenge } from "@/types/gamification";

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

      // Получаем текущие челленджи из базы данных
      const currentDate = new Date();
      let challenges: any[] = [];
      try {
        challenges = await prisma.challenge.findMany({
          where: {
            isActive: true,
            endDate: {
              gt: currentDate,
            },
          },
          include: {
            completions: {
              where: {
                userId: user.id,
              },
            },
          },
        });
      } catch (error) {
        console.error("Error fetching challenges:", error);
        // Продолжаем выполнение, попробуем создать новые челленджи
      }

      // Если нет активных челленджей, создаем новые
      if (challenges.length === 0) {
        try {
          // Создаем еженедельные челленджи
          const startDate = new Date();
          const endDate = new Date();
          endDate.setDate(endDate.getDate() + 7); // Челлендж на неделю

          const newChallenges = await Promise.all([
            prisma.challenge.create({
              data: {
                title: "Посетите 5 парковок",
                description: "Посетите 5 разных парковок в течение недели",
                reward: 50,
                startDate,
                endDate,
                isActive: true,
                type: "WEEKLY",
                requirement: 5,
              },
              include: {
                completions: {
                  where: {
                    userId: user.id,
                  },
                },
              },
            }),
            prisma.challenge.create({
              data: {
                title: "Посетите 3 района",
                description: "Посетите парковки в 3 разных районах",
                reward: 75,
                startDate,
                endDate,
                isActive: true,
                type: "WEEKLY",
                requirement: 3,
              },
              include: {
                completions: {
                  where: {
                    userId: user.id,
                  },
                },
              },
            }),
            prisma.challenge.create({
              data: {
                title: "Войдите 7 дней подряд",
                description: "Войдите в приложение 7 дней подряд",
                reward: 100,
                startDate,
                endDate,
                isActive: true,
                type: "WEEKLY",
                requirement: 7,
              },
              include: {
                completions: {
                  where: {
                    userId: user.id,
                  },
                },
              },
            }),
          ]);

          // Форматируем челленджи для ответа
          const formattedChallenges: Challenge[] = newChallenges.map(challenge => {
            const isCompleted = challenge.completions.length > 0;
            
            return {
              id: challenge.id,
              title: challenge.title,
              description: challenge.description,
              imageUrl: `/challenges/${challenge.type.toLowerCase()}.svg`,
              tokenReward: challenge.reward,
              startDate: challenge.startDate,
              endDate: challenge.endDate,
              type: mapChallengeType(challenge.type),
              requirements: {
                count: challenge.requirement
              },
              progress: 0, // Начальный прогресс
            };
          });

          return res.status(200).json({ challenges: formattedChallenges });
        } catch (error) {
          console.error("Error creating challenges:", error);
          return res.status(500).json({ error: "Ошибка при создании челленджей" });
        }
      }

      // Получаем статистику пользователя для расчета прогресса
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

      // Форматируем челленджи для ответа
      const formattedChallenges: Challenge[] = challenges.map(challenge => {
        const isCompleted = challenge.completions.length > 0;
        let currentProgress = 0;

        // Рассчитываем текущий прогресс на основе статистики пользователя
        if (userProfile) {
          if (challenge.title.includes("парковок")) {
            currentProgress = Math.min(challenge.requirement, userProfile.uniqueParksVisited);
          } else if (challenge.title.includes("район")) {
            currentProgress = Math.min(challenge.requirement, districtsCount);
          } else if (challenge.title.includes("дней подряд")) {
            currentProgress = Math.min(challenge.requirement, userProfile.consecutiveLoginDays);
          }
        }

        const progress = Math.min(100, (currentProgress / challenge.requirement) * 100);

        return {
          id: challenge.id,
          title: challenge.title,
          description: challenge.description,
          imageUrl: `/challenges/${challenge.type.toLowerCase()}.svg`,
          tokenReward: challenge.reward,
          startDate: challenge.startDate,
          endDate: challenge.endDate,
          type: mapChallengeType(challenge.type),
          requirements: {
            count: challenge.requirement
          },
          progress,
        };
      });

      return res.status(200).json({ challenges: formattedChallenges });
    } catch (error) {
      console.error("Error fetching challenges:", error);
      return res.status(500).json({ error: "Ошибка сервера при получении челленджей" });
    }
  } catch (error) {
    console.error("Error in session handling:", error);
    return res.status(500).json({ error: "Ошибка сервера при обработке сессии" });
  }
}

// Функция для преобразования типа челленджа из БД в тип из интерфейса
function mapChallengeType(type: string): 'visit_parks' | 'daily_login' | 'invite_friends' | 'use_specific_parks' | 'other' {
  switch (type) {
    case 'WEEKLY':
      return 'visit_parks';
    case 'DAILY':
      return 'daily_login';
    case 'REFERRAL':
      return 'invite_friends';
    case 'SPECIFIC':
      return 'use_specific_parks';
    default:
      return 'other';
  }
} 