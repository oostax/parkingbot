"use client";

import { useState, useEffect } from "react";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Loader2, X } from "lucide-react";
import { ParkingInfo } from "@/types/parking";
// Импорты удалены - используем единый компонент

interface ParkingCardProps {
  parking: ParkingInfo;
  onClose: () => void;
  onToggleFavorite: () => void;
  allParkings: ParkingInfo[];
  interceptingParkings?: ParkingInfo[]; // Добавляем массив перехватывающих парковок
}

export default function ParkingCard({ parking, onClose, onToggleFavorite, allParkings, interceptingParkings = [] }: ParkingCardProps) {
  // Определяем, является ли парковка перехватывающей по типу из данных
  const [isIntercepting, setIsIntercepting] = useState<boolean | null>(null);
  const [isLoadingData, setIsLoadingData] = useState<boolean>(true);
  
  // Проверяем тип парковки при монтировании компонента
  useEffect(() => {
    // Проверяем, есть ли свойство isIntercepting в объекте парковки
    if (parking.isIntercepting !== undefined) {
      console.log(`Parking type determined from isIntercepting property: ${parking.isIntercepting}`);
      setIsIntercepting(parking.isIntercepting);
      setIsLoadingData(false);
      return;
    }
    
    // Проверяем, есть ли парковка в массиве перехватывающих парковок
    if (interceptingParkings && interceptingParkings.length > 0) {
      const isInInterceptingArray = interceptingParkings.some(p => p.id === parking.id);
      if (isInInterceptingArray) {
        console.log(`Parking ${parking.id} found in interceptingParkings array`);
        setIsIntercepting(true);
        setIsLoadingData(false);
        return;
      }
    }
    
    // Если тип указан напрямую в объекте парковки
    if (parking.type) {
      console.log(`Parking type determined from parking object: ${parking.type}`);
      setIsIntercepting(parking.type === "intercepting");
          setIsLoadingData(false);
            return;
          }
          
    // Ищем парковку в общем списке, чтобы узнать её тип
    if (allParkings && allParkings.length > 0) {
      const parkingData = allParkings.find(p => p.id === parking.id);
      if (parkingData && parkingData.type) {
        console.log(`Parking type determined from allParkings: ${parkingData.type}`);
        setIsIntercepting(parkingData.type === "intercepting");
          setIsLoadingData(false);
        return;
      }
    }
    
    // Проверяем наличие данных о свободных местах в объекте парковки
    // Если есть данные о свободных местах, то это перехватывающая парковка
    if (parking.freeSpaces !== undefined || parking.totalSpaces !== undefined) {
      console.log(`Parking type determined from spaces data: intercepting`);
      setIsIntercepting(true);
      setIsLoadingData(false);
          return;
        }
        
    // Если тип не удалось определить из данных, делаем запрос API
    // только для проверки, является ли парковка перехватывающей
    try {
      console.log(`Checking if parking ${parking.id} is intercepting via API...`);
      const checkParkingType = async () => {
        const timestamp = new Date().getTime();
        const response = await fetch(`/api/parkings/${parking.id}/live?noCache=true&t=${timestamp}`);
        
        if (response.ok) {
        const data = await response.json();
          // Если данные успешно загружены, считаем парковку перехватывающей
          const isInterceptingValue = data && !('dataAvailable' in data && data.dataAvailable === false);
          console.log(`API check result: parking is ${isInterceptingValue ? 'intercepting' : 'regular'}`);
          setIsIntercepting(isInterceptingValue);
        } else {
          console.log(`API check failed, assuming regular parking`);
          setIsIntercepting(false);
        }
        setIsLoadingData(false);
      };
      
      checkParkingType();
      } catch (error) {
      console.error("Error checking if parking is intercepting:", error);
      setIsIntercepting(false);
      setIsLoadingData(false);
    }
  }, [parking, allParkings, interceptingParkings]);

  // Функция для безопасного закрытия карточки
  const handleClose = () => {
    // Отправляем событие для предотвращения автоцентрирования
    window.dispatchEvent(new Event('prevent-auto-center'));
    
    // Закрываем карточку
    onClose();
  };
      
  // Если данные еще не загружены, показываем индикатор загрузки
  if (isLoadingData || isIntercepting === null) {
  return (
    <div className="relative">
        <Card className="w-full max-w-md mx-auto overflow-hidden card-animated">
        <CardHeader className="pb-2">
          <div className="flex items-start justify-between">
            <div>
              <CardTitle className="text-lg font-bold flex items-center">
                {parking.name}
              </CardTitle>
              <CardDescription className="text-sm">
                {parking.street} {parking.house}
              </CardDescription>
            </div>
              <Button
                variant="ghost"
                size="icon"
                className="h-8 w-8 rounded-full btn-animated"
                onClick={handleClose}
              >
                <X className="h-4 w-4" />
              </Button>
          </div>
        </CardHeader>
          <CardContent className="pb-2 flex items-center justify-center p-8">
            <div className="text-center">
              <Loader2 className="h-8 w-8 animate-spin mx-auto text-primary" />
              <p className="mt-2 text-sm text-gray-500">Загрузка данных...</p>
            </div>
          </CardContent>
        </Card>
          </div>
    );
  }

  // После инициализации показываем единую карточку
  return (
    <div className="relative">
      <Card className="w-full max-w-md mx-auto overflow-hidden card-animated">
        <CardHeader className="pb-2">
          <div className="flex items-start justify-between">
            <div>
              <CardTitle className="text-lg font-bold flex items-center">
                {parking.name}
              </CardTitle>
              <CardDescription className="text-sm">
                {parking.street} {parking.house}
              </CardDescription>
            </div>
            <Button
              variant="ghost"
              size="icon"
              className="h-8 w-8 rounded-full btn-animated"
              onClick={handleClose}
            >
              <X className="h-4 w-4" />
            </Button>
          </div>
        </CardHeader>
        <CardContent className="pb-2">
          <div className="space-y-3">
            {/* Информация о парковке */}
            <div className="text-sm text-gray-600">
              <p><strong>Адрес:</strong> {parking.street} {parking.house}</p>
              {parking.subway && <p><strong>Метро:</strong> {parking.subway}</p>}
              {parking.schedule && <p><strong>Режим работы:</strong> {parking.schedule}</p>}
              {parking.price && <p><strong>Стоимость:</strong> {parking.price}</p>}
            </div>
            
            {/* Данные о свободных местах для перехватывающих парковок */}
            {isIntercepting && (parking.freeSpaces !== undefined || parking.totalSpaces !== undefined) && (
              <div className="bg-blue-50 p-3 rounded-lg">
                <h4 className="font-semibold text-blue-800 mb-2">Доступность мест</h4>
                <div className="flex justify-between items-center">
                  <span className="text-sm">Свободно мест:</span>
                  <span className="font-bold text-blue-600">
                    {parking.freeSpaces !== undefined ? parking.freeSpaces : 'N/A'} / {parking.totalSpaces !== undefined ? parking.totalSpaces : 'N/A'}
                  </span>
                </div>
              </div>
            )}
            
            {/* Кнопка избранного */}
            <Button
              onClick={onToggleFavorite}
              variant="outline"
              className="w-full"
            >
              {parking.isFavorite ? 'Удалить из избранного' : 'Добавить в избранное'}
            </Button>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}