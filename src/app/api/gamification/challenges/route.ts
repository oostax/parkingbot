import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/app/api/auth/options";
import { Challenge } from "@/types/gamification";

// Временные данные для демонстрации
const mockChallenges: Challenge[] = [
  {
    id: "1",
    title: "Исследователь района",
    description: "Посетите 5 разных парковок в Центральном районе",
    imageUrl: "/challenges/district-explorer.svg",
    tokenReward: 50,
    startDate: new Date("2023-06-01"),
    endDate: new Date("2023-06-30"),
    type: "visit_parks",
    requirements: {
      count: 5,
      districtIds: ["central"]
    }
  },
  {
    id: "2",
    title: "Неделя активности",
    description: "Используйте приложение 7 дней подряд",
    imageUrl: "/challenges/weekly-streak.svg",
    tokenReward: 30,
    startDate: new Date("2023-06-01"),
    endDate: new Date("2023-06-30"),
    type: "daily_login",
    requirements: {
      count: 7
    }
  },
  {
    id: "3",
    title: "Пригласите друзей",
    description: "Пригласите 3 друзей воспользоваться приложением",
    imageUrl: "/challenges/invite-friends.svg",
    tokenReward: 100,
    startDate: new Date("2023-06-01"),
    endDate: new Date("2023-06-30"),
    type: "invite_friends",
    requirements: {
      count: 3
    }
  },
  {
    id: "4",
    title: "Ночной гонщик",
    description: "Воспользуйтесь 3 разными парковками после 22:00",
    imageUrl: "/challenges/night-rider.svg",
    tokenReward: 75,
    startDate: new Date("2023-06-01"),
    endDate: new Date("2023-06-30"),
    type: "visit_parks",
    requirements: {
      count: 3,
      parkIds: []
    }
  }
];

// Временные данные о прогрессе пользователей
const mockUserProgress: Record<string, Record<string, { progress: number; currentProgress: number }>> = {
  "default": {
    "1": { progress: 40, currentProgress: 2 },
    "2": { progress: 71, currentProgress: 5 },
    "3": { progress: 0, currentProgress: 0 },
    "4": { progress: 33, currentProgress: 1 }
  }
};

export async function GET() {
  try {
    const session = await getServerSession(authOptions);
    
    if (!session || !session.user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }
    
    const userId = session.user.id;
    
    // В реальном приложении здесь будет запрос к базе данных
    // Для демонстрации используем заглушку
    const userProgress = mockUserProgress[userId] || mockUserProgress.default;
    
    return NextResponse.json({ 
      challenges: mockChallenges,
      userProgress
    });
  } catch (error) {
    console.error("Error fetching challenges:", error);
    return NextResponse.json({ error: "Internal Server Error" }, { status: 500 });
  }
}

export async function POST(request: Request) {
  try {
    const session = await getServerSession(authOptions);
    
    if (!session || !session.user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }
    
    const data = await request.json();
    
    // Проверяем, что пришли корректные данные
    if (!data || typeof data !== "object" || !data.challengeId) {
      return NextResponse.json({ error: "Invalid request body" }, { status: 400 });
    }
    
    const { challengeId } = data;
    
    // В реальном приложении здесь будет запись в базу данных
    // Для демонстрации просто возвращаем успешный ответ
    
    return NextResponse.json({ 
      success: true,
      message: `Вы успешно присоединились к челленджу ${challengeId}`
    });
  } catch (error) {
    console.error("Error joining challenge:", error);
    return NextResponse.json({ error: "Internal Server Error" }, { status: 500 });
  }
} 