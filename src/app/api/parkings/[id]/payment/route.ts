import { NextRequest, NextResponse } from 'next/server';
import { calculateParkingCost } from '@/lib/parking-utils';
import { ParkingPaymentInfo } from '@/types/parking';

export async function POST(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    // В Next.js 13+ и выше не нужно использовать await для params
    // Используем params.id напрямую
    const parkingId = params.id;
    
    // Получаем данные из запроса
    const paymentInfo: ParkingPaymentInfo = await request.json();
    
    // Проверяем наличие обязательных полей
    if (!paymentInfo.vehicleType || !paymentInfo.vehicleNumber || !paymentInfo.duration) {
      return NextResponse.json(
        { error: 'Отсутствуют обязательные параметры' },
        { status: 400 }
      );
    }
    
    // Добавляем ID парковки из URL
    paymentInfo.parkingId = parkingId;
    
    // Рассчитываем стоимость парковки
    const calculation = await calculateParkingCost(paymentInfo);
    
    if (!calculation) {
      return NextResponse.json(
        { error: 'Не удалось рассчитать стоимость парковки' },
        { status: 500 }
      );
    }
    
    return NextResponse.json(calculation);
  } catch (error) {
    console.error('Ошибка при расчете стоимости парковки:', error);
    return NextResponse.json(
      { error: 'Внутренняя ошибка сервера' },
      { status: 500 }
    );
  }
} 