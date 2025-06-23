import { useState, useEffect, useRef } from "react";
import { Card, CardContent, CardFooter, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { ParkingInfo, ParkingStats, Forecast } from "@/types/parking";
import { useToast } from "@/hooks/use-toast";
import { Loader2, Star, MapPin, X, Activity, Heart, Car, Accessibility, CreditCard } from "lucide-react";
import { getParkingRealTimeData } from "@/lib/parking-utils";
import { useSession } from "next-auth/react";
import ParkingRecommendation from "./parking-recommendation";
import ParkingPayment from "./parking-payment";

// Добавим интерфейс для рекомендаций
interface ParkingRecommendationData {
  parking: ParkingInfo;
  recommendation: 'recommended' | 'alternative' | 'not_recommended';
  reason: string;
  travelTime?: number;
  availableSpots?: number;
  alternatives?: Array<{
    id: string;
    name: string;
    travelTime?: number;
    availableSpots?: number;
  }>;
}

interface InterceptingParkingCardProps {
  parking: ParkingInfo;
  onClose: () => void;
  onToggleFavorite: () => void;
  allParkings: ParkingInfo[];
}

// Функция для получения текстового описания загруженности
const getOccupancyText = (freeSpaces: number, totalSpaces: number): string => {
  const occupancyPercentage = (totalSpaces - freeSpaces) / totalSpaces * 100;
  
  if (occupancyPercentage < 50) {
    return "Свободно";
  } else if (occupancyPercentage < 80) {
    return "Средняя загруженность";
  } else if (occupancyPercentage < 95) {
    return "Высокая загруженность";
  } else {
    return "Заполнено";
  }
};

export default function InterceptingParkingCard({ parking, onClose, onToggleFavorite, allParkings }: InterceptingParkingCardProps) {
  const { data: session } = useSession();
  const { toast } = useToast();
  const [isExpanded, setIsExpanded] = useState<boolean>(false);
  const [realTimeData, setRealTimeData] = useState<{
    totalSpaces: number;
    freeSpaces: number;
    handicappedTotal: number;
    handicappedFree: number;
  } | null>(null);
  const [dataAvailable, setDataAvailable] = useState<boolean>(true);
  const [isStaleData, setIsStaleData] = useState<boolean>(false);
  const [isLoadingData, setIsLoadingData] = useState<boolean>(true);
  const [isFavoriteLoading, setIsFavoriteLoading] = useState<boolean>(false);
  const [activeTab, setActiveTab] = useState<"info" | "stats" | "recommendation">("info");
  const [stats, setStats] = useState<ParkingStats[]>([]);
  const [forecasts, setForecasts] = useState<Forecast[]>([]);
  const [recommendation, setRecommendation] = useState<ParkingRecommendationData | null>(null);
  const [showPayment, setShowPayment] = useState<boolean>(false);

  // Refs для отслеживания состояния запросов
  const activeRequestsRef = useRef<Record<string, boolean>>({});
  const lastRequestTimeRef = useRef<Record<string, number>>({});
  // Минимальный интервал между запросами (5 секунд)
  const MIN_REQUEST_INTERVAL = 5000;
  
  // Для предотвращения множественных вызовов
  const [isRouteBuilding, setIsRouteBuilding] = useState<boolean>(false);
  
  // Немедленно загружаем данные при монтировании компонента
  useEffect(() => {
    console.log(`Loading initial data for parking ${parking.id}...`);
    
    // Проверяем, есть ли уже активный запрос для этой парковки
    if (activeRequestsRef.current[parking.id]) {
      console.log(`Skipping request - already active request for parking ${parking.id}`);
      return;
    }
    
    // Проверяем, не слишком ли часто делаем запросы
    const now = Date.now();
    const lastRequestTime = lastRequestTimeRef.current[parking.id] || 0;
    if (now - lastRequestTime < MIN_REQUEST_INTERVAL) {
      console.log(`Skipping request - too soon since last request for parking ${parking.id}`);
      return;
    }
    
    // Устанавливаем флаг активного запроса
    activeRequestsRef.current[parking.id] = true;
    // Обновляем время последнего запроса
    lastRequestTimeRef.current[parking.id] = now;
    
    const loadInitialData = async () => {
      try {
        // Если у парковки уже есть данные о свободных местах, используем их сразу
        if (parking.freeSpaces !== undefined && parking.totalSpaces !== undefined && 
            parking.totalSpaces > 0) {
          console.log(`Using existing parking data: ${parking.freeSpaces}/${parking.totalSpaces}`);
          setRealTimeData({
            totalSpaces: parking.totalSpaces,
            freeSpaces: parking.freeSpaces,
            handicappedTotal: parking.handicappedTotal || 0,
            handicappedFree: parking.handicappedFree || 0
          });
          setDataAvailable(true);
          setIsLoadingData(false);
          
          // Даже если у нас есть данные, делаем запрос для обновления в фоновом режиме
          // но с небольшой задержкой, чтобы не блокировать интерфейс
          setTimeout(() => fetchLiveData(true), 1000);
          return;
        }
        
        // Если нет данных, делаем запрос к API
        await fetchLiveData();
      } catch (error) {
        console.error("Error in initial data load:", error);
        setDataAvailable(false);
        setIsLoadingData(false);
        
        // Fallback: try using getParkingRealTimeData helper after a short delay
        setTimeout(() => {
          console.log("Trying fallback data loading method...");
          getParkingRealTimeData(parking.id)
            .then(data => {
              if (data) {
                // Проверяем полученные данные на нулевые значения
                if (data.totalSpaces === 0 && data.freeSpaces === 0) {
                  // Если нулевые значения, пробуем еще раз с другим методом
                  console.log("Fallback returned zero values, trying direct API call...");
                  retryLoadData(true); // true = force direct API call
                } else {
                  setRealTimeData(data);
                  setDataAvailable(!('dataAvailable' in data && data.dataAvailable === false));
                  console.log("Fallback data loaded successfully");
                }
              } else {
                // Если не получили данные, пробуем прямой запрос API
                retryLoadData(true);
              }
            })
            .catch(e => {
              console.error("Fallback data loading failed:", e);
              retryLoadData(true);
            })
            .finally(() => {
              // Снимаем флаг активного запроса
              activeRequestsRef.current[parking.id] = false;
            });
        }, 1500);
      }
    };
    
    // Функция для загрузки данных в реальном времени
    const fetchLiveData = async (isBackgroundUpdate = false) => {
      try {
        if (!isBackgroundUpdate) setIsLoadingData(true);
        
        // Используем параметр force=true для принудительного обновления кэша
        const timestamp = new Date().getTime();
        const randomParam = Math.random().toString(36).substring(7);
        const forceParam = isBackgroundUpdate ? '' : '&force=true';
        const url = `/api/parkings/${parking.id}/live?noCache=true&t=${timestamp}&r=${randomParam}${forceParam}`;
        
        console.log(`Fetching API: ${url}`);
        const response = await fetch(url);
        console.log(`API response status: ${response.status}`);
        
        if (!response.ok) {
          throw new Error(`Failed to fetch parking data: ${response.statusText}`);
        }
        
        const data = await response.json();
        console.log("API response data:", data);
        
        // Проверяем данные на валидность
        if (data) {
          if ('dataAvailable' in data && data.dataAvailable === false) {
            console.log("Data marked as unavailable");
            setDataAvailable(false);
            setRealTimeData(null);
          } else if (data.totalSpaces === 0 && data.freeSpaces === 0 && !data.isLoading) {
            // Если получены нулевые значения и это не промежуточный ответ, пробуем повторный запрос
            console.log("Received zero values, retrying with delay...");
            setTimeout(() => retryLoadData(), 2000);
          } else if (data.isLoading) {
            // Если данные еще загружаются на сервере, ждем и повторяем запрос
            console.log("Server still loading data, will retry...");
            setTimeout(() => retryLoadData(), 3000);
          } else {
            console.log("Data available, updating state");
            setDataAvailable(true);
            setIsStaleData('isStale' in data && data.isStale === true);
            setRealTimeData(data);
            // Снимаем флаг активного запроса
            activeRequestsRef.current[parking.id] = false;
          }
        } else {
          console.log("No data received from API");
          setDataAvailable(false);
          setRealTimeData(null);
          // Снимаем флаг активного запроса
          activeRequestsRef.current[parking.id] = false;
        }
      } catch (error) {
        console.error("Error fetching live data:", error);
        if (!isBackgroundUpdate) {
          setDataAvailable(false);
          setRealTimeData(null);
        }
        // Снимаем флаг активного запроса
        activeRequestsRef.current[parking.id] = false;
      } finally {
        if (!isBackgroundUpdate) setIsLoadingData(false);
      }
    };
    
    // Функция для повторного запроса данных
    const retryLoadData = async (forceDirectApi = false) => {
      // Проверяем, есть ли уже активный запрос для этой парковки
      if (activeRequestsRef.current[parking.id] && !forceDirectApi) {
        console.log(`Skipping retry - already active request for parking ${parking.id}`);
        return;
      }
      
      // Устанавливаем флаг активного запроса
      activeRequestsRef.current[parking.id] = true;
      // Обновляем время последнего запроса
      lastRequestTimeRef.current[parking.id] = Date.now();
      
      try {
        setIsLoadingData(true);
        
        // Используем прямой запрос API с дополнительными параметрами для обхода кэша
        const timestamp = new Date().getTime();
        const randomParam = Math.random().toString(36).substring(7);
        console.log(`Retry attempt for parking ${parking.id} with force=true`);
        const response = await fetch(
          `/api/parkings/${parking.id}/live?noCache=true&t=${timestamp}&r=${randomParam}&force=true`
        );
        
        if (!response.ok) {
          throw new Error(`Failed to fetch parking data on retry: ${response.statusText}`);
        }
        
        const data = await response.json();
        console.log("Retry API response data:", data);
        
        if (data && !(data.totalSpaces === 0 && data.freeSpaces === 0)) {
          setDataAvailable(true);
          setRealTimeData(data);
          console.log("Retry successful, got valid data");
        } else {
          console.log("Retry failed to get valid data");
          
          // Если у нас есть данные из parking объекта, используем их как запасной вариант
          if (parking.totalSpaces && parking.totalSpaces > 0) {
            console.log("Using parking object data as fallback");
            setRealTimeData({
              totalSpaces: parking.totalSpaces || 0,
              freeSpaces: parking.freeSpaces || 0,
              handicappedTotal: parking.handicappedTotal || 0,
              handicappedFree: parking.handicappedFree || 0
            });
            setDataAvailable(true);
          } else if (!forceDirectApi) {
            // Если и в объекте парковки нет данных, пробуем еще один последний запрос с другими параметрами
            console.log("No data in parking object, trying one last request with different parameters");
            try {
              const lastAttemptResponse = await fetch(
                `/api/parkings/${parking.id}/live?noCache=true&t=${timestamp + 1000}&r=${Math.random().toString(36).substring(7)}&force=true&bypass=true`
              );
              
              if (lastAttemptResponse.ok) {
                const lastAttemptData = await lastAttemptResponse.json();
                console.log("Last attempt response data:", lastAttemptData);
                
                if (lastAttemptData && (lastAttemptData.totalSpaces > 0 || lastAttemptData.freeSpaces > 0)) {
                  setDataAvailable(true);
                  setRealTimeData(lastAttemptData);
                  console.log("Last attempt successful");
                } else {
                  setDataAvailable(false);
                }
              } else {
                setDataAvailable(false);
              }
            } catch (lastError) {
              console.error("Last attempt failed:", lastError);
              setDataAvailable(false);
            }
          }
        }
      } catch (error) {
        console.error("Error in retry data load:", error);
        setDataAvailable(false);
      } finally {
        setIsLoadingData(false);
        // Снимаем флаг активного запроса
        activeRequestsRef.current[parking.id] = false;
      }
    };

    // Вызываем загрузку данных немедленно
    loadInitialData();
    
    // При размонтировании компонента сбрасываем флаг активного запроса
    return () => {
      activeRequestsRef.current[parking.id] = false;
    };
  }, [parking.id, parking.freeSpaces, parking.totalSpaces, parking.handicappedTotal, parking.handicappedFree]);

  // Функция для получения цвета индикатора доступности
  const getAvailabilityColor = () => {
    if (!realTimeData || !dataAvailable) return { bg: 'bg-gray-100', text: 'text-gray-500' };
    
    const { freeSpaces, totalSpaces } = realTimeData;
    const occupancyPercentage = ((totalSpaces - freeSpaces) / totalSpaces) * 100;
    
    if (occupancyPercentage < 50) {
      return { bg: 'bg-green-100', text: 'text-green-700' };
    } else if (occupancyPercentage < 80) {
      return { bg: 'bg-yellow-100', text: 'text-yellow-700' };
    } else if (occupancyPercentage < 95) {
      return { bg: 'bg-orange-100', text: 'text-orange-700' };
    } else {
      return { bg: 'bg-red-100', text: 'text-red-700' };
    }
  };

  // Функция для построения маршрута
  const buildRoute = () => {
    // Проверяем, не строится ли уже маршрут
    if (isRouteBuilding) {
      console.log("Route building already in progress, ignoring request");
      return;
    }
    
    setIsRouteBuilding(true);
    
    // Закрываем карточку
    onClose();
    
    // Отправляем событие для построения маршрута
    const event = new CustomEvent('build-route', { 
      detail: { parking }
    });
    window.dispatchEvent(event);
    
    // Сбрасываем флаг через небольшую задержку
    setTimeout(() => {
      setIsRouteBuilding(false);
    }, 1000);
  };

  // Функция для безопасного закрытия карточки
  const handleClose = () => {
    // Отменяем все активные запросы для этой парковки
    activeRequestsRef.current[parking.id] = false;
    
    // Отправляем событие для предотвращения автоцентрирования
    window.dispatchEvent(new Event('prevent-auto-center'));
    
    // Закрываем карточку с небольшой задержкой, чтобы успели отработать другие обработчики
    setTimeout(() => {
      onClose();
    }, 50);
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

  // Функция для рендеринга прогноза загруженности
  const renderForecastChart = () => {
    // Реализация графика прогноза
    return (
      <div className="h-32 flex flex-col items-center justify-center text-center">
        <Activity className="h-8 w-8 text-muted-foreground" />
        <p className="text-sm text-muted-foreground mt-2">
          Прогноз загруженности недоступен
        </p>
      </div>
    );
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
            <div className="flex gap-2 py-2">
              {realTimeData && dataAvailable ? (
                <>
                  <div className={`flex-1 p-3 rounded-md ${getAvailabilityColor().bg} flex flex-col items-center animate-fadeInUp`}>
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
                    <div className="flex-1 p-3 rounded-md bg-gray-100 flex flex-col items-center animate-fadeInUp">
                      <div className="flex items-center justify-center gap-2">
                        <span className="text-gray-600">
                          <Accessibility size={16} />
                        </span>
                        <p className="text-sm font-medium text-gray-600">Для инвалидов</p>
                      </div>
                      <p className="text-xl font-bold text-gray-700 mt-1 text-center">
                        {realTimeData.handicappedFree} / {realTimeData.handicappedTotal}
                      </p>
                    </div>
                  )}
                </>
              ) : (
                <div className="flex-1 p-3 rounded-md bg-gray-100 flex flex-col items-center">
                  <div className="flex items-center justify-center gap-2">
                    <Car size={16} className="text-gray-500" />
                    <p className="text-sm font-medium text-gray-500">Свободно мест</p>
                  </div>
                  <p className="text-xl font-bold text-gray-500 mt-1 text-center">
                    Нет данных
                  </p>
                </div>
              )}
            </div>
          </div>
          
          {/* Расширенная информация видна только при isExpanded=true */}
          {isExpanded && (
            <div className="animate-fadeInUp">
              <Tabs defaultValue="forecast">
                <TabsList className="w-full grid grid-cols-2">
                  <TabsTrigger value="forecast">Прогноз</TabsTrigger>
                  <TabsTrigger value="recommendation">Рекомендация</TabsTrigger>
                </TabsList>
                
                <TabsContent value="forecast" className="pt-2">
                  {forecasts && forecasts.length > 0 ? (
                    renderForecastChart()
                  ) : isLoadingData ? (
                    <div className="h-32 flex flex-col items-center justify-center text-center">
                      <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
                      <p className="text-sm text-muted-foreground mt-2">Загрузка данных...</p>
                    </div>
                  ) : (
                    <div className="h-32 flex flex-col items-center justify-center text-center">
                      <Activity className="h-8 w-8 text-muted-foreground" />
                      <p className="text-sm text-muted-foreground mt-2">
                        Для данной парковки нет прогноза загруженности
                      </p>
                      <Button 
                        variant="outline" 
                        size="sm"
                        className="mt-2" 
                        onClick={() => {
                          toast({
                            title: "Загрузка данных",
                            description: "Запрос данных прогноза...",
                            variant: "default",
                          });
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
                      // Сначала скрываем маршрут
                      window.dispatchEvent(new CustomEvent('hide-route-info'));
                      // Затем закрываем карточку
                      onClose();
                      
                      // Если выбрана новая парковка, отправляем событие
                      if (selectedParking) {
                        // Вызов обработчика выбора парковки в родительском компоненте
                        window.dispatchEvent(new CustomEvent('select-parking', { 
                          detail: { parking: selectedParking } 
                        }));
                      }
                    }}
                  />
                </TabsContent>
              </Tabs>
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