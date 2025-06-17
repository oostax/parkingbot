import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/app/api/auth/options";
import { LeaderboardEntry } from "@/types/gamification";

// Функция для анонимизации имени пользователя
function anonymizeUsername(username: string): string {
  if (!username || username.length <= 3) return "***";
  return "***" + username.slice(-3);
}

// Временные данные для демонстрации
const mockLeaderboards: Record<string, LeaderboardEntry[]> = {
  "week": [
    { position: 1, userId: "1", displayName: "***123", avatarUrl: "", score: 1250, status: "Platinum" },
    { position: 2, userId: "2", displayName: "***456", avatarUrl: "", score: 980, status: "Gold" },
    { position: 3, userId: "3", displayName: "***789", avatarUrl: "", score: 820, status: "Gold" },
    { position: 4, userId: "4", displayName: "***234", avatarUrl: "", score: 750, status: "Silver" },
    { position: 5, userId: "5", displayName: "***567", avatarUrl: "", score: 680, status: "Silver" },
    { position: 6, userId: "6", displayName: "***890", avatarUrl: "", score: 620, status: "Silver" },
    { position: 7, userId: "7", displayName: "***321", avatarUrl: "", score: 580, status: "Regular" },
    { position: 8, userId: "8", displayName: "***654", avatarUrl: "", score: 520, status: "Regular" },
    { position: 9, userId: "9", displayName: "***987", avatarUrl: "", score: 480, status: "Regular" },
    { position: 10, userId: "10", displayName: "***432", avatarUrl: "", score: 450, status: "Regular" },
  ],
  "month": [
    { position: 1, userId: "3", displayName: "***789", avatarUrl: "", score: 3200, status: "Platinum" },
    { position: 2, userId: "1", displayName: "***123", avatarUrl: "", score: 2950, status: "Platinum" },
    { position: 3, userId: "5", displayName: "***567", avatarUrl: "", score: 2480, status: "Gold" },
    { position: 4, userId: "2", displayName: "***456", avatarUrl: "", score: 2350, status: "Gold" },
    { position: 5, userId: "8", displayName: "***654", avatarUrl: "", score: 1980, status: "Silver" },
    { position: 6, userId: "4", displayName: "***234", avatarUrl: "", score: 1820, status: "Silver" },
    { position: 7, userId: "10", displayName: "***432", avatarUrl: "", score: 1680, status: "Silver" },
    { position: 8, userId: "7", displayName: "***321", avatarUrl: "", score: 1520, status: "Regular" },
    { position: 9, userId: "6", displayName: "***890", avatarUrl: "", score: 1480, status: "Regular" },
    { position: 10, userId: "9", displayName: "***987", avatarUrl: "", score: 1350, status: "Regular" },
  ],
  "alltime": [
    { position: 1, userId: "5", displayName: "***567", avatarUrl: "", score: 8750, status: "Platinum" },
    { position: 2, userId: "3", displayName: "***789", avatarUrl: "", score: 7980, status: "Platinum" },
    { position: 3, userId: "1", displayName: "***123", avatarUrl: "", score: 7620, status: "Platinum" },
    { position: 4, userId: "8", displayName: "***654", avatarUrl: "", score: 6950, status: "Gold" },
    { position: 5, userId: "2", displayName: "***456", avatarUrl: "", score: 6480, status: "Gold" },
    { position: 6, userId: "10", displayName: "***432", avatarUrl: "", score: 5920, status: "Gold" },
    { position: 7, userId: "4", displayName: "***234", avatarUrl: "", score: 5480, status: "Silver" },
    { position: 8, userId: "7", displayName: "***321", avatarUrl: "", score: 4950, status: "Silver" },
    { position: 9, userId: "6", displayName: "***890", avatarUrl: "", score: 4320, status: "Silver" },
    { position: 10, userId: "9", displayName: "***987", avatarUrl: "", score: 3980, status: "Regular" },
  ]
};

export async function GET(request: Request) {
  try {
    const session = await getServerSession(authOptions);
    
    if (!session || !session.user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }
    
    // Получаем период из запроса
    const { searchParams } = new URL(request.url);
    const period = searchParams.get("period") || "week";
    
    // Проверяем, что период корректный
    if (!["week", "month", "alltime"].includes(period)) {
      return NextResponse.json({ error: "Invalid period" }, { status: 400 });
    }
    
    // В реальном приложении здесь будет запрос к базе данных
    // Для демонстрации используем заглушку
    const leaderboard = mockLeaderboards[period];
    
    return NextResponse.json({ leaderboard });
  } catch (error) {
    console.error("Error fetching leaderboard:", error);
    return NextResponse.json({ error: "Internal Server Error" }, { status: 500 });
  }
} 