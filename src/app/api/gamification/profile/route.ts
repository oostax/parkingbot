import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/app/api/auth/[...nextauth]/options";
import { prisma } from "@/lib/prisma";

export async function GET(request: NextRequest) {
  try {
    console.log("API /gamification/profile: начало запроса");
    const session = await getServerSession(authOptions);

    if (!session || !session.user?.id) {
      console.log("API /gamification/profile: нет авторизованного пользователя");
      return NextResponse.json(
        { error: "Unauthorized" },
        { status: 401 }
      );
    }

    const userId = session.user.id;
    console.log(`API /gamification/profile: получение профиля для пользователя с ID: ${userId}`);

    try {
      // Пробуем получить профиль пользователя
      const userProfile = await prisma.userProfile.findUnique({
        where: { userId },
        include: {
          user: true,
        },
      });

      console.log(`API /gamification/profile: результат поиска профиля:`, 
        userProfile ? `найден профиль с ID ${userProfile.id}` : "профиль не найден");

      if (!userProfile) {
        console.log(`API /gamification/profile: профиль не найден, создаю новый`);
        
        try {
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
              districtsVisited: "[]", // Пустой массив в формате JSON
            },
            include: {
              user: true
            }
          });
          
          console.log(`API /gamification/profile: создан новый профиль с ID: ${newProfile.id}`);
          
          // Упрощенное представление профиля для клиента
          const profile = {
            id: newProfile.id,
            displayName: session.user.name || "Пользователь",
            username: session.user.name?.toLowerCase().replace(/\s+/g, '') || "user",
            tokenBalance: 0,
            status: "Regular",
            stats: {
              totalParksVisited: 0,
              uniqueParksVisited: 0,
              consecutiveLoginDays: 1,
              totalTokensEarned: 0,
              totalTokensSpent: 0,
              challengesCompleted: 0,
              districtsVisited: []
            },
            joinedAt: new Date(),
            lastLoginAt: new Date()
          };
          
          console.log("API /gamification/profile: возвращаю новый профиль:", JSON.stringify(profile));
          return NextResponse.json({ profile });
        } catch (createError) {
          console.error(`API /gamification/profile: ошибка создания профиля:`, createError);
          return NextResponse.json(
            { error: "Не удалось создать профиль пользователя" },
            { status: 500 }
          );
        }
      }

      console.log(`API /gamification/profile: форматирование ответа для существующего профиля`);
      
      // Преобразуем JSON строку с районами в массив
      let districtsVisited: string[] = [];
      try {
        if (userProfile.districtsVisited) {
          districtsVisited = JSON.parse(userProfile.districtsVisited);
        }
      } catch (e) {
        console.error("Ошибка при парсинге districtsVisited:", e);
      }
      
      // Упрощенное представление профиля для клиента
      const profile = {
        id: userProfile.id,
        displayName: userProfile.user?.firstName || session.user.name || "Пользователь",
        username: userProfile.user?.username || session.user.name?.toLowerCase().replace(/\s+/g, '') || "user",
        tokenBalance: userProfile.tokenBalance || 0,
        status: userProfile.status || "Regular",
        stats: {
          totalParksVisited: userProfile.totalParksVisited || 0,
          uniqueParksVisited: userProfile.uniqueParksVisited || 0,
          consecutiveLoginDays: userProfile.consecutiveLoginDays || 1,
          totalTokensEarned: userProfile.totalTokensEarned || 0,
          totalTokensSpent: userProfile.totalTokensSpent || 0,
          challengesCompleted: userProfile.challengesCompleted || 0,
          districtsVisited: districtsVisited
        },
        joinedAt: userProfile.user?.createdAt || new Date(),
        lastLoginAt: userProfile.lastLoginAt || new Date()
      };

      console.log(`API /gamification/profile: возвращаю существующий профиль:`, JSON.stringify(profile));
      return NextResponse.json({ profile });
    } catch (dbError) {
      console.error("API /gamification/profile: ошибка базы данных:", dbError);
      return NextResponse.json(
        { error: "Database error: " + (dbError instanceof Error ? dbError.message : String(dbError)) },
        { status: 500 }
      );
    }
  } catch (error) {
    console.error("API /gamification/profile: общая ошибка:", error);
    return NextResponse.json(
      { error: "Failed to process profile request" },
      { status: 500 }
    );
  }
} 