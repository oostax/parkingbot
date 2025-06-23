import { useState } from "react";
import { Card, CardContent, CardFooter, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { ParkingInfo } from "@/types/parking";
import { useToast } from "@/hooks/use-toast";
import { Loader2, Star, X, Heart, Car, CreditCard } from "lucide-react";
import { useSession } from "next-auth/react";
import ParkingPayment from "./parking-payment";

interface RegularParkingCardProps {
  parking: ParkingInfo;
  onClose: () => void;
  onToggleFavorite: () => void;
}

export default function RegularParkingCard({ parking, onClose, onToggleFavorite }: RegularParkingCardProps) {
  const { data: session } = useSession();
  const { toast } = useToast();
  const [isExpanded, setIsExpanded] = useState<boolean>(false);
  const [isFavoriteLoading, setIsFavoriteLoading] = useState<boolean>(false);
  const [showPayment, setShowPayment] = useState<boolean>(false);

  // Функция для построения маршрута
  const buildRoute = () => {
    // Закрываем карточку
    onClose();
    
    // Отправляем событие для построения маршрута
    const event = new CustomEvent('build-route', { 
      detail: { parking }
    });
    window.dispatchEvent(event);
  };

  // Функция для безопасного закрытия карточки
  const handleClose = () => {
    // Отправляем событие для предотвращения автоцентрирования
    window.dispatchEvent(new Event('prevent-auto-center'));
    
    // Закрываем карточку
    onClose();
  };

  // Функция для обработки добавления/удаления из избранного
  const toggleFavorite = async () => {
    if (!session) {
      toast({
        title: "Требуется авторизация",
        description: "Войдите через Telegram, чтобы добавить парковку в избранное",
        variant: "default",
      });
      return;
    }
    
    setIsFavoriteLoading(true);
    onToggleFavorite();
    setIsFavoriteLoading(false);
  };

  // Проверяем, является ли парковка платной
  const isPaid = parking.price && parking.price !== "Бесплатно";

  // Если показываем экран оплаты
  if (showPayment) {
    return (
      <div className="relative">
        <ParkingPayment 
          parking={parking} 
          onClose={() => setShowPayment(false)} 
        />
      </div>
    );
  }

  return (
    <div className="relative">
      <Card className={`w-full max-w-md mx-auto overflow-hidden card-animated ${isExpanded ? 'shadow-lg' : ''}`}>
        <CardHeader className="pb-2">
          <div className="flex items-start justify-between">
            <div>
              <CardTitle className="text-lg font-bold flex items-center">
                {parking.name}
                {parking.isFavorite && (
                  <Star className="h-4 w-4 ml-2 text-amber-500 fill-amber-500 animate-fadeInUp" />
                )}
              </CardTitle>
              <CardDescription className="text-sm">
                {parking.street} {parking.house}
              </CardDescription>
              {parking.subway && (
                <div className="text-xs mt-1 inline-block px-2 py-1 bg-blue-100 rounded-full">
                  Метро {parking.subway}
                </div>
              )}
            </div>
            <div className="flex gap-1">
              <Button
                variant="ghost"
                size="icon"
                className="h-8 w-8 rounded-full btn-animated"
                onClick={toggleFavorite}
              >
                {isFavoriteLoading ? (
                  <Loader2 className="h-4 w-4 animate-spin" />
                ) : parking.isFavorite ? (
                  <Heart className="h-4 w-4 text-red-500 fill-red-500" />
                ) : (
                  <Heart className="h-4 w-4" />
                )}
              </Button>
              <Button
                variant="ghost"
                size="icon"
                className="h-8 w-8 rounded-full btn-animated"
                onClick={handleClose}
              >
                <X className="h-4 w-4" />
              </Button>
            </div>
          </div>
        </CardHeader>
        
        <CardContent className="pb-2">
          {/* Основная информация всегда видна */}
          <div className="mb-4">
            {/* Для обычных парковок показываем стоимость и общее количество мест */}
            <div className="flex gap-2 py-2">
              <div className="flex-1 p-3 rounded-md bg-blue-50 flex flex-col items-center">
                <div className="flex items-center justify-center gap-2">
                  <span className="text-blue-600">
                    <Car size={16} />
                  </span>
                  <p className="text-sm font-medium text-blue-600">Всего мест</p>
                </div>
                <p className="text-xl font-bold text-blue-700 mt-1 text-center">
                  {parking.totalSpaces || parking.carCapacity || "Нет данных"}
                </p>
              </div>
              
              <div className="flex-1 p-3 rounded-md bg-green-50 flex flex-col items-center">
                <div className="flex items-center justify-center gap-2">
                  <span className="text-green-600">₽</span>
                  <p className="text-sm font-medium text-green-600">Стоимость в час</p>
                </div>
                <p className="text-xl font-bold text-green-700 mt-1 text-center">
                  {parking.price ? (
                    <>
                      {parking.price}
                    </>
                  ) : (
                    "Бесплатно"
                  )}
                </p>
              </div>
            </div>
          </div>
          
          {/* Расширенная информация видна только при isExpanded=true */}
          {isExpanded && (
            <div className="animate-fadeInUp">
              <div className="bg-gray-50 p-4 rounded-lg">
                <h4 className="text-sm font-medium mb-2">Дополнительная информация</h4>
                
                <div className="space-y-2 text-sm">
                  {parking.schedule && (
                    <div className="flex justify-between">
                      <span className="text-gray-500">Режим работы:</span>
                      <span className="font-medium">{parking.schedule}</span>
                    </div>
                  )}
                  
                  {parking.workingHours && (
                    <div className="flex justify-between">
                      <span className="text-gray-500">Часы работы:</span>
                      <span className="font-medium">{parking.workingHours}</span>
                    </div>
                  )}
                  
                  {parking.paidEntrance !== undefined && (
                    <div className="flex justify-between">
                      <span className="text-gray-500">Платный въезд:</span>
                      <span className="font-medium">{parking.paidEntrance ? "Да" : "Нет"}</span>
                    </div>
                  )}
                  
                  {parking.isClosedBarrier !== undefined && (
                    <div className="flex justify-between">
                      <span className="text-gray-500">Закрытый шлагбаум:</span>
                      <span className="font-medium">{parking.isClosedBarrier ? "Да" : "Нет"}</span>
                    </div>
                  )}
                </div>
              </div>
            </div>
          )}
        </CardContent>
        
        <CardFooter className="flex justify-between items-center p-4 pt-0 gap-2">
          <div className="flex-1">
            <Button 
              variant="outline" 
              className="w-full btn-animated"
              onClick={() => setIsExpanded(!isExpanded)}
            >
              {isExpanded ? "Свернуть" : "Подробнее"}
            </Button>
          </div>
          
          {/* Добавляем кнопку оплаты, если парковка платная */}
          {isPaid && (
            <div className="flex-1">
              <Button 
                variant="outline"
                className="w-full btn-animated text-green-600 border-green-600 hover:bg-green-50"
                onClick={() => setShowPayment(true)}
              >
                <CreditCard className="h-4 w-4 mr-2" />
                Оплатить
              </Button>
            </div>
          )}
        </CardFooter>
        
        <CardFooter className="pt-0 pb-4">
          <Button 
            onClick={buildRoute}
            className="w-full bg-blue-600 hover:bg-blue-700 text-white"
          >
            <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5 mr-2" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 20l-5.447-2.724A1 1 0 013 16.382V5.618a1 1 0 011.447-.894L9 7m0 13l6-3m-6 3V7m6 10l4.553 2.276A1 1 0 0021 18.382V7.618a1 1 0 00-.553-.894L15 4m0 13V4" />
            </svg>
            Построить маршрут
          </Button>
        </CardFooter>
      </Card>
    </div>
  );
} 