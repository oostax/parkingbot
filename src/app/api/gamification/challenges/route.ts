import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/app/api/auth/[...nextauth]/options";
import { prisma } from "@/lib/prisma";
import { Challenge as ChallengeType } from "@/types/gamification";

export async function GET(request: NextRequest) {
  try {
    console.log("API /gamification/challenges: начало запроса");
    const session = await getServerSession(authOptions);

    if (!session || !session.user?.id) {
      console.log("API /gamification/challenges: нет авторизованного пользователя");
      return NextResponse.json(
        { error: "Unauthorized" },
        { status: 401 }
      );
    }

    const userId = session.user.id;
    console.log(`API /gamification/challenges: получение челленджей для пользователя с ID: ${userId}`);

    try {
      // Получаем активные челленджи
      const activeChallenges = await prisma.challenge.findMany({
        where: {
          isActive: 1
        },
        orderBy: {
          endDate: 'asc'
        }
      });
      
      console.log(`API /gamification/challenges: получено ${activeChallenges.length} активных челленджей`);
      
      // Получаем завершенные челленджи для пользователя
      const completedChallenges = await prisma.challengeCompletion.findMany({
        where: {
          userId: userId
        }
      });
      
      console.log(`API /gamification/challenges: получено ${completedChallenges.length} завершенных челленджей для пользователя`);
      
      // Форматируем челленджи в соответствии с интерфейсом
      const formattedChallenges: ChallengeType[] = activeChallenges.map(challenge => {
        // Проверяем, завершил ли пользователь этот челлендж
        const isCompleted = completedChallenges.some(cc => cc.challengeId === challenge.id);
        
        // Парсим parkIds и districtIds из JSON строки, если они есть
        let parkIds: string[] = [];
        let districtIds: string[] = [];
        
        try {
          if (challenge.parkIds) {
            parkIds = JSON.parse(challenge.parkIds);
          }
          if (challenge.districtIds) {
            districtIds = JSON.parse(challenge.districtIds);
          }
        } catch (e) {
          console.error("Ошибка при парсинге JSON для челленджа:", e);
        }
        
        return {
          id: challenge.id,
          title: challenge.title,
          description: challenge.description,
          imageUrl: challenge.imageUrl || "",
          tokenReward: challenge.reward,
          startDate: new Date(challenge.startDate),
          endDate: new Date(challenge.endDate),
          type: challenge.type as any,
          requirements: {
            count: challenge.requirement,
            parkIds: parkIds,
            districtIds: districtIds
          },
          progress: isCompleted ? 100 : 0 // В будущем можно добавить расчет прогресса
        };
      });
      
      console.log(`API /gamification/challenges: возвращаю ${formattedChallenges.length} челленджей`);
      return NextResponse.json({
        challenges: formattedChallenges
      });
    } catch (dbError) {
      console.error("API /gamification/challenges: ошибка базы данных:", dbError);
      return NextResponse.json(
        { error: "Database error: " + (dbError instanceof Error ? dbError.message : String(dbError)) },
        { status: 500 }
      );
    }
  } catch (error) {
    console.error("API /gamification/challenges: общая ошибка:", error);
    return NextResponse.json(
      { error: "Failed to fetch challenges" },
      { status: 500 }
    );
  }
} 