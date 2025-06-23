import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { z } from "zod";

// Схема для валидации данных челленджа
const challengeSchema = z.object({
  title: z.string().min(3),
  description: z.string().min(10),
  reward: z.number().positive(),
  type: z.string(),
  requirement: z.number().positive(),
  startDate: z.string(),
  endDate: z.string(),
  isActive: z.boolean().default(true),
  districtIds: z.string().optional(),
  parkIds: z.string().optional(),
  imageUrl: z.string().optional(),
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
    const adminUsers = await prisma.adminUser.findMany({
      where: {
        telegramId: telegramId,
        isActive: true
      }
    }).catch(() => {
      // Если таблица AdminUser не существует, используем хардкод список
      return [];
    });
    
    // Если пользователь найден в базе или его ID в хардкод списке
    return adminUsers.length > 0 || ADMIN_TELEGRAM_IDS.includes(telegramId);
  } catch (error) {
    console.error("Error checking admin access:", error);
    return false;
  }
}

// PUT /api/admin/challenges/[id] - обновить челлендж по ID
export async function PUT(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  const id = params.id;

  // Проверяем права администратора
  const isAdmin = await checkAdminAccess(request);
  if (!isAdmin) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  try {
    // Проверяем существование челленджа
    const existingChallenge = await prisma.challenge.findUnique({
      where: { id }
    });

    if (!existingChallenge) {
      return NextResponse.json(
        { error: "Challenge not found" },
        { status: 404 }
      );
    }

    const body = await request.json();
    
    // Валидируем данные
    const result = challengeSchema.safeParse(body);
    if (!result.success) {
      return NextResponse.json(
        { error: "Invalid data", details: result.error.issues },
        { status: 400 }
      );
    }
    
    const data = result.data;
    
    // Конвертируем isActive из boolean в number для совместимости с моделью
    const isActiveValue = data.isActive ? 1 : 0;
    
    // Обновляем челлендж
    const updatedChallenge = await prisma.challenge.update({
      where: { id },
      data: {
        title: data.title,
        description: data.description,
        reward: data.reward,
        type: data.type,
        requirement: data.requirement,
        startDate: data.startDate,
        endDate: data.endDate,
        isActive: isActiveValue,
        districtIds: data.districtIds || "[]",
        parkIds: data.parkIds || "[]",
        imageUrl: data.imageUrl || "",
      }
    });
    
    return NextResponse.json({ challenge: updatedChallenge });
  } catch (error) {
    console.error("Error updating challenge:", error);
    return NextResponse.json(
      { error: "Failed to update challenge" },
      { status: 500 }
    );
  }
}

// DELETE /api/admin/challenges/[id] - удалить челлендж по ID
export async function DELETE(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  const id = params.id;

  // Проверяем права администратора
  const isAdmin = await checkAdminAccess(request);
  if (!isAdmin) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  try {
    // Проверяем существование челленджа
    const existingChallenge = await prisma.challenge.findUnique({
      where: { id }
    });

    if (!existingChallenge) {
      return NextResponse.json(
        { error: "Challenge not found" },
        { status: 404 }
      );
    }

    // Удаляем сначала все завершения челленджей, связанные с этим челленджем
    await prisma.challengeCompletion.deleteMany({
      where: { challengeId: id }
    });
    
    // Удаляем челлендж
    await prisma.challenge.delete({
      where: { id }
    });
    
    return NextResponse.json({ success: true });
  } catch (error) {
    console.error("Error deleting challenge:", error);
    return NextResponse.json(
      { error: "Failed to delete challenge" },
      { status: 500 }
    );
  }
} 