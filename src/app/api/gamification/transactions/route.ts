import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/app/api/auth/[...nextauth]/options";
import { prisma } from "@/lib/prisma";
import { TokenTransaction } from "@/types/gamification";

export async function GET(request: NextRequest) {
  try {
    const session = await getServerSession(authOptions);

    if (!session || !session.user?.id) {
      return NextResponse.json(
        { error: "Unauthorized" },
        { status: 401 }
      );
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
        await prisma.$executeRaw`
          INSERT INTO TokenTransaction (id, userId, amount, type, description, createdAt)
          VALUES (${crypto.randomUUID()}, ${user.id}, 10, 'WELCOME_BONUS', 'Приветственный бонус', CURRENT_TIMESTAMP)
        `;
        
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

      // Получаем историю транзакций пользователя через raw SQL из-за @ignore в модели
      const transactions = await prisma.$queryRaw`
        SELECT id, userId, amount, type, description, createdAt
        FROM TokenTransaction
        WHERE userId = ${user.id}
        ORDER BY createdAt DESC
        LIMIT 20
      `;

      // Форматируем транзакции для ответа
      const formattedTransactions = Array.isArray(transactions) 
        ? transactions.map((transaction: any) => ({
            id: transaction.id,
            userId: transaction.userId,
            amount: transaction.amount,
            type: transaction.type,
            description: transaction.description,
            createdAt: transaction.createdAt,
          }))
        : [];

      return NextResponse.json({ transactions: formattedTransactions });
    } catch (dbError) {
      console.error("Database error fetching transactions:", dbError);
      return NextResponse.json(
        { error: "Database error: " + (dbError instanceof Error ? dbError.message : String(dbError)) },
        { status: 500 }
      );
    }
  } catch (error) {
    console.error("Error in transactions endpoint:", error);
    return NextResponse.json(
      { error: "Failed to process transactions request" },
      { status: 500 }
    );
  }
} 