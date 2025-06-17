"use client";

import { useState, useRef, useEffect } from "react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from "@/components/ui/card";
import { WheelPrize } from "@/types/gamification";
import { Coins, Gift } from "lucide-react";
import { useToast } from "@/hooks/use-toast";

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

// Цвета для секторов колеса
const sectorColors = [
  "#FF6384", "#36A2EB", "#FFCE56", "#4BC0C0", "#9966FF", 
  "#FF9F40", "#8AC249", "#EA526F", "#49ADF5", "#FFD166"
];

interface FortuneWheelProps {
  tokenCost?: number; // Стоимость одного вращения в токенах
  onWin?: (prize: WheelPrize) => void;
  userTokens?: number;
}

export default function FortuneWheel({ tokenCost = 30, onWin, userTokens = 0 }: FortuneWheelProps) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const [isSpinning, setIsSpinning] = useState(false);
  const [selectedPrize, setSelectedPrize] = useState<WheelPrize | null>(null);
  const [rotation, setRotation] = useState(0);
  const [prizes, setPrizes] = useState<WheelPrize[]>([]);
  const { toast } = useToast();
  
  // Загружаем призы
  useEffect(() => {
    // В реальном приложении здесь будет запрос к API
    setPrizes(mockPrizes);
  }, []);

  // Рисуем колесо при изменении призов
  useEffect(() => {
    if (prizes.length > 0) {
      drawWheel();
    }
  }, [prizes, rotation]);

  // Функция для рисования колеса
  const drawWheel = () => {
    const canvas = canvasRef.current;
    if (!canvas) return;

    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    // Очищаем канвас
    ctx.clearRect(0, 0, canvas.width, canvas.height);

    // Центр колеса
    const centerX = canvas.width / 2;
    const centerY = canvas.height / 2;
    const radius = Math.min(centerX, centerY) - 10;

    // Рисуем сектора
    const totalPrizes = prizes.length;
    const arc = 2 * Math.PI / totalPrizes;

    // Применяем текущий поворот
    ctx.save();
    ctx.translate(centerX, centerY);
    ctx.rotate(rotation);
    
    prizes.forEach((prize, index) => {
      // Начальный угол для сектора
      const startAngle = index * arc;
      // Конечный угол для сектора
      const endAngle = startAngle + arc;
      
      // Рисуем сектор
      ctx.beginPath();
      ctx.moveTo(0, 0);
      ctx.arc(0, 0, radius, startAngle, endAngle);
      ctx.closePath();
      
      // Заливка сектора
      ctx.fillStyle = sectorColors[index % sectorColors.length];
      ctx.fill();
      
      // Текст приза
      ctx.save();
      ctx.rotate(startAngle + arc / 2);
      ctx.textAlign = "right";
      ctx.fillStyle = "#fff";
      ctx.font = "bold 12px Arial";
      ctx.fillText(prize.name, radius - 20, 5);
      ctx.restore();
    });
    
    ctx.restore();
    
    // Рисуем центральный круг
    ctx.beginPath();
    ctx.arc(centerX, centerY, 15, 0, 2 * Math.PI);
    ctx.fillStyle = "#fff";
    ctx.fill();
    ctx.strokeStyle = "#000";
    ctx.lineWidth = 2;
    ctx.stroke();
    
    // Рисуем указатель
    ctx.beginPath();
    ctx.moveTo(centerX + radius + 10, centerY);
    ctx.lineTo(centerX + radius - 10, centerY - 15);
    ctx.lineTo(centerX + radius - 10, centerY + 15);
    ctx.closePath();
    ctx.fillStyle = "#FF0000";
    ctx.fill();
  };

  // Функция для запуска вращения колеса
  const spinWheel = () => {
    if (isSpinning || userTokens < tokenCost) return;
    
    if (userTokens < tokenCost) {
      toast({
        title: "Недостаточно баллов",
        description: `Для вращения колеса нужно ${tokenCost} баллов`,
        variant: "destructive",
      });
      return;
    }

    setIsSpinning(true);
    setSelectedPrize(null);
    
    // Делаем запрос к API для вращения колеса
    fetch('/api/gamification/wheel', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({}),
    })
      .then(response => {
        if (!response.ok) {
          throw new Error('Ошибка при вращении колеса');
        }
        return response.json();
      })
      .then(data => {
        if (data.success && data.prize) {
          // Находим индекс выигрышного сектора
          const winningPrize = data.prize;
          const winningIndex = prizes.findIndex(p => p.id === winningPrize.id);
          
          // Вычисляем угол для остановки колеса
          const totalPrizes = prizes.length;
          const arc = 2 * Math.PI / totalPrizes;
          
          // Базовое количество оборотов (5-10) + позиция выигрышного сектора
          const spinAngle = 
            2 * Math.PI * (5 + Math.random() * 5) + // 5-10 полных оборотов
            (totalPrizes - winningIndex - 0.5) * arc;
          
          // Запускаем анимацию вращения
          let startTime: number | null = null;
          const animationDuration = 5000; // 5 секунд
          
          const animate = (timestamp: number) => {
            if (!startTime) startTime = timestamp;
            const elapsed = timestamp - startTime;
            const progress = Math.min(elapsed / animationDuration, 1);
            
            // Функция замедления (easeOut)
            const easeOut = (t: number) => 1 - Math.pow(1 - t, 3);
            const currentAngle = spinAngle * easeOut(progress);
            
            setRotation(currentAngle);
            
            if (progress < 1) {
              requestAnimationFrame(animate);
            } else {
              // Анимация завершена
              setSelectedPrize(winningPrize);
              setIsSpinning(false);
              
              // Вызываем колбэк с информацией о выигрыше
              if (onWin) {
                onWin(winningPrize);
              }
            }
          };
          
          requestAnimationFrame(animate);
        } else {
          // Если что-то пошло не так
          setIsSpinning(false);
          toast({
            title: "Ошибка",
            description: data.error || "Произошла ошибка при вращении колеса",
            variant: "destructive",
          });
        }
      })
      .catch(error => {
        console.error("Error spinning wheel:", error);
        setIsSpinning(false);
        toast({
          title: "Ошибка",
          description: "Не удалось связаться с сервером",
          variant: "destructive",
        });
      });
  };

  return (
    <Card className="w-full">
      <CardHeader className="pb-3">
        <CardTitle className="text-center">Колесо удачи</CardTitle>
        <CardDescription className="text-center">
          Испытайте удачу и выиграйте призы!
        </CardDescription>
      </CardHeader>
      <CardContent className="flex flex-col items-center">
        <div className="relative mb-4">
          <canvas 
            ref={canvasRef} 
            width={300} 
            height={300} 
            className="mx-auto"
          />
        </div>
        
        {selectedPrize && (
          <div className="bg-primary/10 p-4 rounded-lg w-full text-center mb-4">
            <h3 className="font-bold text-lg mb-1">Ваш выигрыш!</h3>
            <div className="flex items-center justify-center gap-2">
              {selectedPrize.type === 'tokens' ? (
                <Coins className="h-5 w-5 text-amber-500" />
              ) : (
                <Gift className="h-5 w-5 text-primary" />
              )}
              <span className="font-medium">{selectedPrize.name}</span>
            </div>
            <p className="text-sm text-muted-foreground mt-1">{selectedPrize.description}</p>
          </div>
        )}
      </CardContent>
      <CardFooter>
        <Button 
          onClick={spinWheel} 
          disabled={isSpinning || userTokens < tokenCost}
          className="w-full"
        >
          {isSpinning ? (
            <>
              <div className="animate-spin mr-2 h-4 w-4 border-2 border-current border-t-transparent rounded-full" />
              Вращение...
            </>
          ) : (
            <>
              <Coins className="mr-2 h-4 w-4" /> 
              Крутить за {tokenCost} баллов
            </>
          )}
        </Button>
      </CardFooter>
    </Card>
  );
} 