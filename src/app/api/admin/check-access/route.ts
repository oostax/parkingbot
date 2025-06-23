import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

// Список разрешенных Telegram ID администраторов (на случай отсутствия таблицы в БД)
const ADMIN_TELEGRAM_IDS = ["760360583"];

export async function GET(request: NextRequest) {
  const telegramId = request.nextUrl.searchParams.get("telegramId");
  
  if (!telegramId) {
    return NextResponse.json(
      { error: "No telegramId provided" },
      { status: 400 }
    );
  }

  try {
    // Проверяем, есть ли пользователь в базе с ролью admin
    let isAdmin = false;
    
    try {
      // Проверяем по таблице AdminUser
      const adminCount = await prisma.$queryRaw`
        SELECT COUNT(*) as count 
        FROM AdminUser 
        WHERE telegramId = ${telegramId} AND isActive = 1
      `;
      
      // Результат - массив объектов, берем первый элемент
      const count = Array.isArray(adminCount) && adminCount.length > 0 ? 
        (adminCount[0] as any).count : 0;
      
      isAdmin = count > 0;
    } catch (dbError) {
      console.error("Error querying AdminUser table:", dbError);
      // Если таблица AdminUser не существует, используем хардкод список
      isAdmin = ADMIN_TELEGRAM_IDS.includes(telegramId);
    }
    
    // Если пользователь не найден в базе, проверяем хардкод список
    if (!isAdmin) {
      isAdmin = ADMIN_TELEGRAM_IDS.includes(telegramId);
    }
    
    return NextResponse.json({ isAdmin });
  } catch (error) {
    console.error("Error checking admin access:", error);
    return NextResponse.json(
      { error: "Failed to check admin access", isAdmin: false },
      { status: 500 }
    );
  }
} 