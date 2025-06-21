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

    try {
      // Пробуем получить профиль пользователя
      const userProfile = await prisma.userProfile.findUnique({
        where: { userId },
        include: {
          user: true,
        },
      });

      if (!userProfile) {
        console.log(`Профиль не найден для пользователя ${userId}, создаю новый профиль`);
        
        // Создаем профиль, если его нет
        const newProfile = await prisma.userProfile.create({
          data: {
            userId: userId,
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

        // Возвращаем созданный профиль
        return NextResponse.json({
          tokenBalance: newProfile.tokenBalance || 0,
          status: newProfile.status || "Regular",
          totalParksVisited: newProfile.totalParksVisited || 0,
          uniqueParksVisited: newProfile.uniqueParksVisited || 0,
          consecutiveLoginDays: newProfile.consecutiveLoginDays || 1,
          totalTokensEarned: newProfile.totalTokensEarned || 0,
          totalTokensSpent: newProfile.totalTokensSpent || 0,
          username: session.user.name || "Пользователь",
        });
      }

      // Форматируем ответ для существующего профиля
      const profile = {
        tokenBalance: userProfile.tokenBalance || 0,
        status: userProfile.status || "Regular",
        carModel: userProfile.carModel || null,
        district: userProfile.district || null,
        totalParksVisited: userProfile.totalParksVisited || 0,
        uniqueParksVisited: userProfile.uniqueParksVisited || 0,
        consecutiveLoginDays: userProfile.consecutiveLoginDays || 1,
        totalTokensEarned: userProfile.totalTokensEarned || 0,
        totalTokensSpent: userProfile.totalTokensSpent || 0,
        username: userProfile.user?.username || session.user.name || "Пользователь",
      };

      return NextResponse.json(profile);
    } catch (dbError) {
      console.error("Database error fetching user profile:", dbError);
      return NextResponse.json(
        { error: "Database error: " + (dbError instanceof Error ? dbError.message : String(dbError)) },
        { status: 500 }
      );
    }
  } catch (error) {
    console.error("Error in profile endpoint:", error);
    return NextResponse.json(
      { error: "Failed to process profile request" },
      { status: 500 }
    );
  }
} 