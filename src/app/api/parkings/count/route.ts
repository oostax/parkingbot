import { NextRequest, NextResponse } from "next/server";
import fs from "fs";
import path from "path";

// Кэш для общего количества парковок
let totalParkingsCount: number | null = null;
let interceptingParkingsCount: number | null = null;
let lastCacheTime = 0;
// Время жизни кэша - 1 час
const CACHE_TTL = 60 * 60 * 1000;

export async function GET(request: NextRequest) {
  try {
    const searchParams = request.nextUrl.searchParams;
    const noCache = searchParams.get("noCache") === "true";
    
    // Если есть актуальный кэш и не требуется обновление
    if (totalParkingsCount !== null && interceptingParkingsCount !== null && 
        !noCache && (Date.now() - lastCacheTime < CACHE_TTL)) {
      console.log("Используем кэш для общего количества парковок");
      return NextResponse.json({ 
        total: totalParkingsCount,
        intercepting: interceptingParkingsCount
      });
    }
    
    // Путь к файлу с данными о платных парковках
    const paidFilePath = path.join(process.cwd(), "public", "data", "all_parking_data.json");
    
    // Путь к файлу с данными о перехватывающих парковках
    const interceptingFilePath = path.join(process.cwd(), "public", "data", "parking_data.json");
    
    // Проверяем существование файла с платными парковками
    if (!fs.existsSync(paidFilePath)) {
      console.error("Файл с данными о платных парковках не найден:", paidFilePath);
      return NextResponse.json(
        { error: "Файл с данными о парковках не найден" },
        { status: 404 }
      );
    }
    
    // Проверяем существование файла с перехватывающими парковками
    if (!fs.existsSync(interceptingFilePath)) {
      console.error("Файл с данными о перехватывающих парковках не найден:", interceptingFilePath);
      return NextResponse.json(
        { error: "Файл с данными о перехватывающих парковках не найден" },
        { status: 404 }
      );
    }
    
    // Читаем файл с платными парковками
    const paidFileContent = fs.readFileSync(paidFilePath, "utf-8");
    const paidData = JSON.parse(paidFileContent);
    
    // Читаем файл с перехватывающими парковками
    const interceptingFileContent = fs.readFileSync(interceptingFilePath, "utf-8");
    const interceptingData = JSON.parse(interceptingFileContent);
    
    // Проверяем формат данных платных парковок
    if (!paidData.parkings || !Array.isArray(paidData.parkings)) {
      console.error("Неверный формат данных в файле all_parking_data.json");
      return NextResponse.json(
        { error: "Неверный формат данных в файле платных парковок" },
        { status: 500 }
      );
    }
    
    // Проверяем формат данных перехватывающих парковок
    if (!Array.isArray(interceptingData)) {
      console.error("Неверный формат данных в файле parking_data.json");
      return NextResponse.json(
        { error: "Неверный формат данных в файле перехватывающих парковок" },
        { status: 500 }
      );
    }
    
    // Для перехватывающих парковок используем только данные из parking_data.json
    // Это файл содержит только уникальные записи, поэтому просто берем длину массива
    interceptingParkingsCount = interceptingData.length;
    console.log(`Количество перехватывающих парковок из parking_data.json: ${interceptingParkingsCount}`);
    
    // Получаем общее количество парковок
    totalParkingsCount = paidData.parkings.length + interceptingParkingsCount;
    
    // Обновляем время кэширования
    lastCacheTime = Date.now();
    
    console.log(`Общее количество парковок: ${totalParkingsCount}, из них перехватывающих: ${interceptingParkingsCount}`);
    
    return NextResponse.json({
      total: totalParkingsCount,
      intercepting: interceptingParkingsCount
    });
    
  } catch (error) {
    console.error('Ошибка при получении количества парковок:', error);
    return NextResponse.json(
      { error: 'Не удалось получить количество парковок' },
      { status: 500 }
    );
  }
} 