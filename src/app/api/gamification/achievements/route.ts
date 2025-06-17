import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/app/api/auth/options";
import { UserAchievement } from "@/types/gamification";

// Временные данные для демонстрации
const mockAchievements: UserAchievement[] = [
  {
    id: "1",
    name: "Первая парковка",
    description: "Воспользуйтесь приложением для поиска парковки впервые",
    imageUrl: "/achievements/first-park.svg",
    earned: true,
    earnedAt: new Date("2023-01-05")
  },
  {
    id: "2",
    name: "Исследователь района",
    description: "Посетите 5 разных парковок в одном районе",
    imageUrl: "/achievements/district-explorer.svg",
    earned: true,
    earnedAt: new Date("2023-02-10")
  },
  {
    id: "3",
    name: "Городской путешественник",
    description: "Посетите парковки в 3 разных районах",
    imageUrl: "/achievements/city-traveler.svg",
    earned: false,
    progress: 66,
    totalRequired: 3,
    currentProgress: 2
  },
  {
    id: "4",
    name: "Ночной водитель",
    description: "Воспользуйтесь парковкой после 23:00",
    imageUrl: "/achievements/night-driver.svg",
    earned: false,
    progress: 0,
    totalRequired: 1,
    currentProgress: 0
  },
  {
    id: "5",
    name: "Постоянный пользователь",
    description: "Используйте приложение 10 дней подряд",
    imageUrl: "/achievements/regular-user.svg",
    earned: false,
    progress: 70,
    totalRequired: 10,
    currentProgress: 7
  }
];

export async function GET() {
  try {
    const session = await getServerSession(authOptions);
    
    if (!session || !session.user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }
    
    // В реальном приложении здесь будет запрос к базе данных
    // Для демонстрации используем заглушку
    
    return NextResponse.json({ achievements: mockAchievements });
  } catch (error) {
    console.error("Error fetching achievements:", error);
    return NextResponse.json({ error: "Internal Server Error" }, { status: 500 });
  }
} 