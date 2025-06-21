import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/app/api/auth/[...nextauth]/options";
import { prisma } from "@/lib/prisma";

export async function GET(request: NextRequest) {
  try {
    console.log("API /gamification/leaderboard: начало запроса");
    const session = await getServerSession(authOptions);

    if (!session || !session.user?.id) {
      console.log("API /gamification/leaderboard: нет авторизованного пользователя");
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

    console.log(`API /gamification/leaderboard: получено ${usersWithProfiles.length} пользователей с профилями`);

    // Сортируем пользователей по балансу токенов
    const sortedUsers = [...usersWithProfiles]
      .filter(user => user.userProfile) // Фильтруем пользователей без профиля
      .sort((a, b) => (b.userProfile?.tokenBalance || 0) - (a.userProfile?.tokenBalance || 0));

    console.log(`API /gamification/leaderboard: отсортировано ${sortedUsers.length} пользователей`);

    // Формируем ответ
    const leaderboard = sortedUsers.map((user, index) => {
      // Получаем имя пользователя
      let displayName = "Пользователь";
      
      if (user.firstName) {
        displayName = user.firstName;
      } else if (user.username) {
        displayName = user.username;
      }
      
      return {
        id: user.id,
        rank: index + 1,
        displayName: displayName,
        username: user.username || "user",
        avatarUrl: user.image || null,
        score: user.userProfile?.tokenBalance || 0,
        status: user.userProfile?.status || "Regular",
        isCurrentUser: user.id === session.user?.id
      };
    });

    console.log(`API /gamification/leaderboard: сформирован лидерборд с ${leaderboard.length} записями`);
    return NextResponse.json({ leaderboard });
  } catch (error) {
    console.error("API /gamification/leaderboard: ошибка:", error);
    return NextResponse.json(
      { error: "Failed to fetch leaderboard", message: error instanceof Error ? error.message : String(error) },
      { status: 500 }
    );
  }
} 