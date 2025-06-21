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

        // Подготавливаем базовый профиль для нового пользователя
        const now = new Date();
        
        // Возвращаем созданный профиль
        return NextResponse.json({
          profile: {
            id: newProfile.id,
            telegramId: session.user.telegramId,
            username: session.user.name?.toLowerCase().replace(/\s+/g, '') || "user",
            displayName: session.user.name || "Пользователь",
            avatarUrl: session.user.image,
            district: null,
            carModel: null,
            carColor: null,
            tokenBalance: 0,
            status: "Regular",
            joinedAt: now,
            lastLoginAt: now,
            stats: {
              totalParksVisited: 0,
              uniqueParksVisited: 0,
              consecutiveLoginDays: 1,
              totalTokensEarned: 0,
              totalTokensSpent: 0,
              referralsCount: 0,
              challengesCompleted: 0,
              districtsVisited: []
            },
            friends: []
          }
        });
      }

      // Подготавливаем данные для существующего профиля
      const now = new Date();
      const joinedAt = userProfile.user?.createdAt ? new Date(userProfile.user.createdAt) : now;
      const lastLoginAt = userProfile.lastLoginAt ? new Date(userProfile.lastLoginAt) : now;

      // Форматируем ответ для существующего профиля
      const profile = {
        id: userProfile.id,
        telegramId: userProfile.user?.telegramId,
        username: userProfile.user?.username || session.user.name?.toLowerCase().replace(/\s+/g, '') || "user",
        displayName: userProfile.user?.firstName || session.user.name || "Пользователь",
        avatarUrl: userProfile.user?.image || session.user.image,
        district: userProfile.district,
        carModel: userProfile.carModel,
        carColor: null, // Добавим это поле позже
        tokenBalance: userProfile.tokenBalance || 0,
        status: userProfile.status || "Regular",
        joinedAt: joinedAt,
        lastLoginAt: lastLoginAt,
        stats: {
          totalParksVisited: userProfile.totalParksVisited || 0,
          uniqueParksVisited: userProfile.uniqueParksVisited || 0,
          consecutiveLoginDays: userProfile.consecutiveLoginDays || 1,
          totalTokensEarned: userProfile.totalTokensEarned || 0,
          totalTokensSpent: userProfile.totalTokensSpent || 0,
          referralsCount: userProfile.referralsCount || 0,
          challengesCompleted: userProfile.challengesCompleted || 0,
          districtsVisited: []
        },
        friends: []
      };

      return NextResponse.json({ profile });
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