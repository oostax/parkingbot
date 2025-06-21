import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/app/api/auth/[...nextauth]/options";
import { WheelPrize } from "@/types/gamification";
import { prisma } from "@/lib/prisma";

// Временные данные для демонстрации
const mockPrizes: WheelPrize[] = [
  { id: "1", name: "5 баллов", description: "5 баллов на ваш счет", type: "tokens", value: 5, probability: 30 },
  { id: "2", name: "10 баллов", description: "10 баллов на ваш счет", type: "tokens", value: 10, probability: 20 },
  { id: "3", name: "15 баллов", description: "15 баллов на ваш счет", type: "tokens", value: 15, probability: 15 },
  { id: "4", name: "25 баллов", description: "25 баллов на ваш счет", type: "tokens", value: 25, probability: 10 },
  { id: "5", name: "50 баллов", description: "50 баллов на ваш счет", type: "tokens", value: 50, probability: 5 },
  { id: "6", name: "Скидка 5%", description: "Скидка 5% на кофе", type: "discount", value: "5% на кофе", probability: 10 },
  { id: "7", name: "Скидка 10%", description: "Скидка 10% на бензин", type: "discount", value: "10% на бензин", probability: 7 },
  { id: "8", name: "Бонус статус", description: "Временный бонус к статусу", type: "status_boost", value: "Временный Gold", probability: 3 }
];

// Временные данные о балансе пользователей
const mockUserTokens: Record<string, number> = {
  "default": 10
};

export async function GET() {
  try {
    const session = await getServerSession(authOptions);
    
    if (!session || !session.user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }
    
    // В реальном приложении здесь будет запрос к базе данных
    // Для демонстрации используем заглушку
    
    return NextResponse.json({ prizes: mockPrizes });
  } catch (error) {
    console.error("Error fetching wheel prizes:", error);
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
    
    // Получаем текущий баланс пользователя из базы данных
    let userProfile;
    try {
      userProfile = await prisma.userProfile.findUnique({
        where: {
          userId: userId,
        },
      });
    } catch (error) {
      console.error("Error finding user profile:", error);
      return NextResponse.json({ error: "Error finding user profile" }, { status: 500 });
    }
    
    // Если профиль не найден, используем моковые данные
    const userTokens = userProfile?.tokenBalance || mockUserTokens.default;
    
    // Проверяем, достаточно ли токенов для вращения
    const spinCost = 30; // Стоимость одного вращения
    
    if (userTokens < spinCost) {
      return NextResponse.json({ 
        error: "Insufficient tokens", 
        message: "Недостаточно баллов для вращения колеса" 
      }, { status: 400 });
    }
    
    // Выбираем приз на основе вероятности
    const randomValue = Math.random() * 100;
    let cumulativeProbability = 0;
    let prize: WheelPrize | null = null;
    
    for (const p of mockPrizes) {
      cumulativeProbability += p.probability;
      if (randomValue <= cumulativeProbability) {
        prize = p;
        break;
      }
    }
    
    // Если не выбран приз (что маловероятно), выбираем первый
    if (!prize && mockPrizes.length > 0) {
      prize = mockPrizes[0];
    }
    
    if (!prize) {
      return NextResponse.json({ error: "Failed to select prize" }, { status: 500 });
    }
    
    // Вычитаем стоимость вращения
    const newBalance = userTokens - spinCost;
    
    // Если выигрыш - токены, добавляем их к балансу
    let finalBalance = newBalance;
    if (prize.type === 'tokens') {
      finalBalance += Number(prize.value);
    }
    
    // Обновляем баланс пользователя в базе данных
    try {
      // Создаем транзакцию для списания стоимости вращения
      await prisma.tokenTransaction.create({
        data: {
          userId: userId,
          amount: -spinCost,
          type: "WHEEL_SPIN",
          description: "Вращение колеса удачи",
        },
      });
      
      // Если выигрыш - токены, создаем транзакцию для начисления
      if (prize.type === 'tokens') {
        await prisma.tokenTransaction.create({
          data: {
            userId: userId,
            amount: Number(prize.value),
            type: "WHEEL_WIN",
            description: `Выигрыш в колесе удачи: ${prize.name}`,
          },
        });
      }
      
      // Обновляем баланс в профиле пользователя
      await prisma.userProfile.update({
        where: {
          userId: userId,
        },
        data: {
          tokenBalance: finalBalance,
          totalTokensSpent: { increment: spinCost },
          ...(prize.type === 'tokens' ? { totalTokensEarned: { increment: Number(prize.value) } } : {}),
        },
      });
    } catch (error) {
      console.error("Error updating user balance:", error);
      return NextResponse.json({ error: "Error updating user balance" }, { status: 500 });
    }
    
    // Возвращаем информацию о выигрыше
    return NextResponse.json({ 
      success: true,
      prize,
      previousBalance: userTokens,
      newBalance: finalBalance
    });
  } catch (error) {
    console.error("Error spinning wheel:", error);
    return NextResponse.json({ error: "Internal Server Error" }, { status: 500 });
  }
} 