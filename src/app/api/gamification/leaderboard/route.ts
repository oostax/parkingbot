import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/app/api/auth/[...nextauth]/options";
import { prisma } from "@/lib/prisma";

export async function GET(request: NextRequest) {
  try {
    const session = await getServerSession(authOptions);

    if (!session || !session.user?.id) {
      return NextResponse.json(
        { error: "Unauthorized" },
        { status: 401 }
      );
    }

    // Получаем всех пользователей с их профилями
    const usersWithProfiles = await prisma.user.findMany({
      include: {
        userProfile: true,
      },
      where: {
        userProfile: {
          isNot: null
        }
      },
      take: 20, // Ограничиваем количество записей для производительности
    });

    // Сортируем пользователей по балансу токенов
    const sortedUsers = [...usersWithProfiles]
      .filter(user => user.userProfile) // Фильтруем пользователей без профиля
      .sort((a, b) => (b.userProfile?.tokenBalance || 0) - (a.userProfile?.tokenBalance || 0));

    // Формируем ответ
    const leaderboard = sortedUsers.map((user, index) => {
      return {
        position: index + 1,
        userId: user.id,
        username: user.username || user.firstName || "Пользователь",
        avatarUrl: user.image || null,
        tokenBalance: user.userProfile?.tokenBalance || 0,
        isCurrentUser: user.id === session.user?.id
      };
    });

    return NextResponse.json({ leaderboard });
  } catch (error) {
    console.error("Error fetching leaderboard:", error);
    return NextResponse.json(
      { error: "Failed to fetch leaderboard" },
      { status: 500 }
    );
  }
} 