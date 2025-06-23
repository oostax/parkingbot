import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { z } from "zod";

// Схема для валидации данных администратора
const adminSchema = z.object({
  telegramId: z.string().min(1),
  username: z.string().optional(),
  fullName: z.string().optional(),
  role: z.string().default("admin"),
  isActive: z.boolean().default(true),
});

// Функция проверки прав администратора
async function checkAdminAccess(request: NextRequest, requireSuperAdmin = false): Promise<boolean> {
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
        isActive: true,
        ...(requireSuperAdmin ? { role: "super_admin" } : {})
      }
    }).catch(() => {
      // Если таблица AdminUser не существует или произошла ошибка
      return [];
    });
    
    if (adminUsers.length > 0) {
      return true;
    }
    
    // Для хардкод ID проверяем только факт наличия в списке, без проверки role
    return ADMIN_TELEGRAM_IDS.includes(telegramId);
  } catch (error) {
    console.error("Error checking admin access:", error);
    return false;
  }
}

// GET /api/admin/users - получить всех администраторов
export async function GET(request: NextRequest) {
  // Проверяем права администратора
  const isAdmin = await checkAdminAccess(request);
  if (!isAdmin) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  try {
    try {
      // Пробуем загрузить из базы
      const admins = await prisma.adminUser.findMany({
        orderBy: {
          createdAt: "desc"
        }
      });
      
      return NextResponse.json({ admins });
    } catch (dbError) {
      // Если таблица не существует или произошла ошибка, возвращаем дефолтного админа
      console.error("Error fetching from database, using default admin:", dbError);
      
      const defaultAdmin = {
        id: "default",
        telegramId: "760360583",
        username: "Default Admin",
        role: "super_admin",
        isActive: true,
        createdAt: new Date().toISOString()
      };
      
      return NextResponse.json({ admins: [defaultAdmin] });
    }
  } catch (error) {
    console.error("Error in GET /api/admin/users:", error);
    return NextResponse.json(
      { error: "Failed to fetch admins" },
      { status: 500 }
    );
  }
}

// POST /api/admin/users - добавить нового администратора
export async function POST(request: NextRequest) {
  // Для добавления нового админа требуются права супер-админа
  const isSuperAdmin = await checkAdminAccess(request, true);
  if (!isSuperAdmin) {
    return NextResponse.json({ error: "Unauthorized, super admin rights required" }, { status: 401 });
  }

  try {
    const body = await request.json();
    
    // Валидируем данные
    const result = adminSchema.safeParse(body);
    if (!result.success) {
      return NextResponse.json(
        { error: "Invalid data", details: result.error.issues },
        { status: 400 }
      );
    }
    
    const data = result.data;
    
    // Проверяем, что пользователь с таким Telegram ID ещё не существует
    const existingUser = await prisma.adminUser.findFirst({
      where: { telegramId: data.telegramId }
    }).catch(() => null);
    
    if (existingUser) {
      return NextResponse.json(
        { error: "Admin with this Telegram ID already exists" },
        { status: 400 }
      );
    }
    
    // Получаем ID текущего администратора для записи в addedById
    const currentTelegramId = request.headers.get("x-telegram-id") || request.cookies.get("telegram_id")?.value;
    
    // Добавляем нового администратора
    const admin = await prisma.adminUser.create({
      data: {
        telegramId: data.telegramId,
        username: data.username,
        fullName: data.fullName,
        role: data.role,
        isActive: data.isActive,
        addedById: currentTelegramId,
      }
    });
    
    return NextResponse.json({ admin }, { status: 201 });
  } catch (error) {
    console.error("Error creating admin:", error);
    return NextResponse.json(
      { error: "Failed to create admin" },
      { status: 500 }
    );
  }
} 