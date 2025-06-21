import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/app/api/auth/[...nextauth]/options";
import { prisma } from "@/lib/prisma";

// Определение типов достижений
const ACHIEVEMENTS = [
  {
    id: "first_login",
    title: "Первый вход",
    description: "Вы впервые воспользовались приложением",
    points: 10,
    icon: "🎉"
  },
  {
    id: "five_parkings",
    title: "Исследователь",
    description: "Посетите 5 разных парковок",
    points: 50,
    icon: "🚗"
  },
  {
    id: "ten_parkings",
    title: "Опытный водитель",
    description: "Посетите 10 разных парковок",
    points: 100,
    icon: "🏆"
  },
  {
    id: "three_days_streak",
    title: "Постоянный пользователь",
    description: "Используйте приложение 3 дня подряд",
    points: 30,
    icon: "📅"
  }
];

export async function GET(request: NextRequest) {
  try {
    const session = await getServerSession(authOptions);

    if (!session || !session.user?.id) {
      return NextResponse.json(
        { error: "Unauthorized" },
        { status: 401 }
      );
    }

    const userId = session.user.id;

    // Получаем достижения пользователя
    const userAchievements = await prisma.achievement.findMany({
      where: { userId }
    });

    // Объединяем информацию о достижениях с их статусом для пользователя
    const achievements = ACHIEVEMENTS.map(achievement => {
      const userAchievement = userAchievements.find(ua => ua.achievementId === achievement.id);
      return {
        ...achievement,
        earned: !!userAchievement?.earned,
        earnedAt: userAchievement?.earnedAt || null
      };
    });

    return NextResponse.json(achievements);
  } catch (error) {
    console.error("Error fetching achievements:", error);
    return NextResponse.json(
      { error: "Failed to fetch achievements" },
      { status: 500 }
    );
  }
} 