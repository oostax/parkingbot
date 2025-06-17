import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/app/api/auth/options";
import { UserProfile, UserStatus } from "@/types/gamification";

// Временные данные для демонстрации
const mockUserProfiles: Record<string, UserProfile> = {
  "default": {
    id: "default",
    telegramId: "12345678",
    username: "user123",
    displayName: "Пользователь",
    avatarUrl: "",
    tokenBalance: 350,
    status: "Silver",
    joinedAt: new Date("2023-01-01"),
    lastLoginAt: new Date(),
    stats: {
      totalParksVisited: 15,
      uniqueParksVisited: 8,
      consecutiveLoginDays: 7,
      totalTokensEarned: 450,
      totalTokensSpent: 100,
      referralsCount: 2,
      challengesCompleted: 3,
      districtsVisited: ["Центральный", "Северный"]
    },
    friends: []
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
    let userProfile = mockUserProfiles[userId] || mockUserProfiles.default;
    
    // Обновляем время последнего входа
    userProfile = {
      ...userProfile,
      lastLoginAt: new Date()
    };
    
    return NextResponse.json({ profile: userProfile });
  } catch (error) {
    console.error("Error fetching user profile:", error);
    return NextResponse.json({ error: "Internal Server Error" }, { status: 500 });
  }
}

export async function POST(request: Request) {
  try {
    const session = await getServerSession(authOptions);
    
    if (!session || !session.user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }
    
    const userId = session.user.id;
    const data = await request.json();
    
    // Проверяем, что пришли корректные данные
    if (!data || typeof data !== "object") {
      return NextResponse.json({ error: "Invalid request body" }, { status: 400 });
    }
    
    // В реальном приложении здесь будет обновление данных в базе данных
    // Для демонстрации просто возвращаем успешный ответ
    
    return NextResponse.json({ success: true });
  } catch (error) {
    console.error("Error updating user profile:", error);
    return NextResponse.json({ error: "Internal Server Error" }, { status: 500 });
  }
} 