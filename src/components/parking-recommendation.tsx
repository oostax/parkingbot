'use client';

import { useState, useEffect } from 'react';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { useTelegramLocation } from '@/hooks/use-telegram-location';
import { getParkingRecommendations } from '@/lib/recommendation-service';
import { ParkingInfo } from '@/types/parking';
import { Clock, Car, MapPin, AlertTriangle, ThumbsUp, Map, Calendar } from 'lucide-react';
import { Badge } from "@/components/ui/badge";

interface ParkingRecommendationProps {
  parking: ParkingInfo;
  allParkings: ParkingInfo[];
  onParkingSelect: (parking: ParkingInfo) => void;
}

export default function ParkingRecommendation({ 
  parking,
  allParkings,
  onParkingSelect
}: ParkingRecommendationProps) {
  const [recommendation, setRecommendation] = useState<any>(null);
  const [loading, setLoading] = useState<boolean>(true);
  const [showAlternatives, setShowAlternatives] = useState(false);
  const { location, loading: locationLoading, error: locationError, requestLocation } = useTelegramLocation();
  
  // Добавляем мемоизацию ID парковки, чтобы отслеживать реальные изменения
  const [lastProcessedParkingId, setLastProcessedParkingId] = useState<string | null>(null);

  // Функция для форматирования времени прибытия
  const formatArrivalTime = (travelTimeMinutes: number): string => {
    const now = new Date();
    const arrivalTime = new Date(now.getTime() + travelTimeMinutes * 60 * 1000);
    
    // Форматируем время как "HH:MM"
    const hours = arrivalTime.getHours().toString().padStart(2, '0');
    const minutes = arrivalTime.getMinutes().toString().padStart(2, '0');
    
    return `${hours}:${minutes}`;
  };

  useEffect(() => {
    const loadRecommendation = async () => {
      // Проверяем, что у нас есть локация и парковка
      if (!location || !parking || !parking.id) {
        setLoading(false);
        return;
      }
      
      // Пропускаем повторную обработку той же самой парковки
      if (lastProcessedParkingId === parking.id) {
        return;
      }
      
      try {
        setLoading(true);
        const result = await getParkingRecommendations(location, parking, allParkings);
        setRecommendation(result);
        setLastProcessedParkingId(parking.id);
      } catch (error) {
        console.error('Ошибка при получении рекомендаций:', error);
      } finally {
        setLoading(false);
      }
    };

    loadRecommendation();
    // Добавляем только необходимые зависимости: локация, ID парковки и lastProcessedParkingId
  }, [location, parking?.id, lastProcessedParkingId]);

  const handleRequestLocation = async () => {
    await requestLocation();
  };

  if (!parking) {
    return null;
  }

  if (loading || locationLoading) {
    return (
      <Card className="mt-4">
        <CardContent className="p-4">
          <div className="flex flex-col items-center justify-center space-y-2">
            <div className="w-6 h-6 border-2 border-blue-500 border-t-transparent rounded-full animate-spin"></div>
            <p className="text-sm text-gray-500">Анализируем ситуацию...</p>
          </div>
        </CardContent>
      </Card>
    );
  }

  if (!location && !locationError) {
    return (
      <Card className="mt-4 border-amber-200">
        <CardContent className="p-4">
          <div className="flex flex-col items-center justify-center space-y-3">
            <AlertTriangle className="text-amber-500 h-6 w-6" />
            <p className="text-sm text-center">Для персонализированных рекомендаций по парковке необходим доступ к вашему местоположению</p>
            <Button 
              variant="outline" 
              size="sm"
              onClick={handleRequestLocation}
            >
              <MapPin className="mr-2 h-4 w-4" /> Предоставить доступ
            </Button>
          </div>
        </CardContent>
      </Card>
    );
  }

  if (locationError) {
    return (
      <Card className="mt-4 border-rose-200">
        <CardContent className="p-4">
          <div className="flex flex-col items-center justify-center space-y-2">
            <AlertTriangle className="text-rose-500 h-6 w-6" />
            <p className="text-sm text-center text-rose-700">{locationError}</p>
            <Button 
              variant="outline" 
              size="sm"
              onClick={handleRequestLocation}
            >
              <MapPin className="mr-2 h-4 w-4" /> Попробовать снова
            </Button>
          </div>
        </CardContent>
      </Card>
    );
  }

  if (!recommendation) {
    return null;
  }

  // Функция для определения стиля и иконки на основе рекомендации
  const getRecommendationStyle = () => {
    switch (recommendation.recommendation) {
      case 'recommended':
        return {
          color: 'text-green-600',
          bgColor: 'bg-green-50',
          borderColor: 'border-green-200',
          icon: <ThumbsUp className="text-green-500 h-6 w-6" />
        };
      case 'alternative':
        return {
          color: 'text-amber-600',
          bgColor: 'bg-amber-50',
          borderColor: 'border-amber-200',
          icon: <Map className="text-amber-500 h-6 w-6" />
        };
      case 'not_recommended':
        return {
          color: 'text-rose-600',
          bgColor: 'bg-rose-50',
          borderColor: 'border-rose-200',
          icon: <AlertTriangle className="text-rose-500 h-6 w-6" />
        };
      default:
        return {
          color: 'text-gray-600',
          bgColor: 'bg-gray-50',
          borderColor: 'border-gray-200',
          icon: <AlertTriangle className="text-gray-500 h-6 w-6" />
        };
    }
  };

  const style = getRecommendationStyle();
  
  // Вычисляем примерное время прибытия, если есть данные о времени в пути
  const estimatedArrivalTime = recommendation.travelTime 
    ? formatArrivalTime(recommendation.travelTime)
    : null;

  return (
    <Card className={`mt-4 ${style.borderColor}`}>
      <CardContent className="p-4">
        <div className={`flex items-start space-x-3 mb-3 ${style.color}`}>
          {style.icon}
          <div>
            <h3 className="font-medium">Рекомендация</h3>
            <p className="text-sm">{recommendation.reason}</p>
          </div>
        </div>
        
        {recommendation.travelTime && (
          <div className="flex flex-col space-y-2 mb-3">
            <div className="flex items-center text-sm text-gray-600">
              <Clock className="h-4 w-4 mr-2 shrink-0" />
              <span>Время в пути: приблизительно {recommendation.travelTime} мин</span>
            </div>
            
            {estimatedArrivalTime && (
              <div className="flex items-center text-sm text-gray-600">
                <Calendar className="h-4 w-4 mr-2 shrink-0" />
                <span>Примерное прибытие в {estimatedArrivalTime}</span>
              </div>
            )}
          </div>
        )}
        
        {recommendation.availableSpots !== undefined && (
          <div className="flex items-center text-sm text-gray-600 mb-2">
            <Car className="h-4 w-4 mr-2" />
            <span>
              {recommendation.recommendation === 'recommended' 
                ? `К вашему прибытию ожидается ${recommendation.availableSpots} свободных мест из ${parking.totalSpaces || '?'}`
                : `Свободных мест: ${recommendation.availableSpots} из ${parking.totalSpaces || '?'}`
              }
            </span>
          </div>
        )}

        {recommendation.alternatives && recommendation.alternatives.length > 0 && (
          <div className="mt-3">
            <div 
              className="flex items-center text-blue-600 cursor-pointer border-t pt-2"
              onClick={() => setShowAlternatives(!showAlternatives)}
            >
              <Map className="h-4 w-4 mr-2" />
              <span className="text-sm font-medium">
                {showAlternatives ? 'Скрыть альтернативы' : 'Показать альтернативные парковки'}
              </span>
            </div>

            {showAlternatives && (
              <div className="space-y-2 mt-2">
                {recommendation.alternatives.map((alt: any, index: number) => (
                  <div 
                    key={index} 
                    className="border rounded-md p-2 flex justify-between items-center text-sm hover:bg-gray-50 cursor-pointer"
                    onClick={() => onParkingSelect(alt.parking)}
                  >
                    <div>
                      <p className="font-medium">{alt.parking.name}</p>
                      <div className="flex items-center text-gray-600 gap-2 mt-1">
                        <span className="flex items-center">
                          <Clock className="h-3 w-3 mr-1" />
                          {alt.travelTime} мин
                        </span>
                        <span className="flex items-center">
                          <Car className="h-3 w-3 mr-1" />
                          {alt.availableSpots} мест
                        </span>
                        {alt.parking.subway && (
                          <Badge variant="outline" className="text-xs py-0">
                            M {alt.parking.subway}
                          </Badge>
                        )}
                      </div>
                    </div>
                    <MapPin className="h-4 w-4 text-blue-500" />
                  </div>
                ))}
              </div>
            )}
          </div>
        )}
      </CardContent>
    </Card>
  );
} 