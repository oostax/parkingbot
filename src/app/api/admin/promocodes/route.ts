import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { z } from "zod";

// Схема для валидации данных промокода
const promoCodeSchema = z.object({
  code: z.string().min(3),
  reward: z.number().positive(),
  type: z.string().default("tokens"),
  description: z.string().optional(),
  isActive: z.boolean().default(true),
  expiresAt: z.string().optional().nullable(),
  usageLimit: z.number().int().nonnegative().optional().nullable(),
});

// Функция проверки прав администратора
async function checkAdminAccess(request: NextRequest): Promise<boolean> {
  // Получаем telegram id из куки или хедера
  const telegramId = request.cookies.get("telegram_id")?.value || request.headers.get("x-telegram-id");
  
  if (!telegramId) {
    return false;
  }

  // Список разрешенных администраторов
  const ADMIN_TELEGRAM_IDS = ["760360583"];
  
  // Проверяем наличие в базе данных
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
    
    if (count > 0) {
      return true;
    }
    
    // Если админ не найден в базе, проверяем хардкод список
    return ADMIN_TELEGRAM_IDS.includes(telegramId);
  } catch (error) {
    console.error("Error checking admin access:", error);
    
    // В случае ошибки проверяем хардкод список
    return ADMIN_TELEGRAM_IDS.includes(telegramId);
  }
}

// GET /api/admin/promocodes - получить все промокоды
export async function GET(request: NextRequest) {
  // Проверяем права администратора
  const isAdmin = await checkAdminAccess(request);
  if (!isAdmin) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  try {
    const promoCodes = await prisma.promoCode.findMany({
      orderBy: {
        createdAt: "desc"
      },
      include: {
        redemptions: {
          select: {
            userId: true,
            redeemedAt: true
          }
        }
      }
    });
    
    return NextResponse.json({ promoCodes });
  } catch (error) {
    console.error("Error fetching promo codes:", error);
    return NextResponse.json(
      { error: "Failed to fetch promo codes" },
      { status: 500 }
    );
  }
}

// POST /api/admin/promocodes - создать новый промокод
export async function POST(request: NextRequest) {
  // Проверяем права администратора
  const isAdmin = await checkAdminAccess(request);
  if (!isAdmin) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  try {
    const body = await request.json();
    
    // Валидируем данные
    const result = promoCodeSchema.safeParse(body);
    if (!result.success) {
      return NextResponse.json(
        { error: "Invalid data", details: result.error.issues },
        { status: 400 }
      );
    }
    
    const data = result.data;
    
    // Проверяем, что промокод с таким кодом ещё не существует
    const existingPromoCode = await prisma.promoCode.findUnique({
      where: { code: data.code }
    });
    
    if (existingPromoCode) {
      return NextResponse.json(
        { error: "Promo code with this code already exists" },
        { status: 400 }
      );
    }
    
    // Получаем ID текущего администратора для записи в createdBy
    const currentTelegramId = request.headers.get("x-telegram-id") || request.cookies.get("telegram_id")?.value;
    
    // Создаем промокод
    const promoCode = await prisma.promoCode.create({
      data: {
        code: data.code,
        reward: data.reward,
        type: data.type,
        description: data.description,
        isActive: data.isActive,
        expiresAt: data.expiresAt,
        usageLimit: data.usageLimit,
        createdBy: currentTelegramId,
      }
    });
    
    return NextResponse.json({ promoCode }, { status: 201 });
  } catch (error) {
    console.error("Error creating promo code:", error);
    return NextResponse.json(
      { error: "Failed to create promo code" },
      { status: 500 }
    );
  }
} 