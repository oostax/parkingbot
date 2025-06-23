'use client';

import { useState, useEffect } from 'react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { useTelegramLocation } from '@/hooks/use-telegram-location';
import { getParkingRecommendations } from '@/lib/recommendation-service';
import { ParkingInfo } from '@/types/parking';
import { Clock, Car, MapPin, AlertTriangle, ThumbsUp, Map, Calendar, Navigation } from 'lucide-react';
import { Badge } from "@/components/ui/badge";
import { useToast } from "@/hooks/use-toast";
import { cn } from "@/lib/utils";

interface ParkingRecommendationProps {
  parking: ParkingInfo;
  allParkings: ParkingInfo[];
  onParkingSelect: (parking: ParkingInfo | null) => void;
}

export default function ParkingRecommendation({ 
  parking,
  allParkings,
  onParkingSelect
}: ParkingRecommendationProps) {
  const [userLocation, setUserLocation] = useState<GeolocationPosition | null>(null);
  const [isLoadingLocation, setIsLoadingLocation] = useState(false);
  const [recommendation, setRecommendation] = useState<any>(null);
  const [isLoading, setIsLoading] = useState(false);
  const { toast } = useToast();
  
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

  // Проверяем, есть ли сохраненное местоположение в sessionStorage
  useEffect(() => {
    const savedLocation = sessionStorage.getItem('userLocation');
    if (savedLocation) {
      try {
        const parsedLocation = JSON.parse(savedLocation);
        // Создаем объект, имитирующий GeolocationPosition
        setUserLocation({
          coords: {
            latitude: parsedLocation.latitude,
            longitude: parsedLocation.longitude,
            accuracy: parsedLocation.accuracy || 0,
            altitude: null,
            altitudeAccuracy: null,
            heading: null,
            speed: null
          },
          timestamp: parsedLocation.timestamp || Date.now()
        } as GeolocationPosition);
      } catch (e) {
        console.error('Ошибка при парсинге сохраненного местоположения:', e);
      }
    }
  }, []);

  // Автоматически запрашиваем рекомендацию при первой загрузке с местоположением
  useEffect(() => {
    if (userLocation && !recommendation && !isLoading) {
      getRecommendation(userLocation);
    }
  }, [userLocation, recommendation, isLoading]);

  const getUserLocation = () => {
    setIsLoadingLocation(true);
    
    if (navigator.geolocation) {
      navigator.geolocation.getCurrentPosition(
        (position) => {
          setUserLocation(position);
          // Сохраняем местоположение в sessionStorage
          sessionStorage.setItem('userLocation', JSON.stringify({
            latitude: position.coords.latitude,
            longitude: position.coords.longitude,
            accuracy: position.coords.accuracy,
            timestamp: position.timestamp
          }));
          setIsLoadingLocation(false);
          getRecommendation(position);
        },
        (error) => {
          console.error("Ошибка получения местоположения:", error);
          setIsLoadingLocation(false);
          toast({
            title: "Ошибка геолокации",
            description: "Не удалось получить ваше местоположение. Пожалуйста, проверьте настройки браузера.",
            variant: "destructive",
          });
        },
        { enableHighAccuracy: true, timeout: 10000, maximumAge: 60000 }
      );
    } else {
      setIsLoadingLocation(false);
      toast({
        title: "Геолокация не поддерживается",
        description: "Ваш браузер не поддерживает геолокацию.",
        variant: "destructive",
      });
    }
  };

  const getRecommendation = async (position: GeolocationPosition) => {
    setIsLoading(true);
    
    try {
      const response = await fetch(`/api/parkings/recommend?lat=${position.coords.latitude}&lon=${position.coords.longitude}&targetId=${parking.id}`);
      
      if (!response.ok) {
        throw new Error(`Error ${response.status}: ${response.statusText}`);
      }
      
      const data = await response.json();
      setRecommendation(data);
    } catch (error) {
      console.error("Error fetching recommendations:", error);
      toast({
        title: "Ошибка получения рекомендаций",
        description: "Не удалось получить рекомендации по парковкам.",
        variant: "destructive",
      });
    } finally {
      setIsLoading(false);
    }
  };

  // Функция для анализа парковок и выбора лучшей альтернативы
  const analyzeParking = () => {
    if (!recommendation || !recommendation.alternatives || recommendation.alternatives.length === 0) {
      return {
        hasBetterOption: false,
        message: "Нет доступных альтернатив для анализа",
        bestAlternative: null
      };
    }
    
    // Текущая парковка
    const currentParking = recommendation.alternatives.find((alt: any) => alt.id === parking.id);
    
    // Если текущей парковки нет в списке, возвращаем первую альтернативу
    if (!currentParking) {
      return {
        hasBetterOption: true,
        message: "Найдена более удобная парковка поблизости",
        bestAlternative: recommendation.alternatives[0]
      };
    }
    
    // Ищем парковки с большим количеством свободных мест
    const betterOccupancy = recommendation.alternatives.filter((alt: any) => 
      alt.id !== parking.id && 
      alt.freeSpaces > currentParking.freeSpaces &&
      alt.freeSpaces / alt.totalSpaces > 0.2 // Минимум 20% свободных мест
    );
    
    // Ищем парковки, которые ближе по времени
    const closerParking = recommendation.alternatives.filter((alt: any) => 
      alt.id !== parking.id && 
      alt.time < currentParking.time * 0.8 && // Минимум на 20% быстрее
      alt.freeSpaces > 0 // Есть свободные места
    );
    
    // Если есть парковки с лучшей заполненностью
    if (betterOccupancy.length > 0) {
      // Сортируем по количеству свободных мест (от большего к меньшему)
      betterOccupancy.sort((a: any, b: any) => b.freeSpaces - a.freeSpaces);
      
      return {
        hasBetterOption: true,
        message: `Парковка "${betterOccupancy[0].name}" имеет больше свободных мест (${betterOccupancy[0].freeSpaces})`,
        bestAlternative: betterOccupancy[0]
      };
    }
    
    // Если есть парковки, которые ближе по времени
    if (closerParking.length > 0) {
      // Сортируем по времени (от меньшего к большему)
      closerParking.sort((a: any, b: any) => a.time - b.time);
      
      return {
        hasBetterOption: true,
        message: `Парковка "${closerParking[0].name}" находится ближе (${closerParking[0].time} мин)`,
        bestAlternative: closerParking[0]
      };
    }
    
    // Если текущая парковка заполнена более чем на 90%
    if (currentParking.freeSpaces / currentParking.totalSpaces < 0.1) {
      // Ищем любую альтернативу с более свободными местами
      const anyBetter = recommendation.alternatives.find((alt: any) => 
        alt.id !== parking.id && 
        alt.freeSpaces > currentParking.freeSpaces
      );
      
      if (anyBetter) {
        return {
          hasBetterOption: true,
          message: `Текущая парковка почти заполнена. Рекомендуем "${anyBetter.name}" (${anyBetter.freeSpaces} мест)`,
          bestAlternative: anyBetter
        };
      }
    }
    
    // Если нет лучших вариантов
    return {
      hasBetterOption: false,
      message: "Текущая парковка оптимальна по расположению и заполненности",
      bestAlternative: null
    };
  };

  if (!parking) {
    return null;
  }

  if (isLoading || isLoadingLocation) {
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

  if (!userLocation) {
    return (
      <div className="flex flex-col items-center justify-center p-4 space-y-4 text-center">
        <AlertTriangle className="h-12 w-12 text-amber-500" />
        <div>
          <h3 className="font-medium text-lg">Требуется доступ к местоположению</h3>
          <p className="text-sm text-muted-foreground mt-1">
            Для персонализированных рекомендаций по парковке необходим доступ к вашему местоположению.
          </p>
        </div>
        <Button 
          onClick={getUserLocation} 
          disabled={isLoadingLocation}
          className="btn-animated"
        >
          {isLoadingLocation ? (
            <>
              <span className="animate-spin mr-2">◌</span> Получение местоположения...
            </>
          ) : (
            <>
              <MapPin className="mr-2 h-4 w-4" /> Предоставить доступ
            </>
          )}
        </Button>
      </div>
    );
  }

  if (!recommendation && !isLoading) {
    return (
      <div className="flex flex-col items-center justify-center p-4 space-y-4 text-center">
        <div>
          <h3 className="font-medium text-lg">Рекомендации по парковке</h3>
          <p className="text-sm text-muted-foreground mt-1">
            Мы можем подобрать для вас оптимальные варианты парковки поблизости с учетом вашего местоположения.
          </p>
        </div>
        <Button 
          onClick={() => getRecommendation(userLocation)} 
          disabled={isLoading}
          className="btn-animated w-full"
        >
          {isLoading ? (
            <>
              <span className="animate-spin mr-2">◌</span> Загрузка...
            </>
          ) : (
            <>
              <MapPin className="mr-2 h-4 w-4" /> Показать рекомендации
            </>
          )}
        </Button>
      </div>
    );
  }

  if (isLoading) {
    return (
      <div className="flex flex-col items-center justify-center p-4 space-y-4 text-center">
        <div className="animate-spin text-2xl">◌</div>
        <p className="text-sm text-muted-foreground">Анализируем парковки поблизости...</p>
      </div>
    );
  }

  // Показываем рекомендации в компактном виде
  return (
    <div className="p-2 space-y-4">
      <div className="text-center">
        <p className="text-sm text-muted-foreground mb-3">
          Мы можем показать вам оптимальные варианты парковки поблизости с учетом вашего местоположения.
        </p>
        
        {recommendation && recommendation.alternatives && recommendation.alternatives.length > 0 && (
          <div className="mb-4 p-3 bg-blue-50 rounded-md text-sm">
            {(() => {
              const analysis = analyzeParking();
              if (analysis.hasBetterOption) {
                return (
                  <div className="flex flex-col items-center">
                    <div className="text-blue-700 mb-2">{analysis.message}</div>
                    <Button
                      variant="outline"
                      size="sm"
                      className="w-full btn-animated"
                      onClick={() => {
                        if (analysis.bestAlternative) {
                          // Сначала закрываем карточку парковки
                          onParkingSelect(null);
                          
                          // Небольшая задержка перед построением маршрута
                          setTimeout(() => {
                            const parkingObj = allParkings.find(p => p.id === analysis.bestAlternative.id) || parking;
                            
                            // Создаем событие для построения маршрута
                            window.dispatchEvent(new CustomEvent('build-route', { 
                              detail: { 
                                parking: parkingObj,
                                userLocation: userLocation
                              } 
                            }));
                          }, 300);
                        }
                      }}
                    >
                      <MapPin className="mr-2 h-4 w-4" /> Построить маршрут
                    </Button>
                  </div>
                );
              } else {
                return <div className="text-green-700">{analysis.message}</div>;
              }
            })()}
          </div>
        )}
        
        <Button 
          onClick={() => {
            // Сначала закрываем карточку парковки
            onParkingSelect(null);
            
            // Небольшая задержка перед построением маршрута
            setTimeout(() => {
              // Если есть рекомендации, выбираем лучшую альтернативу (первую в списке)
              if (recommendation && recommendation.alternatives && recommendation.alternatives.length > 0) {
                const bestAlternative = recommendation.alternatives[0];
                const parkingObj = allParkings.find(p => p.id === bestAlternative.id) || parking;
                
                // Создаем событие для построения маршрута
                window.dispatchEvent(new CustomEvent('build-route', { 
                  detail: { 
                    parking: parkingObj,
                    userLocation: userLocation
                  } 
                }));
              } else {
                // Если рекомендаций нет, просто используем текущую парковку
                window.dispatchEvent(new CustomEvent('build-route', { 
                  detail: { 
                    parking: parking,
                    userLocation: userLocation
                  } 
                }));
              }
            }, 300);
          }} 
          className="w-full btn-animated"
        >
          <MapPin className="mr-2 h-4 w-4" /> Показать маршрут
        </Button>
      </div>
    </div>
  );
} 