"use client";

import { useState, useEffect, useRef } from "react";
import { Card, CardContent, CardFooter, CardHeader } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { ParkingInfo, ParkingStats, Forecast } from "@/types/parking";
import { useToast } from "@/hooks/use-toast";
import { Loader2, Star, MapPin, X, Activity, Heart, HeartOff, Car, Accessibility } from "lucide-react";
import { getParkingRealTimeData } from "@/lib/parking-utils";
import { useSession } from "next-auth/react";
import ParkingRecommendation from "./parking-recommendation";

interface ParkingCardProps {
  parking: ParkingInfo;
  onClose: () => void;
  onToggleFavorite: () => void;
  allParkings: ParkingInfo[];
}

export default function ParkingCard({ parking, onClose, onToggleFavorite, allParkings }: ParkingCardProps) {
  const { data: session } = useSession();
  const { toast } = useToast();
  const [isLoadingData, setIsLoadingData] = useState(true);
  const [dataAvailable, setDataAvailable] = useState(true);
  const [isStaleData, setIsStaleData] = useState(false);
  const [realTimeData, setRealTimeData] = useState<{
    totalSpaces: number;
    freeSpaces: number;
    handicappedTotal: number;
    handicappedFree: number;
  } | null>(null);
  const [stats, setStats] = useState<ParkingStats[]>([]);
  const [forecasts, setForecasts] = useState<Forecast[]>([]);
  
  // Добавляем ref для отслеживания активных запросов
  const activeRequestsRef = useRef<{[key: string]: boolean}>({});
  // Добавляем timestamp последнего успешного запроса
  const lastRequestTimeRef = useRef<{[key: string]: number}>({});
  // Минимальный интервал между запросами (5 секунд)
  const MIN_REQUEST_INTERVAL = 5000;
  
  useEffect(() => {
    let isMounted = true;
    let retryCount = 0;
    const maxRetries = 3;
    
    const fetchRealTimeData = async () => {
      // Предотвращаем параллельные запросы к одному и тому же эндпоинту
      if (activeRequestsRef.current['liveData']) {
        return;
      }
      
      // Проверяем, не слишком ли часто отправляем запросы
      const lastRequestTime = lastRequestTimeRef.current['liveData'] || 0;
      const now = Date.now();
      if (now - lastRequestTime < MIN_REQUEST_INTERVAL) {
        return;
      }
      
      setIsLoadingData(true);
      activeRequestsRef.current['liveData'] = true;
      
      try {
        // Добавляем параметр noCache и текущее время для предотвращения кэширования
        const timestamp = new Date().getTime();
        const data = await fetch(`/api/parkings/${parking.id}/live?noCache=true&t=${timestamp}`)
          .then(response => {
            if (!response.ok) {
              throw new Error(`Failed to fetch parking data: ${response.statusText}`);
            }
            return response.json();
          });
          
        if (isMounted) {
          if (data) {
            // Проверяем наличие флага dataAvailable
            if ('dataAvailable' in data && data.dataAvailable === false) {
              setDataAvailable(false);
              setRealTimeData(null);
            } else {
              setDataAvailable(true);
              // Проверяем наличие флага isStale (устаревшие данные из кэша)
              setIsStaleData('isStale' in data && data.isStale === true);
              setRealTimeData(data);
            }
          } else {
            setDataAvailable(false);
            setRealTimeData(null);
          }
          setIsLoadingData(false);
          lastRequestTimeRef.current['liveData'] = now;
        }
      } catch (error) {
        if (isMounted) {
          console.error("Error fetching parking data:", error);
          
          // Пробуем повторить запрос с увеличивающейся задержкой
          if (retryCount < maxRetries) {
            retryCount++;
            console.log(`Retrying fetch attempt ${retryCount}...`);
            // Экспоненциальная задержка: 1 секунда, затем 2, затем 4
            const delay = Math.pow(2, retryCount - 1) * 1000;
            setTimeout(fetchRealTimeData, delay);
            return;
          }
          
          setIsLoadingData(false);
          setDataAvailable(false);
          setRealTimeData(null);
        }
      } finally {
        activeRequestsRef.current['liveData'] = false;
      }
    };
    
    // Функция для загрузки прогнозов
    const fetchForecasts = async () => {
      if (activeRequestsRef.current['forecasts']) {
        return;
      }
      
      // Добавляем noCache для обхода кэширования и получения актуальных данных
      const timestamp = new Date().getTime();
      activeRequestsRef.current['forecasts'] = true;
      
      try {
        const response = await fetch(`/api/parkings/${parking.id}/forecast?noCache=true&t=${timestamp}`);
        if (response.ok) {
          const data = await response.json();
          if (data.forecasts && data.forecasts.length > 0) {
            console.log(`Получены прогнозы для парковки ${parking.id}:`, data.forecasts.length);
            setForecasts(data.forecasts);
            
            // Отладочная информация о метаданных
            if (data.meta) {
              console.log("Метаданные прогноза:", data.meta);
            }
          } else {
            console.log(`Нет прогнозов для парковки ${parking.id}`);
          }
          lastRequestTimeRef.current['forecasts'] = Date.now();
        } else {
          console.error(`Ошибка ответа API прогноза: ${response.status}`);
        }
      } catch (error) {
        console.error("Ошибка при получении прогнозов:", error);
      } finally {
        activeRequestsRef.current['forecasts'] = false;
      }
    };
    
    // Also fetch stats for historical data
    const fetchStats = async () => {
      // Предотвращаем параллельные запросы
      if (activeRequestsRef.current['stats']) {
        return;
      }
      
      // Проверяем интервал между запросами
      const lastRequestTime = lastRequestTimeRef.current['stats'] || 0;
      const now = Date.now();
      if (now - lastRequestTime < MIN_REQUEST_INTERVAL) {
        return;
      }
      
      activeRequestsRef.current['stats'] = true;
      
      try {
        // Добавляем параметр noCache и текущее время для предотвращения кэширования
        const timestamp = new Date().getTime();
        const response = await fetch(`/api/parkings/${parking.id}/stats?noCache=true&t=${timestamp}`);
        if (response.ok && isMounted) {
          const data = await response.json();
          
          // Ensure we have data for all 24 hours (0-23)
          const completeStats = Array(24).fill(null).map((_, hour) => {
            const hourData = data.stats?.find((stat: ParkingStats) => stat.hour === hour);
            return hourData || {
              hour,
              avg_free_spaces: 0,
              avg_occupancy: 0.5, // Default 50% occupancy for missing data
            };
          });
          
          setStats(completeStats);
          lastRequestTimeRef.current['stats'] = now;
        }
      } catch (error) {
        console.error("Error fetching parking stats:", error);
      } finally {
        activeRequestsRef.current['stats'] = false;
      }
    };
    
    fetchRealTimeData();
    fetchStats();
    fetchForecasts(); // Добавляем загрузку прогнозов
    
    // Обновляем прогнозы каждые 5 минут
    const forecastInterval = setInterval(fetchForecasts, 5 * 60 * 1000);
    
    return () => {
      isMounted = false;
      clearInterval(forecastInterval);
    };
  }, [parking.id, toast]);

  const openInYandexMaps = () => {
    // Use lng if available, fall back to lon, and if neither is available, use a default longitude
    const longitude = parking.lng || parking.lon || 37.6156; // Default to Moscow center longitude if nothing available
    
    window.open(
      `https://yandex.ru/maps/?rtext=~${parking.lat},${longitude}`,
      "_blank"
    );
  };
  
  const getStatusClass = () => {
    if (!realTimeData || realTimeData.totalSpaces === 0) return "bg-gray-400";
    
    const freePercentage = (realTimeData.freeSpaces / realTimeData.totalSpaces) * 100;
    
    if (freePercentage >= 30) return "bg-green-500"; // Plenty of spaces
    if (freePercentage >= 10) return "bg-amber-500"; // Limited spaces
    return "bg-red-500"; // Nearly full
  };

  const getAvailabilityColor = () => {
    if (!realTimeData || realTimeData.totalSpaces === 0) return { bg: "bg-gray-100", text: "text-gray-500" };
    
    const freePercentage = (realTimeData.freeSpaces / realTimeData.totalSpaces) * 100;
    
    if (freePercentage >= 30) return { bg: "bg-green-50", text: "text-green-600" };
    if (freePercentage >= 10) return { bg: "bg-amber-50", text: "text-amber-600" };
    return { bg: "bg-pink-50", text: "text-red-500" };
  };

  // Функция для форматирования часа (0 -> 00:00, 13 -> 13:00)
  const formatHour = (hour: number) => {
    return `${hour.toString().padStart(2, '0')}:00`;
  };

  // Функция для определения текущего часа в Москве (UTC+3)
  const getCurrentMoscowHour = () => {
    const now = new Date();
    const moscowTime = new Date(now.getTime() + 3 * 60 * 60 * 1000);
    return moscowTime.getUTCHours();
  };

  // Функция для определения, является ли час текущим
  const isCurrentHour = (timestamp: string) => {
    const currentHour = getCurrentMoscowHour();
    const forecastHour = new Date(timestamp).getHours();
    return currentHour === forecastHour;
  };

  const renderForecastChart = () => {
    if (forecasts.length === 0) {
      return (
        <div className="text-center py-4 text-sm text-gray-500">
          Данные о прогнозе загруженности загружаются...
        </div>
      );
    }

    // Получаем текущий час в Москве для выделения текущего часа
    const currentMoscowHour = getCurrentMoscowHour();
    
    // Отладочная информация
    console.log("Текущий час в Москве:", currentMoscowHour);
    
    // Сортируем прогнозы по часам, начиная с текущего часа
    const sortedForecasts = [...forecasts].sort((a, b) => {
      const hourA = new Date(a.timestamp).getHours();
      const hourB = new Date(b.timestamp).getHours();
      
      // Вычисляем "расстояние" от текущего часа (0-23 часа)
      const distA = (hourA - currentMoscowHour + 24) % 24;
      const distB = (hourB - currentMoscowHour + 24) % 24;
      
      return distA - distB;
    });
    
    // Берем только ближайшие 12 часов для отображения
    const visibleForecasts = sortedForecasts.slice(0, 12);
    
    return (
      <div className="relative py-4">
        <div className="text-sm font-medium mb-2">Прогноз загруженности по часам</div>
        <div className="text-xs text-muted-foreground mb-1">← прокрутите для просмотра всех часов →</div>
        
        <div className="overflow-x-auto pb-6">
          <div className="flex space-x-2 min-w-max">
            {visibleForecasts.map((forecast, index) => {
              const date = new Date(forecast.timestamp);
              const hour = date.getHours();
              const occupancy = forecast.expected_occupancy;
              const freeSpaces = forecast.expected_free_spaces;
              const isCurrentHourBar = hour === currentMoscowHour;
              
              // Определяем цвет на основе заполненности
              const getBarColor = () => {
                if (occupancy < 0.6) return "bg-green-500"; // Свободно
                if (occupancy < 0.8) return "bg-amber-500"; // Средне
                return "bg-red-500"; // Занято
              };
              
              const barHeight = `${Math.max(5, Math.round(occupancy * 100))}%`;
              
              return (
                <div key={index} className="relative flex flex-col items-center" style={{ minWidth: "40px" }}>
                  <div className="text-xs mb-1 font-medium">{freeSpaces}</div>
                  <div className="relative h-20 w-8 bg-gray-100 rounded-sm">
                    <div 
                      className={`absolute bottom-0 w-full rounded-sm ${getBarColor()} ${isCurrentHourBar ? 'ring-2 ring-blue-500' : ''}`} 
                      style={{ height: barHeight }}
                    ></div>
                  </div>
                  {/* Метка часа */}
                  <div className={`text-[9px] ${isCurrentHourBar ? 'font-bold text-blue-600' : 'text-gray-600'} absolute -bottom-5 whitespace-nowrap`}>
                    {formatHour(hour)}
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      </div>
    );
  };

  return (
    <Card className="w-full shadow-lg relative">
      {parking.isFavorite && (
        <div className="absolute top-2 right-2 z-10 bg-yellow-50 p-1.5 rounded-full shadow-sm">
          <Star className="h-4 w-4 fill-yellow-400 text-yellow-400" />
        </div>
      )}
      <CardHeader className="flex flex-row items-start justify-between space-y-0 pb-3">
        <div className="flex-1">
          <div className="flex items-center">
            <h3 className="font-bold text-lg">{parking.name}</h3>
          </div>
          <p className="text-sm text-muted-foreground">{parking.street} {parking.house}</p>
          {parking.subway && (
            <div className="text-xs mt-1 inline-block px-2 py-1 bg-blue-100 rounded-full">
              Метро {parking.subway}
            </div>
          )}
        </div>
        <Button variant="ghost" size="sm" onClick={onClose} className="-mt-2 -mr-2">
          <X className="h-4 w-4" />
        </Button>
      </CardHeader>
      
      <CardContent className="pb-2">
        <Tabs defaultValue="status">
          <TabsList className="w-full grid grid-cols-3">
            <TabsTrigger value="status">Статус</TabsTrigger>
            <TabsTrigger value="forecast">Прогноз</TabsTrigger>
            <TabsTrigger value="recommendation">Рекомендация</TabsTrigger>
          </TabsList>
          
          <TabsContent value="status" className="space-y-2 pt-2">
            {isLoadingData ? (
              <div className="h-32 flex flex-col items-center justify-center text-center">
                <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
                <p className="text-sm text-muted-foreground mt-2">Загрузка данных...</p>
              </div>
            ) : realTimeData && dataAvailable ? (
              <>
                {isStaleData && (
                  <div className="mb-2 text-xs text-amber-600 bg-amber-50 p-1 rounded text-center">
                    Данные могут быть устаревшими. <button 
                      className="underline hover:text-amber-700"
                      onClick={() => {
                        // Предотвращаем повторные запросы
                        if (activeRequestsRef.current['liveData']) {
                          return;
                        }
                        
                        // Проверяем, не слишком ли часто отправляем запросы
                        const lastRequestTime = lastRequestTimeRef.current['liveData'] || 0;
                        const now = Date.now();
                        if (now - lastRequestTime < MIN_REQUEST_INTERVAL) {
                          toast({
                            title: "Подождите",
                            description: "Данные можно обновлять не чаще раза в 5 секунд",
                            variant: "default",
                          });
                          return;
                        }
                        
                        setIsLoadingData(true);
                        setIsStaleData(false);
                        activeRequestsRef.current['liveData'] = true;
                        
                        setTimeout(() => {
                          getParkingRealTimeData(parking.id)
                            .then(data => {
                              if (data) {
                                if ('dataAvailable' in data && data.dataAvailable === false) {
                                  setDataAvailable(false);
                                  setRealTimeData(null);
                                } else {
                                  setRealTimeData(data);
                                  setDataAvailable(true);
                                  setIsStaleData('isStale' in data && data.isStale === true);
                                }
                              } else {
                                setDataAvailable(false);
                                setRealTimeData(null);
                              }
                              lastRequestTimeRef.current['liveData'] = now;
                            })
                            .catch(() => {
                              setDataAvailable(false);
                              setRealTimeData(null);
                            })
                            .finally(() => {
                              setIsLoadingData(false);
                              activeRequestsRef.current['liveData'] = false;
                            });
                        }, 300);
                      }}
                    >
                      Обновить
                    </button>
                  </div>
                )}
                <div className="flex gap-2 py-2">
                  <div className={`flex-1 p-3 rounded-md ${getAvailabilityColor().bg} flex flex-col items-center`}>
                    <div className="flex items-center justify-center gap-2">
                      <span className={getAvailabilityColor().text}>
                        <Car size={16} />
                      </span>
                      <p className={`text-sm font-medium ${getAvailabilityColor().text}`}>Свободно мест</p>
                    </div>
                    <p className={`text-xl font-bold ${getAvailabilityColor().text} mt-1 text-center`}>
                      {realTimeData.freeSpaces} / {realTimeData.totalSpaces}
                    </p>
                  </div>
                  
                  {realTimeData.handicappedTotal > 0 && (
                    <div className="flex-1 p-3 rounded-md bg-gray-100 flex flex-col items-center">
                      <div className="flex items-center justify-center gap-2">
                        <span className="text-gray-600">
                          <Accessibility size={16} />
                        </span>
                        <p className="text-sm font-medium text-gray-600">Для людей с ограниченными возможностями</p>
                      </div>
                      <p className="text-xl font-bold text-gray-700 mt-1 text-center">
                        {realTimeData.handicappedFree} / {realTimeData.handicappedTotal}
                      </p>
                    </div>
                  )}
                </div>
                
                {/* Occupancy progress bar */}
                {realTimeData.totalSpaces > 0 && (
                  <div className="mt-2">
                    <div className="w-full bg-gray-200 rounded-full h-2.5">
                      <div 
                        className={`${getStatusClass()} h-2.5 rounded-full`} 
                        style={{ width: `${(realTimeData.freeSpaces / realTimeData.totalSpaces) * 100}%` }}
                      ></div>
                    </div>
                  </div>
                )}
              </>
            ) : (
              <div className="h-32 flex items-center justify-center text-center">
                <div className="text-center">
                  <p className="text-sm text-muted-foreground mb-2">
                    Данные о загруженности недоступны
                  </p>
                  <Button 
                    variant="outline" 
                    size="sm" 
                    onClick={() => {
                      // Предотвращаем повторные запросы
                      if (activeRequestsRef.current['liveData']) {
                        return;
                      }
                      
                      // Проверяем, не слишком ли часто отправляем запросы
                      const lastRequestTime = lastRequestTimeRef.current['liveData'] || 0;
                      const now = Date.now();
                      if (now - lastRequestTime < MIN_REQUEST_INTERVAL) {
                        toast({
                          title: "Подождите",
                          description: "Данные можно обновлять не чаще раза в 5 секунд",
                          variant: "default",
                        });
                        return;
                      }
                      
                      setIsLoadingData(true);
                      activeRequestsRef.current['liveData'] = true;
                      
                      setTimeout(() => {
                        getParkingRealTimeData(parking.id)
                          .then(data => {
                            if (data) {
                              setRealTimeData(data);
                              setDataAvailable(!('dataAvailable' in data && data.dataAvailable === false));
                            } else {
                              setDataAvailable(false);
                            }
                            lastRequestTimeRef.current['liveData'] = now;
                          })
                          .catch(() => setDataAvailable(false))
                          .finally(() => {
                            setIsLoadingData(false);
                            activeRequestsRef.current['liveData'] = false;
                          });
                      }, 300);
                    }}
                  >
                    <Loader2 className="h-3 w-3 mr-1" /> Обновить
                  </Button>
                </div>
              </div>
            )}
          </TabsContent>
          
          <TabsContent value="forecast" className="pt-2">
            {isLoadingData ? (
              <div className="h-32 flex flex-col items-center justify-center text-center">
                <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
                <p className="text-sm text-muted-foreground mt-2">Загрузка данных...</p>
              </div>
            ) : forecasts && forecasts.length > 0 ? (
              renderForecastChart()
            ) : (
              <div className="h-32 flex flex-col items-center justify-center text-center">
                <Activity className="h-8 w-8 text-muted-foreground" />
                <p className="text-sm text-muted-foreground mt-2">
                  Данные о прогнозе недоступны
                </p>
                <Button 
                  variant="outline" 
                  size="sm"
                  className="mt-2" 
                  onClick={() => {
                    // Предотвращаем повторные запросы
                    if (activeRequestsRef.current['forecasts']) {
                      return;
                    }
                    
                    // Проверяем интервал между запросами
                    const lastRequestTime = lastRequestTimeRef.current['forecasts'] || 0;
                    const now = Date.now();
                    if (now - lastRequestTime < MIN_REQUEST_INTERVAL) {
                      toast({
                        title: "Подождите",
                        description: "Данные можно обновлять не чаще раза в 5 секунд",
                        variant: "default",
                      });
                      return;
                    }
                    
                    setIsLoadingData(true);
                    activeRequestsRef.current['forecasts'] = true;
                    
                    setTimeout(() => {
                      // Прямой запрос для отладки
                      fetch(`/api/parkings/${parking.id}/forecast?noCache=true&t=${Date.now()}`)
                        .then(response => {
                          console.log("Forecast API status:", response.status);
                          if (!response.ok) {
                            throw new Error(`Failed to fetch parking forecasts: ${response.statusText}`);
                          }
                          return response.json();
                        })
                        .then(data => {
                          console.log("Raw forecast data:", data);
                          if (data.forecasts && data.forecasts.length > 0) {
                            console.log(`Setting ${data.forecasts.length} forecasts`);
                            setForecasts(data.forecasts);
                          } else {
                            console.warn("No forecasts in response:", data);
                          }
                          lastRequestTimeRef.current['forecasts'] = now;
                        })
                        .catch(error => {
                          console.error("Error fetching parking forecasts:", error);
                        })
                        .finally(() => {
                          setIsLoadingData(false);
                          activeRequestsRef.current['forecasts'] = false;
                        });
                    }, 300);
                  }}
                >
                  <Loader2 className="h-3 w-3 mr-1" /> Обновить
                </Button>
              </div>
            )}
          </TabsContent>

          <TabsContent value="recommendation" className="pt-2">
            <ParkingRecommendation
              parking={parking}
              allParkings={allParkings}
              onParkingSelect={(selectedParking) => {
                onClose();
                // Вызов обработчика выбора парковки в родительском компоненте
                window.dispatchEvent(new CustomEvent('select-parking', { 
                  detail: { parking: selectedParking } 
                }));
              }}
            />
          </TabsContent>
        </Tabs>
      </CardContent>
      
      <CardFooter className="flex gap-2 pt-2">
        {session ? (
          <Button 
            variant="outline"
            className="flex-1 text-xs md:text-sm min-w-0"
            onClick={onToggleFavorite}
          >
            {parking.isFavorite ? (
              <>
                <HeartOff className="mr-1 h-4 w-4 shrink-0" />
                <span className="truncate">Удалить из избранного</span>
              </>
            ) : (
              <>
                <Heart className="mr-1 h-4 w-4 shrink-0" />
                <span className="truncate">В избранное</span>
              </>
            )}
          </Button>
        ) : (
          <Button 
            variant="outline"
            className="flex-1 text-xs md:text-sm min-w-0"
            onClick={() => toast({
              title: "Требуется авторизация",
              description: "Войдите через Telegram, чтобы добавить парковку в избранное",
              variant: "default",
            })}
          >
            <Heart className="mr-1 h-4 w-4 shrink-0" />
            <span className="truncate">В избранное</span>
          </Button>
        )}
        <Button onClick={openInYandexMaps} className="w-[110px] whitespace-nowrap shrink-0">
          <MapPin className="mr-2 h-4 w-4" /> Маршрут
        </Button>
      </CardFooter>
    </Card>
  );
}