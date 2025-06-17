import { NextApiRequest, NextApiResponse } from "next";
import { getServerSession } from "next-auth";
import { authOptions } from "@/app/api/auth/options";
import prisma from "@/lib/prisma";
import { TokenTransaction } from "@/types/gamification";

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
    return res.status(500).json({ error: "Ошибка сервера" });
  }
} 