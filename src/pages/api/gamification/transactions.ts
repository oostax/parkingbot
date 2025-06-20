import { NextApiRequest, NextApiResponse } from "next";
import { getServerSession } from "next-auth";
import { authOptions } from "@/app/api/auth/options";
import { prisma } from "@/lib/prisma";
import { TokenTransaction } from "@/types/gamification";

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
      // Получаем или создаем пользователя в базе данных
      let user = await prisma.user.findUnique({
        where: {
          id: session.user.id,
        },
      });

      // Если пользователя нет, создаем нового
      if (!user) {
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
        
        // Добавляем приветственный бонус для нового пользователя
        await prisma.tokenTransaction.create({
          data: {
            userId: user.id,
            amount: 10,
            type: "WELCOME_BONUS",
            description: "Приветственный бонус",
          },
        });
        
        // Создаем профиль пользователя
        await prisma.userProfile.create({
          data: {
            userId: user.id,
            tokenBalance: 10,
            status: "Regular",
            totalParksVisited: 0,
            uniqueParksVisited: 0,
            consecutiveLoginDays: 1,
            totalTokensEarned: 10,
            totalTokensSpent: 0,
            referralsCount: 0,
            challengesCompleted: 0,
          },
        });
      }

      // Получаем историю транзакций пользователя
      const transactions = await prisma.tokenTransaction.findMany({
        where: {
          userId: user.id,
        },
        orderBy: {
          createdAt: 'desc',
        },
        take: 20, // Ограничиваем количество записей для производительности
      });

      // Форматируем транзакции для ответа
      const formattedTransactions: TokenTransaction[] = transactions.map(transaction => ({
        id: transaction.id,
        userId: transaction.userId,
        amount: transaction.amount,
        type: transaction.type as any,
        description: transaction.description,
        createdAt: transaction.createdAt,
      }));

      return res.status(200).json({ transactions: formattedTransactions });
    } catch (error) {
      console.error("Error fetching transactions:", error);
      return res.status(500).json({ error: "Ошибка сервера при получении транзакций" });
    }
  } catch (error) {
    console.error("Error in session handling:", error);
    return res.status(500).json({ error: "Ошибка сервера при обработке сессии" });
  }
} 