"use client";

import { useState, useEffect } from 'react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardFooter, CardHeader, CardTitle } from '@/components/ui/card';
import { Loader2, AlertCircle, CheckCircle2, Car, MapPin, Navigation2 } from 'lucide-react';
import { ParkingInfo, Forecast } from '@/types/parking';
import { getUserLocation } from '@/lib/telegram-location-utils';
import { generateRecommendation, ParkingRecommendation } from '@/lib/recommendation-service';
import { useToast } from '@/hooks/use-toast';
import { Badge } from '@/components/ui/badge';
import { Separator } from '@/components/ui/separator';

interface ParkingRecommendationProps {
  parking: ParkingInfo;
  allParkings: ParkingInfo[];
  forecasts?: Forecast[];
  onSelectAlternative: (parking: ParkingInfo) => void;
}

export default function ParkingRecommendationComponent({
  parking,
  allParkings,
  forecasts,
  onSelectAlternative
}: ParkingRecommendationProps) {
  const [loading, setLoading] = useState(true);
  const [recommendation, setRecommendation] = useState<ParkingRecommendation | null>(null);
  const [locationError, setLocationError] = useState<string | null>(null);
  const { toast } = useToast();

  // Получение местоположения и генерация рекомендации
  const generateRecommendationForParking = async () => {
    setLoading(true);
    setLocationError(null);

    try {
      // Получение местоположения пользователя
      const userLocation = await getUserLocation();
      
      if (!userLocation) {
        setLocationError('Невозможно получить ваше местоположение. Разрешите доступ к геопозиции в настройках.');
        setLoading(false);
        return;
      }

      // Генерация рекомендации
      const rec = await generateRecommendation(parking, userLocation, allParkings, forecasts);
      setRecommendation(rec);
    } catch (error) {
      console.error('Ошибка при получении рекомендации:', error);
      setLocationError('Произошла ошибка при формировании рекомендации.');
      toast({
        title: 'Ошибка',
        description: 'Не удалось получить рекомендацию для парковки',
        variant: 'destructive',
      });
    } finally {
      setLoading(false);
    }
  };

  // При первой загрузке компонента
  useEffect(() => {
    generateRecommendationForParking();
  }, [parking.id]);

  // Функция для построения маршрута к парковке
  const openRouteToParking = (selectedParking: ParkingInfo) => {
    const longitude = selectedParking.lng || selectedParking.lon || 37.6156; 
    window.open(
      `https://yandex.ru/maps/?rtext=~${selectedParking.lat},${longitude}`,
      "_blank"
    );
  };

  // Функция для отображения иконки и цвета в зависимости от типа рекомендации
  const getRecommendationIcon = () => {
    if (!recommendation) return <AlertCircle className="h-6 w-6 text-gray-500" />;

    switch (recommendation.recommendationType) {
      case 'good':
        return <CheckCircle2 className="h-6 w-6 text-green-500" />;
      case 'alternative':
        return <Car className="h-6 w-6 text-amber-500" />;
      case 'negative':
        return <AlertCircle className="h-6 w-6 text-red-500" />;
      default:
        return <AlertCircle className="h-6 w-6 text-gray-500" />;
    }
  };

  // Отображение цвета фона в зависимости от типа рекомендации
  const getRecommendationColor = () => {
    if (!recommendation) return 'bg-gray-50';

    switch (recommendation.recommendationType) {
      case 'good':
        return 'bg-green-50';
      case 'alternative':
        return 'bg-amber-50';
      case 'negative':
        return 'bg-red-50';
      default:
        return 'bg-gray-50';
    }
  };

  // Если загружается
  if (loading) {
    return (
      <Card>
        <CardContent className="pt-6 flex flex-col items-center justify-center space-y-4">
          <Loader2 className="h-8 w-8 animate-spin text-blue-500" />
          <p className="text-sm text-muted-foreground">Формируем рекомендацию на основе вашего местоположения...</p>
        </CardContent>
      </Card>
    );
  }

  // Если есть ошибка местоположения
  if (locationError) {
    return (
      <Card>
        <CardContent className="pt-6">
          <div className="flex flex-col items-center text-center space-y-4 py-4">
            <AlertCircle className="h-8 w-8 text-red-500" />
            <div>
              <h3 className="font-semibold">Не удалось получить местоположение</h3>
              <p className="text-sm text-muted-foreground mt-1">{locationError}</p>
            </div>
            <Button onClick={generateRecommendationForParking}>
              Попробовать снова
            </Button>
          </div>
        </CardContent>
      </Card>
    );
  }

  // Если нет рекомендации
  if (!recommendation) {
    return (
      <Card>
        <CardContent className="pt-6">
          <div className="flex flex-col items-center text-center space-y-4 py-4">
            <AlertCircle className="h-8 w-8 text-amber-500" />
            <div>
              <h3 className="font-semibold">Не удалось сформировать рекомендацию</h3>
              <p className="text-sm text-muted-foreground mt-1">Пожалуйста, попробуйте обновить данные</p>
            </div>
            <Button onClick={generateRecommendationForParking}>
              Обновить
            </Button>
          </div>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card className={getRecommendationColor()}>
      <CardHeader className="pb-2">
        <CardTitle className="text-lg flex items-center gap-2">
          {getRecommendationIcon()}
          Рекомендация
        </CardTitle>
      </CardHeader>
      <CardContent className="pb-4 space-y-4">
        <div className="space-y-2">
          <p className="text-sm">
            {recommendation.message}
          </p>
          
          <div className="flex flex-wrap gap-2 mt-3">
            <Badge variant="outline" className="flex items-center gap-1 px-2 py-1">
              <Car className="h-3 w-3" /> 
              Свободно мест: {recommendation.estimatedFreeSpacesOnArrival}
            </Badge>
            
            <Badge variant="outline" className="flex items-center gap-1 px-2 py-1">
              <MapPin className="h-3 w-3" /> 
              Время в пути: {recommendation.estimatedDriveTimeMinutes} мин
            </Badge>
          </div>
        </div>

        {/* Альтернативные парковки */}
        {recommendation.recommendationType === 'alternative' && 
         recommendation.alternatives && 
         recommendation.alternatives.length > 0 && (
          <div className="mt-4 space-y-3">
            <Separator className="my-2" />
            <h4 className="text-sm font-medium">Альтернативные парковки поблизости:</h4>
            
            <div className="space-y-2">
              {recommendation.alternatives.map((alt) => (
                <div key={alt.id} className="bg-white rounded-lg p-3 shadow-sm border border-gray-100">
                  <div className="flex justify-between items-start">
                    <div>
                      <h5 className="font-medium text-sm">{alt.name}</h5>
                      <p className="text-xs text-muted-foreground">{alt.street} {alt.house}</p>
                      
                      <div className="mt-1">
                        <Badge variant="secondary" className="text-xs">
                          Свободно: {alt.freeSpaces}/{alt.totalSpaces}
                        </Badge>
                        
                        {alt.subway && (
                          <Badge variant="outline" className="ml-1 text-xs">
                            М {alt.subway}
                          </Badge>
                        )}
                      </div>
                    </div>
                    
                    <div className="flex gap-1">
                      <Button 
                        size="sm" 
                        variant="outline"
                        onClick={() => onSelectAlternative(alt)}
                        title="Подробнее о парковке"
                      >
                        Выбрать
                      </Button>
                      
                      <Button 
                        size="sm"
                        onClick={() => openRouteToParking(alt)}
                        title="Построить маршрут" 
                      >
                        <Navigation2 className="h-4 w-4" />
                      </Button>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}
      </CardContent>
      <CardFooter>
        <div className="flex w-full gap-2">
          <Button 
            variant="outline" 
            onClick={generateRecommendationForParking}
            className="flex-1"
          >
            Обновить
          </Button>
          
          <Button 
            onClick={() => openRouteToParking(parking)} 
            className="flex-1"
          >
            <Navigation2 className="mr-2 h-4 w-4" /> Маршрут
          </Button>
        </div>
      </CardFooter>
    </Card>
  );
} 