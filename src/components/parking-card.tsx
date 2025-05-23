"use client";

import { useState, useEffect } from "react";
import { Card, CardContent, CardFooter, CardHeader } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { ParkingInfo, ParkingStats } from "@/types/parking";
import { useToast } from "@/hooks/use-toast";
import { Loader2, Star, MapPin, X, Activity, Heart, HeartOff, Car, Accessibility } from "lucide-react";
import { getParkingRealTimeData } from "@/lib/parking-utils";
import { useSession } from "next-auth/react";

interface ParkingCardProps {
  parking: ParkingInfo;
  onClose: () => void;
  onToggleFavorite: () => void;
}

export default function ParkingCard({ parking, onClose, onToggleFavorite }: ParkingCardProps) {
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
  
  useEffect(() => {
    let isMounted = true;
    let retryCount = 0;
    const maxRetries = 3;
    
    const fetchRealTimeData = async () => {
      setIsLoadingData(true);
      try {
        const data = await getParkingRealTimeData(parking.id);
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
      }
    };
    
    // Also fetch stats for historical data
    const fetchStats = async () => {
      try {
        const response = await fetch(`/api/parkings/${parking.id}/stats`);
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
        }
      } catch (error) {
        console.error("Error fetching parking stats:", error);
      }
    };
    
    fetchRealTimeData();
    fetchStats();
    
    return () => {
      isMounted = false;
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

  return (
    <Card className="w-full shadow-lg">
      <CardHeader className="flex flex-row items-start justify-between space-y-0 pb-3">
        <div>
          <div className="flex items-center">
            <h3 className="font-bold text-lg">{parking.name}</h3>
            {parking.isFavorite && <Star className="h-4 w-4 ml-1 fill-yellow-400 text-yellow-400" />}
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
          <TabsList className="w-full grid grid-cols-2">
            <TabsTrigger value="status">Статус</TabsTrigger>
            <TabsTrigger value="forecast">Прогноз</TabsTrigger>
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
                        setIsLoadingData(true);
                        setIsStaleData(false);
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
                            })
                            .catch(() => {
                              setDataAvailable(false);
                              setRealTimeData(null);
                            })
                            .finally(() => setIsLoadingData(false));
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
                      setIsLoadingData(true);
                      setTimeout(() => {
                        getParkingRealTimeData(parking.id)
                          .then(data => {
                            if (data) {
                              setRealTimeData(data);
                              setDataAvailable(!('dataAvailable' in data && data.dataAvailable === false));
                            } else {
                              setDataAvailable(false);
                            }
                          })
                          .catch(() => setDataAvailable(false))
                          .finally(() => setIsLoadingData(false));
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
            ) : stats && stats.length > 0 ? (
              <div className="h-44 pb-2 overflow-x-hidden">
                <div className="mb-2 text-sm text-center text-muted-foreground">Прогноз загруженности по часам</div>
                <div className="relative h-32 w-full">
                  {/* Horizontal grid lines */}
                  <div className="absolute w-full h-full flex flex-col justify-between">
                    <div className="border-t border-dashed border-gray-200 w-full"></div>
                    <div className="border-t border-dashed border-gray-200 w-full"></div>
                    <div className="border-t border-dashed border-gray-200 w-full"></div>
                  </div>
                  
                  {/* Bar chart */}
                  <div className="absolute w-full h-full flex items-end">
                    {stats.map((hourData, index) => {
                      const occupancyPercent = hourData.avg_occupancy * 100;
                      const freePercent = 100 - occupancyPercent;
                      
                      // Calculate bar height (0-100%)
                      const barHeight = `${freePercent}%`;
                      
                      // Determine color based on free percentage
                      let barColor = "bg-red-500";
                      if (freePercent >= 30) barColor = "bg-green-500";
                      else if (freePercent >= 10) barColor = "bg-amber-500";
                      
                      // Current hour gets highlighted
                      const currentHour = new Date().getHours();
                      const isCurrentHour = index === currentHour;
                      
                      return (
                        <div 
                          key={index}
                          className="flex-1 flex flex-col justify-end mx-0.5 min-w-0"
                        >
                          <div 
                            className={`${barColor} ${isCurrentHour ? 'opacity-100' : 'opacity-70'} w-full`}
                            style={{ height: barHeight }}
                          ></div>
                          {isCurrentHour && (
                            <div className="absolute -bottom-5 w-full">
                              <div className="h-1 w-4 bg-blue-500 mx-auto"></div>
                            </div>
                          )}
                          {(index % 6 === 0) && (
                            <div className="absolute -bottom-5 text-[8px] sm:text-xs text-gray-500">
                              {index}:00
                            </div>
                          )}
                        </div>
                      );
                    })}
                  </div>
                </div>
              </div>
            ) : (
              <div className="h-32 flex flex-col items-center justify-center text-center">
                <Activity className="h-8 w-8 text-muted-foreground" />
                <p className="text-sm text-muted-foreground mt-2">
                  Данные о прогнозе недоступны
                </p>
              </div>
            )}
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