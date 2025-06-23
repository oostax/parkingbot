import { useState, useEffect, useRef } from "react";
import { ParkingInfo } from "@/types/parking";

interface ParkingTypeToggleProps {
  onTypeChange: (type: "all" | "intercepting") => void;
  parkings: ParkingInfo[];
  totalParkingsCount?: number;
  interceptingParkings?: ParkingInfo[];
}

export default function ParkingTypeToggle({ onTypeChange, parkings, totalParkingsCount, interceptingParkings }: ParkingTypeToggleProps) {
  const [activeType, setActiveType] = useState<"all" | "intercepting">("intercepting");
  const [interceptingCount, setInterceptingCount] = useState<number>(0);
  // Добавляем ref для отслеживания инициализации
  const initializedRef = useRef<boolean>(false);
  // Добавляем ref для предотвращения множественных вызовов
  const lastTypeChangeTimeRef = useRef<number>(0);
  // Минимальный интервал между вызовами (1 секунда)
  const MIN_TYPE_CHANGE_INTERVAL = 1000;

  // Определяем количество перехватывающих парковок при монтировании и изменении props
  useEffect(() => {
    // Используем interceptingParkings, если они переданы, иначе считаем из parkings
    if (interceptingParkings) {
      console.log(`ParkingTypeToggle: Получено ${interceptingParkings.length} перехватывающих парковок из props`);
      setInterceptingCount(interceptingParkings.length);
    } else {
      // Считаем количество парковок с флагом isIntercepting
      const count = parkings.filter(p => p.isIntercepting).length;
      console.log(`ParkingTypeToggle: Насчитано ${count} перехватывающих парковок из общего списка`);
      setInterceptingCount(count);
    }
    
    // При первом монтировании компонента вызываем функцию переключения на перехватывающие парковки
    if (!initializedRef.current) {
      console.log("ParkingTypeToggle: Первая инициализация, устанавливаем тип 'intercepting'");
      onTypeChange("intercepting");
      initializedRef.current = true;
    }
  }, [parkings, interceptingParkings, onTypeChange]);

  // Добавляем обработчик события для обновления счетчика перехватывающих парковок
  useEffect(() => {
    const handleUpdateInterceptingCount = (event: CustomEvent) => {
      const { count } = event.detail;
      console.log(`Обновление счетчика перехватывающих парковок: ${count}`);
      setInterceptingCount(count);
    };

    // Добавляем слушатель события
    window.addEventListener('update-intercepting-count', handleUpdateInterceptingCount as EventListener);
    
    // Удаляем слушатель при размонтировании
    return () => {
      window.removeEventListener('update-intercepting-count', handleUpdateInterceptingCount as EventListener);
    };
  }, []);

  const handleTypeChange = (type: "all" | "intercepting") => {
    // Проверяем, не слишком ли часто вызывается переключение типа
    const now = Date.now();
    if (now - lastTypeChangeTimeRef.current < MIN_TYPE_CHANGE_INTERVAL) {
      console.log(`Игнорируем слишком частый вызов переключения типа (прошло ${now - lastTypeChangeTimeRef.current}мс)`);
      return;
    }
    
    // Если тип не изменился, не делаем ничего
    if (type === activeType) {
      console.log(`Тип парковок не изменился: ${type}, игнорируем вызов`);
      return;
    }
    
    console.log(`Переключение типа парковок на: ${type}`);
    console.log(`Количество перехватывающих парковок: ${interceptingCount}`);
    
    // Отправляем событие для предотвращения автоцентрирования
    window.dispatchEvent(new Event('prevent-auto-center'));
    
    // Обновляем время последнего изменения типа
    lastTypeChangeTimeRef.current = now;
    
    setActiveType(type);
    onTypeChange(type);
  };

  return (
    <div className="absolute top-4 left-1/2 transform -translate-x-1/2 z-50 flex bg-white rounded-full shadow-lg overflow-hidden">
      <button
        onClick={() => handleTypeChange("all")}
        className={`px-4 py-2 flex items-center justify-center transition-all ${
          activeType === "all" ? "bg-blue-500 text-white" : "bg-white text-gray-700 hover:bg-gray-100"
        }`}
      >
        <span className="mr-2">Все парковки</span>
        <span className="bg-blue-200 text-blue-800 px-2 py-0.5 rounded-full text-xs font-medium">
          {totalParkingsCount || parkings.length}
        </span>
      </button>
      <button
        onClick={() => handleTypeChange("intercepting")}
        className={`px-4 py-2 flex items-center justify-center transition-all ${
          activeType === "intercepting" ? "bg-blue-500 text-white" : "bg-white text-gray-700 hover:bg-gray-100"
        }`}
      >
        <span className="mr-2">Перехватывающие</span>
        <span className={`${activeType === "intercepting" ? "bg-blue-200 text-blue-800" : "bg-gray-200 text-gray-800"} px-2 py-0.5 rounded-full text-xs font-medium`}>
          {interceptingCount}
        </span>
      </button>
    </div>
  );
} 