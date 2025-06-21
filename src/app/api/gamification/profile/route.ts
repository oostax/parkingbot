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

    const userId = session.user.id;

    // Получаем профиль пользователя
    const userProfile = await prisma.userProfile.findUnique({
      where: { userId },
      include: {
        user: true,
      },
    });

    if (!userProfile) {
      // Если профиль не найден, возвращаем базовый профиль
      return NextResponse.json({
        tokenBalance: 0,
        status: "Regular",
        totalParksVisited: 0,
        uniqueParksVisited: 0,
        consecutiveLoginDays: 1,
        totalTokensEarned: 0,
        totalTokensSpent: 0,
        username: session.user.name || "Пользователь",
      });
    }

    // Форматируем ответ
    const profile = {
      tokenBalance: userProfile.tokenBalance,
      status: userProfile.status,
      carModel: userProfile.carModel,
      district: userProfile.district,
      totalParksVisited: userProfile.totalParksVisited,
      uniqueParksVisited: userProfile.uniqueParksVisited,
      consecutiveLoginDays: userProfile.consecutiveLoginDays,
      totalTokensEarned: userProfile.totalTokensEarned,
      totalTokensSpent: userProfile.totalTokensSpent,
      username: userProfile.user?.username || session.user.name || "Пользователь",
    };

    return NextResponse.json(profile);
  } catch (error) {
    console.error("Error fetching user profile:", error);
    return NextResponse.json(
      { error: "Failed to fetch user profile" },
      { status: 500 }
    );
  }
} 