"use client";

import { useState, useEffect, useRef, useContext, createContext, useMemo } from "react";
import { ParkingInfo, Polygon } from "@/types/parking";
import { MapContainer, TileLayer, Marker, useMap, Polygon as LeafletPolygon, Tooltip, ZoomControl, Polyline, Circle } from "react-leaflet";
import "leaflet/dist/leaflet.css";
import L from "leaflet";
// Импортируем только типы из leaflet-routing-machine
import "leaflet-routing-machine";
import { X, MapPin, Clock, Navigation } from "lucide-react";
import { Button } from "@/components/ui/button";
import { ShowRouteProvider } from "@/contexts/ShowRouteContext";
import ParkingTypeToggle from "./ParkingTypeToggle";

// Расширяем типы Leaflet для поддержки routing-machine
declare global {
  namespace L {
    namespace Routing {
      function control(options: any): any;
    }
  }
}

// Создаем контекст для передачи флага showRoute
const ShowRouteContext = createContext<{ showRoute: boolean; preventAutoCenter: boolean; parkingType: "all" | "intercepting" } | null>(null);

// Компонент для отображения местоположения пользователя
function UserLocationMarker({ position }: { position: [number, number] | null }) {
  const map = useMap();
  const [zoom, setZoom] = useState(map.getZoom());
  
  // Отслеживаем изменение масштаба карты
  useEffect(() => {
    const handleZoomEnd = () => {
      setZoom(map.getZoom());
    };
    
    map.on('zoomend', handleZoomEnd);
    
    return () => {
      map.off('zoomend', handleZoomEnd);
    };
  }, [map]);
  
  // Рассчитываем размер точки в зависимости от масштаба
  const getPointSize = () => {
    // Увеличиваем базовый размер при масштабе 13
    const baseSize = 150;
    // Коэффициент изменения размера
    const factor = 2.0;
    
    // Если масштаб меньше 13, увеличиваем размер
    if (zoom < 13) {
      return baseSize * Math.pow(factor, 13 - zoom);
    }
    // Если масштаб больше 13, уменьшаем размер
    else if (zoom > 13) {
      return baseSize / Math.pow(factor, zoom - 13);
    }
    
    return baseSize;
  };
  
  if (!position) return null;
  
  const pointSize = getPointSize();
  
  return (
    <>
      {/* Внешний круг */}
      <Circle 
        center={position}
        pathOptions={{ 
          color: '#3B82F6',
          fillColor: '#3B82F6',
          fillOpacity: 0.3,
          weight: 2
        }}
        radius={pointSize}
      />
      
      {/* Центральная точка */}
      <Circle 
        center={position}
        pathOptions={{ 
          color: '#3B82F6',
          fillColor: '#ffffff',
          fillOpacity: 1,
          weight: 3
        }}
        radius={pointSize / 3}
      />
    </>
  );
}

// Компонент для анимации маршрута
function RouteAnimator({ from, to, onRouteFound }: { 
  from: [number, number] | null; 
  to: [number, number] | null;
  onRouteFound?: (route: [number, number][], info?: { distance: number, duration: number }) => void;
}) {
  const map = useMap();
  const [routePoints, setRoutePoints] = useState<[number, number][]>([]);
  const [animationProgress, setAnimationProgress] = useState(0);
  
  // Эффект для создания и анимации маршрута
  useEffect(() => {
    // Если нет координат, очищаем маршрут
    if (!from || !to) {
      setRoutePoints([]);
      return;
    }
    
    // Создаем прямую линию между точками (упрощенный маршрут)
    const createSimpleRoute = () => {
      // Создаем прямую линию между точками
      const directRoute = [from, to];
      
      // Рассчитываем расстояние между точками
      const point1 = L.latLng(from[0], from[1]);
      const point2 = L.latLng(to[0], to[1]);
      const distance = point1.distanceTo(point2) / 1000; // в км
      const duration = Math.round(distance * 12); // примерно 12 минут на км пешком
      
      // Устанавливаем маршрут
      setRoutePoints(directRoute);
      
      // Вызываем колбэк с информацией о маршруте
      if (onRouteFound) {
        onRouteFound(directRoute, {
          distance: distance,
          duration: duration
        });
      }
      
      // Начинаем анимацию
      setAnimationProgress(0);
      const animationDuration = 1000; // 1 секунда
      const steps = 50;
      let step = 0;
      
      const interval = setInterval(() => {
        step++;
        setAnimationProgress(step / steps);
        if (step >= steps) {
          clearInterval(interval);
        }
      }, animationDuration / steps);
      
      // Устанавливаем зум, чтобы видеть весь маршрут
      try {
        const bounds = L.latLngBounds([from, to]);
        map.fitBounds(bounds, {
          padding: [50, 50],
          maxZoom: 15,
          animate: true,
          duration: 1
        });
      } catch (error) {
        console.error("Ошибка при установке зума:", error);
      }
    };
    
    // Пытаемся получить маршрут через API (если не получится, используем прямую линию)
    const fetchRoute = async () => {
      try {
        // Формируем URL для запроса маршрута через OSRM API
        const url = `https://router.project-osrm.org/route/v1/driving/${from[1]},${from[0]};${to[1]},${to[0]}?overview=full&geometries=geojson`;
        
        const response = await fetch(url);
        if (!response.ok) {
          throw new Error("Не удалось получить маршрут");
        }
        
        const data = await response.json();
        
        if (data.routes && data.routes.length > 0 && data.routes[0].geometry) {
          // Получаем координаты маршрута
          const coordinates = data.routes[0].geometry.coordinates;
          
          // Преобразуем формат координат [lng, lat] -> [lat, lng]
          const routeCoords = coordinates.map((coord: [number, number]) => 
            [coord[1], coord[0]] as [number, number]
          );
          
          // Рассчитываем расстояние и время в пути
          const distance = data.routes[0].distance / 1000; // в км
          const duration = Math.round(data.routes[0].duration / 60); // в минутах
          
          // Устанавливаем маршрут
          setRoutePoints(routeCoords);
          
          // Вызываем колбэк с информацией о маршруте
          if (onRouteFound) {
            onRouteFound(routeCoords, {
              distance: distance,
              duration: duration
            });
          }
          
          // Начинаем анимацию
          setAnimationProgress(0);
          const animationDuration = 1500; // 1.5 секунды
          const steps = 75;
          let step = 0;
          
          const interval = setInterval(() => {
            step++;
            setAnimationProgress(step / steps);
            if (step >= steps) {
              clearInterval(interval);
            }
          }, animationDuration / steps);
          
          // Устанавливаем зум, чтобы видеть весь маршрут
          try {
            const bounds = L.latLngBounds(routeCoords);
            map.fitBounds(bounds, {
              padding: [50, 50],
              maxZoom: 15,
              animate: true,
              duration: 1
            });
          } catch (error) {
            console.error("Ошибка при установке зума:", error);
          }
        } else {
          throw new Error("Некорректные данные маршрута");
        }
      } catch (error) {
        console.error("Ошибка при получении маршрута:", error);
        // Если не удалось получить маршрут через API, используем прямую линию
        createSimpleRoute();
      }
    };
    
    // Запускаем получение маршрута
    fetchRoute();
    
    // Очистка при размонтировании компонента не требуется,
    // так как мы не создаем никаких контролов Leaflet
  }, [from, to, map, onRouteFound]);
  
  // Вычисляем точки для отображения с учетом прогресса анимации
  const animatedPoints = routePoints.length > 0 
    ? routePoints.slice(0, Math.ceil(routePoints.length * animationProgress))
    : [];
  
  if (animatedPoints.length < 2) return null;
  
  return (
    <>
      {/* Основная линия маршрута */}
      <Polyline 
        positions={animatedPoints}
        pathOptions={{
          color: '#3B82F6',
          weight: 5,
          opacity: 0.8,
          lineCap: 'round',
          lineJoin: 'round'
        }}
      />
      
      {/* Анимированная точка, движущаяся по маршруту */}
      {animationProgress > 0 && animationProgress < 1 && animatedPoints.length > 0 && (
        <Circle
          center={animatedPoints[animatedPoints.length - 1]}
          radius={8}
          pathOptions={{
            color: '#3B82F6',
            fillColor: '#ffffff',
            fillOpacity: 1,
            weight: 3
          }}
        />
      )}
    </>
  );
}

// Component to handle map updates when selected parking changes
function MapUpdater({ selectedParking, userLocation }: { selectedParking: ParkingInfo | null, userLocation: [number, number] | null }) {
  const map = useMap();
  
  // Получаем доступ к состоянию showRoute и parkingType из основного компонента
  const routeContext = useContext(ShowRouteContext);
  const showRoute = routeContext?.showRoute || false;
  const preventAutoCenter = routeContext?.preventAutoCenter || false;
  const parkingType = routeContext?.parkingType || "all";
  
  // Добавляем ref для отслеживания последнего изменения типа парковок
  const lastTypeChangeRef = useRef<number>(0);
  
  // Добавляем ref для отслеживания времени последнего перемещения карты пользователем
  const lastUserMapMoveRef = useRef<number>(0);
  
  // Добавляем ref для отслеживания предыдущего типа парковок
  const prevParkingTypeRef = useRef<string>(parkingType);
  
  // Отслеживаем изменение типа парковок
  useEffect(() => {
    if (parkingType !== prevParkingTypeRef.current) {
      console.log(`Тип парковок изменился с ${prevParkingTypeRef.current} на ${parkingType}`);
      // Обновляем время последнего изменения типа парковок
      lastTypeChangeRef.current = Date.now();
      // Обновляем предыдущий тип парковок
      prevParkingTypeRef.current = parkingType;
    }
  }, [parkingType]);
  
  // Сохраняем время последнего перемещения карты
  useEffect(() => {
    const handleMoveEnd = () => {
      // Обновляем время только если это было пользовательское перемещение
      // Используем другой подход, так как _animatingZoom не доступен напрямую
      lastUserMapMoveRef.current = Date.now();
    };
    
    // Отдельный обработчик для программного перемещения
    const handleZoomStart = () => {
      // Не обновляем время при программном зуме
    };
    
    map.on('moveend', handleMoveEnd);
    map.on('zoomstart', handleZoomStart);
    
    return () => {
      map.off('moveend', handleMoveEnd);
      map.off('zoomstart', handleZoomStart);
    };
  }, [map]);
  
  useEffect(() => {
    if (selectedParking) {
      // Offset the center point to position the marker in the upper part of the screen
      // This ensures the card appears directly below the marker in the center of the screen
      const offset = window.innerHeight < 800 ? 0.00035 : 0.00045;
      
      // Преобразуем координаты в числа
      const lat = Number(selectedParking.lat);
      const lng = Number(selectedParking.lng ?? selectedParking.lon ?? 0);
      
      // Проверяем, что координаты валидные числа
      if (!isNaN(lat) && !isNaN(lng)) {
        map.flyTo(
          [lat - offset, lng], // Position marker ~35-40% from top
          16, // Reduced zoom level for a less close view
          {
            duration: 1, // Quick animation
            easeLinearity: 0.5
          }
        );
      } else {
        console.error("Некорректные координаты парковки в MapUpdater:", { lat, lng, selectedParking });
      }
    }
  }, [selectedParking, map]);
  
  // Полностью отключаем автоматическое центрирование карты на местоположении пользователя
  // Этот эффект теперь просто отслеживает изменения, но не выполняет центрирование
  useEffect(() => {
    // Проверяем, прошло ли достаточно времени с момента последнего изменения типа парковок
    const timeSinceLastTypeChange = Date.now() - lastTypeChangeRef.current;
    const timeSinceLastUserMapMove = Date.now() - lastUserMapMoveRef.current;
    const MIN_TIME_BETWEEN_CENTERING = 10000; // 10 секунд
    const MIN_TIME_AFTER_USER_MOVE = 15000; // 15 секунд после пользовательского перемещения
    
    // Логируем изменения, но не центрируем карту
    const userRecentlyMovedMap = timeSinceLastUserMapMove < MIN_TIME_AFTER_USER_MOVE;
    
    if (process.env.NODE_ENV === 'development') {
      console.log('Автоцентрирование отключено:', {
        selectedParking: !!selectedParking,
        userLocation: !!userLocation,
        showRoute,
        preventAutoCenter,
        timeSinceLastTypeChange,
        MIN_TIME_BETWEEN_CENTERING,
        timeSinceLastUserMapMove,
        MIN_TIME_AFTER_USER_MOVE,
        userRecentlyMovedMap
      });
    }
    
    // Не выполняем центрирование карты вообще
  }, [userLocation, selectedParking, map, showRoute, preventAutoCenter]);
  
  // Обработчик события prevent-auto-center
  useEffect(() => {
    const handlePreventAutoCenter = () => {
      // Обновляем время последнего изменения типа парковок
      lastTypeChangeRef.current = Date.now();
      console.log('Получено событие prevent-auto-center, обновлено время:', lastTypeChangeRef.current);
    };
    
    // Добавляем слушатель события
    window.addEventListener('prevent-auto-center', handlePreventAutoCenter);
    
    // Удаляем слушатель при размонтировании
    return () => {
      window.removeEventListener('prevent-auto-center', handlePreventAutoCenter);
    };
  }, []);
  
  return null;
}

// Компонент для отображения информации о маршруте
function RouteInfo({ 
  route, 
  distance, 
  duration, 
  selectedParking,
  userLocation,
  onClose
}: { 
  route: [number, number][] | null;
  distance: number | null;
  duration: number | null;
  selectedParking: ParkingInfo | null;
  userLocation: [number, number] | null;
  onClose: () => void;
}) {
  // Если нет данных, не отображаем компонент
  if (!route || !distance || !duration || !userLocation) return null;
  
  // Состояние для анимации появления
  const [isVisible, setIsVisible] = useState(false);
  
  // Эффект для анимации появления
  useEffect(() => {
    // Задержка для анимации появления после построения маршрута
    const timeout = setTimeout(() => {
      setIsVisible(true);
    }, 500);
    
    return () => clearTimeout(timeout);
  }, []);
  
  // Функция для открытия маршрута в Яндекс Картах
  const openInYandexMaps = () => {
    try {
      // Получаем координаты конечной точки маршрута
      const endPoint = route[route.length - 1];
      
      // Формируем URL для Яндекс Карт
      const yandexMapsUrl = `https://yandex.ru/maps/route/?rtext=${userLocation[0]},${userLocation[1]}~${endPoint[0]},${endPoint[1]}&rtt=pd`;
      
      // Открываем в новой вкладке
      window.open(yandexMapsUrl, '_blank');
      
      // Закрываем информацию о маршруте
      onClose();
    } catch (error) {
      console.error("Ошибка при открытии Яндекс Карт:", error);
    }
  };
  
  // Функция для безопасного закрытия информации о маршруте
  const handleClose = () => {
    try {
      // Вызываем событие hide-route-info вместо прямого вызова onClose
      window.dispatchEvent(new Event('hide-route-info'));
    } catch (error) {
      console.error("Ошибка при закрытии информации о маршруте:", error);
    }
  };
  
  return (
    <>
      {/* Бейджи с информацией о маршруте */}
      <div className={`absolute top-4 left-1/2 transform -translate-x-1/2 z-[1000] flex gap-2 transition-all duration-500 ${isVisible ? 'opacity-100 translate-y-0' : 'opacity-0 -translate-y-4'}`}>
        <div className="bg-white rounded-full shadow-lg px-4 py-2 flex items-center">
          <MapPin className="h-4 w-4 text-blue-500 mr-2" />
          <span className="text-sm font-medium">{distance.toFixed(1)} км</span>
        </div>
        
        <div className="bg-white rounded-full shadow-lg px-4 py-2 flex items-center">
          <Clock className="h-4 w-4 text-green-500 mr-2" />
          <span className="text-sm font-medium">{duration} мин</span>
        </div>
        
        <button 
          onClick={handleClose}
          className="bg-white rounded-full shadow-lg w-8 h-8 flex items-center justify-center text-gray-500 hover:text-gray-700 transition-colors"
        >
          <X size={16} />
        </button>
      </div>
      
      {/* Кнопка "Поехали!" внизу по центру */}
      <div className={`absolute bottom-8 left-1/2 transform -translate-x-1/2 z-[1000] transition-all duration-500 ${isVisible ? 'opacity-100 translate-y-0' : 'opacity-0 translate-y-4'}`}>
        <Button 
          onClick={openInYandexMaps}
          className="bg-green-500 hover:bg-green-600 text-white px-6 py-3 rounded-full shadow-lg flex items-center justify-center transition-all duration-300 transform hover:scale-105"
        >
          <Navigation className="mr-2 h-5 w-5" /> Поехали!
        </Button>
      </div>
    </>
  );
}

interface MapComponentProps {
  parkings: ParkingInfo[];
  selectedParking: ParkingInfo | null;
  onParkingSelect: (parking: ParkingInfo | null) => void;
}

// Интерфейс для данных о загруженности парковок
interface OccupancyData {
  [parkingId: string]: { occupancy: number; freeSpaces: number };
}

// Интерфейс для кластера парковок
interface ParkingCluster {
  center: [number, number];
  count: number;
  parkings: ParkingInfo[];
}

// Функция для кластеризации парковок
function clusterParkings(parkings: ParkingInfo[], zoom: number): (ParkingInfo | ParkingCluster)[] {
  // Если масштаб очень большой, возвращаем все парковки без кластеризации
  if (zoom >= 16) {
    return parkings;
  }
  
  // Определяем радиус кластеризации в зависимости от масштаба
  // Чем меньше масштаб, тем больше радиус кластеризации
  const clusterRadius = zoom < 8 ? 0.15 : 
                       zoom < 10 ? 0.1 : 
                       zoom < 12 ? 0.06 : 
                       zoom < 14 ? 0.03 : 0.01;
  
  // Максимальное количество маркеров при отдалении
  const maxMarkers = zoom < 8 ? 150 : 
                    zoom < 10 ? 300 : 
                    zoom < 12 ? 500 : 
                    zoom < 14 ? 800 : 1000;
  
  // Создаем массив для хранения кластеров
  const clusters: ParkingCluster[] = [];
  
  // Перебираем все парковки
  for (const parking of parkings) {
    const lon = parking.lng ?? parking.lon ?? 0;
    const lat = parking.lat;
    
    // Пропускаем парковки без координат
    if (lon === 0 || lat === 0) continue;
    
    // Проверяем, можно ли добавить парковку в существующий кластер
    let addedToCluster = false;
    
    for (const cluster of clusters) {
      const [clusterLat, clusterLon] = cluster.center;
      
      // Рассчитываем расстояние между парковкой и центром кластера
      const distance = Math.sqrt(
        Math.pow(lat - clusterLat, 2) + 
        Math.pow(lon - clusterLon, 2)
      );
      
      // Если расстояние меньше радиуса кластеризации, добавляем парковку в кластер
      if (distance < clusterRadius) {
        cluster.count++;
        cluster.parkings.push(parking);
        
        // Пересчитываем центр кластера как среднее значение координат всех парковок в кластере
        const newLat = (clusterLat * (cluster.count - 1) + lat) / cluster.count;
        const newLon = (clusterLon * (cluster.count - 1) + lon) / cluster.count;
        cluster.center = [newLat, newLon];
        
        addedToCluster = true;
        break;
      }
    }
    
    // Если парковка не была добавлена в существующий кластер, создаем новый
    if (!addedToCluster) {
      clusters.push({
        center: [lat, lon],
        count: 1,
        parkings: [parking]
      });
    }
  }
  
  // Выполняем несколько проходов для объединения близких кластеров
  // Это нужно для создания более крупных кластеров и предотвращения пересечений
  const maxIterations = zoom < 10 ? 8 : 5;
  
  for (let iteration = 0; iteration < maxIterations; iteration++) {
    let mergedClusters = false;
    
    // Увеличиваем радиус объединения с каждой итерацией
    const mergeRadius = clusterRadius * (1 + iteration * 0.6);
    
    // Проверяем все пары кластеров
    for (let i = 0; i < clusters.length; i++) {
      for (let j = i + 1; j < clusters.length; j++) {
        const cluster1 = clusters[i];
        const cluster2 = clusters[j];
        
        // Рассчитываем расстояние между центрами кластеров
        const distance = Math.sqrt(
          Math.pow(cluster1.center[0] - cluster2.center[0], 2) + 
          Math.pow(cluster1.center[1] - cluster2.center[1], 2)
        );
        
        // Если кластеры достаточно близко, объединяем их
        if (distance < mergeRadius) {
          // Объединяем парковки
          cluster1.parkings = [...cluster1.parkings, ...cluster2.parkings];
          
          // Обновляем количество
          cluster1.count += cluster2.count;
          
          // Пересчитываем центр
          const totalCount = cluster1.count;
          const weight1 = cluster1.count - cluster2.count;
          const weight2 = cluster2.count;
          
          cluster1.center = [
            (cluster1.center[0] * weight1 + cluster2.center[0] * weight2) / totalCount,
            (cluster1.center[1] * weight1 + cluster2.center[1] * weight2) / totalCount
          ];
          
          // Удаляем второй кластер
          clusters.splice(j, 1);
          
          // Отмечаем, что произошло объединение
          mergedClusters = true;
          
          // Прерываем внутренний цикл
          break;
        }
      }
      
      // Если произошло объединение, прерываем внешний цикл и начинаем заново
      if (mergedClusters) break;
    }
    
    // Если на этой итерации не было объединений, прекращаем
    if (!mergedClusters) break;
  }
  
  // Предотвращаем пересечение кластеров
  // Перемещаем кластеры, которые находятся слишком близко друг к другу
  const minDistance = clusterRadius * 2.5; // Увеличиваем минимальное расстояние между кластерами
  
  for (let i = 0; i < clusters.length; i++) {
    for (let j = i + 1; j < clusters.length; j++) {
      const cluster1 = clusters[i];
      const cluster2 = clusters[j];
      
      // Рассчитываем расстояние между центрами кластеров
      const dx = cluster1.center[0] - cluster2.center[0];
      const dy = cluster1.center[1] - cluster2.center[1];
      const distance = Math.sqrt(dx * dx + dy * dy);
      
      // Если кластеры слишком близко, но не достаточно для объединения
      if (distance < minDistance && distance > 0) {
        // Вычисляем вектор направления от cluster2 к cluster1
        const dirX = dx / distance;
        const dirY = dy / distance;
        
        // Вычисляем, на сколько нужно сдвинуть кластеры
        const moveDistance = (minDistance - distance) / 1.8;
        
        // Сдвигаем оба кластера в противоположных направлениях
        // Сдвигаем больше кластер с меньшим количеством парковок
        const weight1 = cluster2.count / (cluster1.count + cluster2.count);
        const weight2 = cluster1.count / (cluster1.count + cluster2.count);
        
        cluster1.center = [
          cluster1.center[0] + dirX * moveDistance * weight1,
          cluster1.center[1] + dirY * moveDistance * weight1
        ];
        
        cluster2.center = [
          cluster2.center[0] - dirX * moveDistance * weight2,
          cluster2.center[1] - dirY * moveDistance * weight2
        ];
      }
    }
  }
  
  // Определяем, нужно ли фильтровать кластеры на основе масштаба
  // При малом масштабе показываем только крупные кластеры
  let filteredClusters = clusters;
  
  if (zoom < 10) {
    // Фильтруем одиночные кластеры при малом масштабе
    filteredClusters = clusters.filter(cluster => cluster.count > 1);
  }
  
  // Если после фильтрации кластеров все еще слишком много, оставляем только самые крупные
  if (filteredClusters.length > maxMarkers) {
    // Сортируем кластеры по количеству парковок (от большего к меньшему)
    filteredClusters.sort((a, b) => b.count - a.count);
    
    // Оставляем только maxMarkers кластеров
    filteredClusters = filteredClusters.slice(0, maxMarkers);
  }
  
  // Преобразуем одиночные кластеры обратно в парковки
  const result: (ParkingInfo | ParkingCluster)[] = [];
  
  for (const cluster of filteredClusters) {
    if (cluster.count === 1) {
      // Если в кластере только одна парковка, добавляем ее напрямую
      result.push(cluster.parkings[0]);
    } else {
      // Иначе добавляем кластер
      result.push(cluster);
    }
  }
  
  return result;
}

export default function MapComponent({ parkings, selectedParking, onParkingSelect }: MapComponentProps) {
  const [isMounted, setIsMounted] = useState(false);
  const [occupancyData, setOccupancyData] = useState<OccupancyData>({});
  const [userLocation, setUserLocation] = useState<[number, number] | null>(null);
  const [showRoute, setShowRoute] = useState(false);
  const [route, setRoute] = useState<[number, number][] | null>(null);
  const [routeDistance, setRouteDistance] = useState<number | null>(null);
  const [routeDuration, setRouteDuration] = useState<number | null>(null);
  const mapRef = useRef<L.Map | null>(null);
  
  // Состояние для хранения координат парковки для маршрута
  const [routeParkingCoords, setRouteParkingCoords] = useState<[number, number] | null>(null);
  
  // Флаг для предотвращения автоматического центрирования карты
  const [preventAutoCenter, setPreventAutoCenter] = useState(false);

  // Состояние для хранения типа отображаемых парковок
  const [parkingType, setParkingType] = useState<"all" | "intercepting">("intercepting");
  
  // Состояние для хранения всех парковок
  const [allParkings, setAllParkings] = useState<ParkingInfo[]>([]);
  
  // Состояние для хранения общего количества парковок
  const [totalParkingsCount, setTotalParkingsCount] = useState<number>(0);
  
  // Отображаемые парковки в зависимости от выбранного типа
  // Для перехватывающих парковок используем только parkings (данные из parking_data.json)
  // Для всех парковок используем allParkings (данные из API)
  const displayedParkings = parkingType === "intercepting" ? parkings : allParkings;
  
  // Добавляем свойство для отслеживания типа выбранной парковки
  const isSelectedParkingIntercepting = selectedParking ? parkings.some(p => p.id === selectedParking.id) : false;

  // Функция для получения местоположения пользователя
  const getUserLocation = () => {
    if (navigator.geolocation) {
      navigator.geolocation.getCurrentPosition(
        (position) => {
          const { latitude, longitude } = position.coords;
          setUserLocation([latitude, longitude]);
        },
        (error) => {
          console.error("Ошибка получения местоположения:", error);
        },
        { enableHighAccuracy: true }
      );
    } else {
      console.error("Геолокация не поддерживается в вашем браузере");
    }
  };

  // Функция для загрузки данных о загруженности парковок
  const fetchOccupancyData = async (forceRefresh = false) => {
    try {
      // Если forceRefresh = true, добавляем параметр noCache
      const timestamp = new Date().getTime();
      const url = forceRefresh 
        ? `/api/parkings/stats?noCache=true&t=${timestamp}` 
        : '/api/parkings/stats';
      
      const response = await fetch(url);
      if (response.ok) {
        const data = await response.json();
        setOccupancyData(data.parkings || {});
      }
    } catch (error) {
      console.error("Error fetching parking occupancy data:", error);
    }
  };

  // Загружаем данные при первом рендере и получаем местоположение пользователя
  useEffect(() => {
    fetchOccupancyData();
    // Получаем местоположение пользователя, но не центрируем на нем карту
    getUserLocation();
    fetchTotalParkingsCount();
    
    // Загружаем данные о парковках только если масштаб достаточный
    if (mapRef.current && mapRef.current.getZoom() >= 14) {
      fetchAllParkings();
    }
    
    // Устанавливаем флаг для предотвращения автоматического центрирования
    setPreventAutoCenter(true);
  }, []);

  // Функция для загрузки данных о всех парковках
  const fetchAllParkings = async () => {
    try {
      console.log("Загружаем данные о всех парковках...");
      
      // Добавляем параметр для обхода кэша
      const timestamp = new Date().getTime();
      
      // Если карта уже загружена, получаем текущие границы
      let boundsParam = "";
      if (mapRef.current) {
        const bounds = mapRef.current.getBounds();
        const minLat = bounds.getSouth();
        const minLon = bounds.getWest();
        const maxLat = bounds.getNorth();
        const maxLon = bounds.getEast();
        boundsParam = `&bounds=${minLat},${minLon},${maxLat},${maxLon}`;
      }
      
      // Получаем текущий масштаб
      const zoom = mapRef.current?.getZoom() || 10;
      
      // Увеличиваем лимит, чтобы загрузить все парковки
      const limitParam = "&limit=10000"; // Увеличиваем лимит до 10000, чтобы гарантировать загрузку всех парковок
      
      // Запрашиваем общее количество парковок
      await fetchTotalParkingsCount();
      
      const url = `/api/parkings/all?noCache=true&t=${timestamp}${boundsParam}${limitParam}`;
      
      console.log(`Выполняем запрос: ${url}`);
      const response = await fetch(url);
      
      if (!response.ok) {
        const errorText = await response.text();
        console.error(`Ошибка ответа API: ${response.status} ${response.statusText}`);
        console.error(`Текст ошибки: ${errorText}`);
        throw new Error(`Ошибка при загрузке данных о всех парковках: ${response.status} ${response.statusText}`);
      }
      
      const data = await response.json();
      console.log(`Загружено ${data.parkings?.length || 0} парковок из ${data.pagination?.total || 0}`);
      
      if (data.parkings && Array.isArray(data.parkings)) {
        setAllParkings(data.parkings);
        
        // Отправляем событие с количеством перехватывающих парковок
        const interceptingCount = data.parkings.filter((p: ParkingInfo) => p.isIntercepting).length;
        console.log(`Количество перехватывающих парковок в загруженных данных: ${interceptingCount}`);
        window.dispatchEvent(new CustomEvent('update-intercepting-count', { 
          detail: { count: interceptingCount } 
        }));
      } else {
        console.error("Неверный формат данных о парковках:", data);
      }
    } catch (error) {
      console.error("Error fetching all parkings data:", error);
    }
  };

  // Обработчик переключения типа парковок
  const handleParkingTypeChange = (type: "all" | "intercepting") => {
    console.log(`Переключение на тип парковок: ${type}`);
    console.log(`Количество перехватывающих парковок: ${parkings.length}`);
    console.log(`Количество всех парковок: ${allParkings.length}`);
    
    // Устанавливаем флаг для предотвращения автоматического центрирования
    setPreventAutoCenter(true);
    
    // Сбрасываем флаг через задержку
    setTimeout(() => {
      setPreventAutoCenter(false);
    }, 10000); // Увеличиваем время до 10 секунд, чтобы точно предотвратить центрирование
    
    // Отправляем событие для обновления времени последнего изменения типа парковок
    window.dispatchEvent(new Event('prevent-auto-center'));
    
    setParkingType(type);
    
    // При переключении на перехватывающие парковки отправляем событие с их количеством
    if (type === "intercepting") {
      window.dispatchEvent(new CustomEvent('update-intercepting-count', { 
        detail: { count: parkings.length } 
      }));
    }
    
    // Закрываем карточку выбранной парковки при переключении типа
    if (selectedParking) {
      // Отправляем событие для закрытия карточки вместо прямого вызова onParkingSelect
      window.dispatchEvent(new CustomEvent('select-parking', { 
        detail: { parking: null } 
      }));
    }
    
    // Скрываем маршрут при переключении типа
    setShowRoute(false);
    setRoute(null);
    setRouteDistance(null);
    setRouteParkingCoords(null);
  };

  // Обработчик клика по парковке с обновлением данных
  const handleParkingSelect = (parking: ParkingInfo | null) => {
    // Если parking равен null, просто передаем null родительскому компоненту
    if (!parking) {
      onParkingSelect(null);
      return;
    }
    
    // Проверяем, является ли парковка перехватывающей
    const isIntercepting = parkings.some(p => p.id === parking.id);
    
    // Добавляем свойство для определения типа парковки
    const parkingWithType = {
      ...parking,
      isIntercepting
    };
    
    // Приближаем карту к выбранной парковке
    if (mapRef.current) {
      // Исправляем порядок координат - сначала широта (lat), потом долгота (lng/lon)
      // И проверяем, что координаты действительно числа
      const lat = Number(parking.lat);
      const lng = Number(parking.lng || parking.lon || 0);
      
      // Проверяем, что координаты валидные числа
      if (!isNaN(lat) && !isNaN(lng)) {
        const parkingCoords: [number, number] = [lat, lng];
        
        // Устанавливаем флаг для предотвращения автоматического центрирования
        setPreventAutoCenter(true);
        
        // Приближаем карту к парковке
        mapRef.current.flyTo(parkingCoords, 16, {
          duration: 0.8,
          easeLinearity: 0.5
        });
        
        // Сбрасываем флаг через задержку
        setTimeout(() => {
          setPreventAutoCenter(false);
        }, 10000); // 10 секунд
      } else {
        console.error("Некорректные координаты парковки:", { lat, lng, parking });
      }
    }
    
    // Вызываем внешний обработчик с дополнительной информацией
    onParkingSelect(parkingWithType);
    
    // Обновляем данные о загруженности всех парковок
    fetchOccupancyData(true);
    
    // Скрываем маршрут при выборе новой парковки
    setShowRoute(false);
  };

  // Функция для построения маршрута к выбранной парковке
  const buildRoute = () => {
    if (selectedParking && userLocation) {
      setShowRoute(true);
    } else if (!userLocation) {
      getUserLocation();
    }
  };

  // Обработчик для получения информации о маршруте
  const handleRouteFound = (route: [number, number][], info?: { distance: number, duration: number }) => {
    setRoute(route);
    if (info) {
      setRouteDistance(info.distance);
      setRouteDuration(info.duration);
    }
  };

  // Обработчик события hide-route-info
  useEffect(() => {
    const handleHideRouteInfo = () => {
      // Устанавливаем флаг для предотвращения автоматического центрирования
      setPreventAutoCenter(true);
      
      // Сбрасываем флаг через увеличенную задержку
      setTimeout(() => {
        setPreventAutoCenter(false);
      }, 10000); // 10 секунд
      
      // Отправляем событие для обновления времени последнего изменения типа парковок
      window.dispatchEvent(new Event('prevent-auto-center'));
      
      console.log('Скрытие информации о маршруте, отправлено событие prevent-auto-center');
      
      setShowRoute(false);
      setRoute(null);
      setRouteDistance(null);
      setRouteDuration(null);
      setRouteParkingCoords(null);
    };
    
    // Добавляем слушатель события
    window.addEventListener('hide-route-info', handleHideRouteInfo as EventListener);
    
    // Удаляем слушатель при размонтировании
    return () => {
      window.removeEventListener('hide-route-info', handleHideRouteInfo as EventListener);
    };
  }, []);

  // Обработчик события select-parking для корректной обработки выбора парковки
  useEffect(() => {
    const handleSelectParking = (event: CustomEvent) => {
      const { parking } = event.detail;
      
      // Если parking равен null, закрываем карточку
      if (!parking) {
        onParkingSelect(null);
        return;
      }
      
      // Иначе выбираем парковку
      onParkingSelect(parking);
    };
    
    // Добавляем слушатель события
    window.addEventListener('select-parking', handleSelectParking as EventListener);
    
    // Удаляем слушатель при размонтировании
    return () => {
      window.removeEventListener('select-parking', handleSelectParking as EventListener);
    };
  }, [onParkingSelect]);

  // Обработчик события build-route от компонента рекомендаций
  useEffect(() => {
    const handleBuildRoute = (event: CustomEvent) => {
      const { parking, userLocation: eventUserLocation } = event.detail;
      
      // Если есть местоположение пользователя из события, используем его
      if (eventUserLocation) {
        setUserLocation([eventUserLocation.coords.latitude, eventUserLocation.coords.longitude]);
      }
      
      // Сохраняем информацию о парковке для маршрута
      if (parking) {
        // Получаем координаты парковки и преобразуем их в числа
        const lat = Number(parking.lat);
        const lng = Number(parking.lng || parking.lon || 0);
        
        // Проверяем, что координаты валидные числа
        if (!isNaN(lat) && !isNaN(lng)) {
          const parkingCoords: [number, number] = [lat, lng];
          
          // Сохраняем координаты парковки для маршрута
          setRouteParkingCoords(parkingCoords);
          
          // Показываем маршрут
          setShowRoute(true);
          
          // Если есть местоположение пользователя, центрируем карту на маршруте
          if (userLocation && mapRef.current) {
            try {
              const bounds = L.latLngBounds([userLocation, parkingCoords]);
              mapRef.current.fitBounds(bounds, {
                padding: [50, 50],
                maxZoom: 15,
                animate: true
              });
            } catch (error) {
              console.error("Ошибка при центрировании карты:", error);
            }
          }
        } else {
          console.error("Некорректные координаты парковки:", { lat, lng, parking });
        }
      }
    };
    
    // Добавляем слушатель события
    window.addEventListener('build-route', handleBuildRoute as EventListener);
    
    // Удаляем слушатель при размонтировании
    return () => {
      window.removeEventListener('build-route', handleBuildRoute as EventListener);
    };
  }, [userLocation]);

  // Обработчик события prevent-auto-center в основном компоненте
  useEffect(() => {
    const handlePreventAutoCenter = () => {
      // Устанавливаем флаг для предотвращения автоматического центрирования
      setPreventAutoCenter(true);
      
      // Сбрасываем флаг через задержку
      setTimeout(() => {
        setPreventAutoCenter(false);
      }, 10000); // 10 секунд
      
      console.log('Установлен флаг preventAutoCenter в основном компоненте');
    };
    
    // Добавляем слушатель события
    window.addEventListener('prevent-auto-center', handlePreventAutoCenter);
    
    // Удаляем слушатель при размонтировании
    return () => {
      window.removeEventListener('prevent-auto-center', handlePreventAutoCenter);
    };
  }, []);

  // Скрываем маршрут при изменении выбранной парковки только если не активен флаг showRoute
  useEffect(() => {
    // Если парковка не выбрана (карточка закрыта) И не показывается маршрут,
    // тогда сбрасываем информацию о маршруте
    if (selectedParking === null && !showRoute) {
      setRoute(null);
      setRouteDistance(null);
      setRouteDuration(null);
    }
  }, [selectedParking, showRoute]);

  // Обработчик события close-parking-card для закрытия карточки парковки без сброса маршрута
  useEffect(() => {
    const handleCloseParkingCard = () => {
      // Закрываем карточку парковки, но сохраняем маршрут
      if (selectedParking) {
        // Получаем и проверяем координаты парковки
        const lat = Number(selectedParking.lat);
        const lng = Number(selectedParking.lng || selectedParking.lon || 0);
        
        // Проверяем, что координаты валидные числа
        if (!isNaN(lat) && !isNaN(lng)) {
          const parkingCoords: [number, number] = [lat, lng];
          setRouteParkingCoords(parkingCoords);
          
          // Закрываем карточку парковки
          onParkingSelect(null);
          
          // Устанавливаем флаг показа маршрута
          setShowRoute(true);
        } else {
          console.error("Некорректные координаты парковки:", { lat, lng, selectedParking });
          onParkingSelect(null);
        }
      }
    };
    
    // Добавляем слушатель события
    window.addEventListener('close-parking-card', handleCloseParkingCard as EventListener);
    
    // Удаляем слушатель при размонтировании
    return () => {
      window.removeEventListener('close-parking-card', handleCloseParkingCard as EventListener);
    };
  }, [selectedParking, onParkingSelect]);

  // Only render the map on the client side and fix Leaflet icon issue
  useEffect(() => {
    setIsMounted(true);
    
    // Fix Leaflet icons issue
    interface IconDefaultExtended extends L.Icon.Default {
      _getIconUrl?: string;
    }
    delete (L.Icon.Default.prototype as IconDefaultExtended)._getIconUrl;
    L.Icon.Default.mergeOptions({
      iconRetinaUrl: "https://unpkg.com/leaflet@1.9.4/dist/images/marker-icon-2x.png",
      iconUrl: "https://unpkg.com/leaflet@1.9.4/dist/images/marker-icon.png",
      shadowUrl: "https://unpkg.com/leaflet@1.9.4/dist/images/marker-shadow.png",
    });
  }, []);

  // Convert coordinates for Leaflet polygon
  const convertPolygonForLeaflet = (polygon: Polygon | undefined) => {
    if (!polygon || !Array.isArray(polygon)) return [];
    return polygon.map(coord => [coord[1], coord[0]] as [number, number]);
  };

  const [mapZoom, setMapZoom] = useState(10);
  
  // Обработчик изменения масштаба карты
  const handleZoomChange = (zoom: number) => {
    setMapZoom(zoom);
    
    // Если выбраны все парковки, загружаем данные при изменении масштаба
    if (parkingType === "all") {
      fetchAllParkings();
    }
  };

  // Добавляем компонент для отслеживания изменения масштаба
  function ZoomObserver() {
    const map = useMap();
    
    useEffect(() => {
      const updateZoom = () => {
        handleZoomChange(map.getZoom());
      };
      
      map.on('zoomend', updateZoom);
      
      return () => {
        map.off('zoomend', updateZoom);
      };
    }, [map]);
    
    return null;
  }

  // Обработчик изменения границ карты для подгрузки парковок
  const handleBoundsChange = () => {
    if (mapRef.current && parkingType === "all") {
      // Загружаем данные о парковках при любом масштабе
      fetchAllParkings();
    }
  };

  // Функция для загрузки общего количества парковок
  const fetchTotalParkingsCount = async () => {
    try {
      // Добавляем параметр для обхода кэша
      const timestamp = new Date().getTime();
      const response = await fetch(`/api/parkings/count?noCache=true&t=${timestamp}`);
      if (response.ok) {
        const data = await response.json();
        setTotalParkingsCount(data.total || 0);
        // Обновляем также количество перехватывающих парковок, если оно доступно
        if (data.intercepting !== undefined) {
          console.log(`Получено количество перехватывающих парковок: ${data.intercepting}`);
          // Используем событие для обновления счетчика в других компонентах
          window.dispatchEvent(new CustomEvent('update-intercepting-count', { 
            detail: { count: data.intercepting } 
          }));
        }
      }
    } catch (error) {
      console.error("Error fetching total parkings count:", error);
    }
  };

  // Добавляем компонент для отслеживания изменения границ карты
  function BoundsObserver() {
    const map = useMap();
    
    useEffect(() => {
      // Используем debounce для предотвращения слишком частых запросов
      let timeoutId: NodeJS.Timeout;
      
      const updateBounds = () => {
        clearTimeout(timeoutId);
        timeoutId = setTimeout(() => {
          handleBoundsChange();
        }, 500); // Задержка 500 мс
      };
      
      map.on('moveend', updateBounds);
      
      return () => {
        clearTimeout(timeoutId);
        map.off('moveend', updateBounds);
      };
    }, [map]);
    
    return null;
  }

  // Используем useMemo для оптимизации рендеринга маркеров
  const visibleParkings = useMemo(() => {
    // При малом масштабе (zoom < 11) показываем только часть маркеров для оптимизации
    if (mapZoom < 11) {
      // Показываем только каждую N-ю парковку при малом масштабе
      const step = mapZoom < 9 ? 50 : mapZoom < 10 ? 20 : 10;
      return displayedParkings.filter((_, index) => index % step === 0);
    }
    return displayedParkings;
  }, [displayedParkings, mapZoom]);

  // Используем useMemo для кластеризации парковок
  const clusteredParkings = useMemo(() => {
    // Если выбраны перехватывающие парковки, показываем их все без кластеризации
    if (parkingType === "intercepting") {
      return displayedParkings;
    }
    
    // Для всех парковок используем кластеризацию при любом масштабе
    return clusterParkings(displayedParkings, mapZoom);
  }, [displayedParkings, mapZoom, parkingType]);

  // Create custom marker icons
  const getMarkerIcon = (parking: ParkingInfo) => {
    const isSelected = selectedParking?.id === parking.id;
    const isFavorite = parking.isFavorite;
    
    // Определяем размер маркера в зависимости от масштаба
    const size = mapZoom < 12 ? 16 : 24;
    const innerSize = mapZoom < 12 ? 6 : 8;
    
    // Определяем цвет маркера на основе загруженности
    let color = '#3B82F6'; // Синий по умолчанию
    
    // Если есть данные о загруженности для этой парковки
    if (occupancyData[parking.id]) {
      const occupancy = occupancyData[parking.id].occupancy;
      
      // Зеленый: свободно (менее 70% занято)
      if (occupancy < 0.7) {
        color = '#22C55E'; // Зеленый
      } 
      // Желтый: средне заполнено (70-85% занято)
      else if (occupancy < 0.85) {
        color = '#F59E0B'; // Желтый
      } 
      // Красный: почти заполнено или заполнено (более 85% занято)
      else {
        color = '#EF4444'; // Красный
      }
    }
    
    // Если парковка выделена или в избранном, приоритет имеет этот статус
    if (isSelected) color = '#8B5CF6'; // Фиолетовый для выбранной
    else if (isFavorite) color = '#EC4899'; // Розовый для избранной
    
    return L.divIcon({
      className: 'custom-marker',
      html: `<div style="background-color: ${color}; width: ${size}px; height: ${size}px; border-radius: 50%; display: flex; align-items: center; justify-content: center; transform: ${isSelected ? 'scale(1.25)' : 'scale(1)'}; transition: transform 0.3s ease;">
               <div style="background-color: white; width: ${innerSize}px; height: ${innerSize}px; border-radius: 50%;"></div>
             </div>`,
      iconSize: [size, size],
      iconAnchor: [size/2, size/2],
    });
  };

  // Обработчик клика по кластеру
  const handleClusterClick = (cluster: ParkingCluster) => {
    // Если в кластере только одна парковка, выбираем ее
    if (cluster.count === 1) {
      handleParkingSelect(cluster.parkings[0]);
      return;
    }
    
    // Иначе приближаем карту к кластеру
    if (mapRef.current) {
      // Создаем границы, которые включают все парковки в кластере
      const bounds = L.latLngBounds(
        cluster.parkings.map(p => [p.lat, p.lng ?? p.lon ?? 0])
      );
      
      // Приближаем карту к этим границам
      mapRef.current.fitBounds(bounds, {
        padding: [50, 50],
        maxZoom: 15,
        animate: true
      });
    }
  };
  
  // Создаем иконку для кластера
  const getClusterIcon = (count: number) => {
    // Определяем размер иконки в зависимости от количества парковок в кластере
    const size = count < 10 ? 40 : 
                count < 50 ? 50 : 
                count < 100 ? 60 : 70;
    
    // Создаем иконку с градиентом без отображения количества парковок
    return L.divIcon({
      html: `
        <div style="
          background: linear-gradient(to bottom, #1E90FF, #87CEEB);
          width: ${size}px;
          height: ${size}px;
          border-radius: 50%;
          display: flex;
          align-items: center;
          justify-content: center;
          color: white;
          font-weight: bold;
          font-size: 18px;
          box-shadow: 0 0 0 4px rgba(30, 144, 255, 0.2);
          border: 2px solid white;
          position: relative;
          overflow: hidden;
        ">
          <div style="
            position: absolute;
            top: 0;
            left: 0;
            width: 100%;
            height: 100%;
            background: radial-gradient(circle at center, rgba(255,255,255,0.3) 0%, rgba(30,144,255,0) 70%);
          "></div>
          <div style="
            position: relative;
            text-align: center;
            text-shadow: 0 1px 2px rgba(0,0,0,0.3);
            line-height: 1;
          ">
            <div style="font-size: 22px;">P</div>
          </div>
        </div>
      `,
      className: 'custom-cluster',
      iconSize: [size, size],
      iconAnchor: [size/2, size/2]
    });
  };

  // Отрисовываем компонент карты только на клиентской стороне
  if (!isMounted) return null;

  return (
    <div className="w-full h-full absolute inset-0">
      {/* Передаем флаг showRoute через контекст */}
      <ShowRouteContext.Provider value={{ showRoute, preventAutoCenter, parkingType }}>
      <MapContainer
        center={[55.751244, 37.618423]} // Центр Москвы
        zoom={11} // Увеличиваем начальный масштаб для лучшего обзора
        style={{ width: "100%", height: "100%" }}
        className="z-10 absolute inset-0"
        zoomControl={false}
        scrollWheelZoom={true}
        attributionControl={false}
        ref={mapRef}
        preferCanvas={true} // Используем Canvas рендеринг для оптимизации
      >
          {/* Компонент для обновления карты при изменении выбранной парковки */}
          <MapUpdater selectedParking={selectedParking} userLocation={userLocation} />
          
          {/* Компонент для отслеживания изменения масштаба */}
          <ZoomObserver />
          
          {/* Компонент для отслеживания изменения границ карты */}
          <BoundsObserver />

          {/* Добавляем TileLayer (карту) */}
        <TileLayer
          url="https://{s}.basemaps.cartocdn.com/light_all/{z}/{x}/{y}{r}.png"
          attribution=""
        />
        
        <ZoomControl position="bottomright" />
          
          {/* Отображаем местоположение пользователя */}
          <UserLocationMarker position={userLocation} />
          
          {/* Отображаем маршрут, если он активен */}
          {showRoute && userLocation && routeParkingCoords && (
            <RouteAnimator 
              from={userLocation} 
              to={routeParkingCoords} 
              onRouteFound={handleRouteFound}
            />
          )}
          
          {/* Отображаем маркеры парковок с кластеризацией */}
          {clusteredParkings.map((item, index) => {
            // Проверяем, является ли элемент кластером или отдельной парковкой
            if ('count' in item) {
              // Это кластер
              const cluster = item as ParkingCluster;
              
              return (
                <Marker 
                  key={`cluster-${index}`}
                  position={cluster.center}
                  icon={getClusterIcon(cluster.count)}
                  eventHandlers={{
                    click: () => handleClusterClick(cluster),
                  }}
                >
                  <Tooltip 
                    direction="top" 
                    offset={[0, -20]} 
                    opacity={0.9} 
                    className="custom-tooltip"
                    permanent={false}
                  >
                    <div className="font-medium text-xs">Парковок: {cluster.count}</div>
                  </Tooltip>
                </Marker>
              );
            } else {
              // Это отдельная парковка
              const parking = item as ParkingInfo;
              const longitude = parking.lng ?? parking.lon ?? 0;
              
              // Пропускаем маркер, если нет координат
              if (longitude === 0 || parking.lat === 0) return null;
              
              return (
                <Marker 
                  key={`parking-${parking.id}`}
                  position={[parking.lat, longitude]}
                  icon={getMarkerIcon(parking)}
                  eventHandlers={{
                    click: () => handleParkingSelect(parking),
                  }}
                >
                  <Tooltip 
                    direction="top" 
                    offset={[0, -20]} 
                    opacity={selectedParking?.id === parking.id ? 0 : 0.9} 
                    className="custom-tooltip"
                    permanent={false}
                  >
                    <div className="font-medium text-xs">{parking.name}</div>
                  </Tooltip>
                </Marker>
              );
            }
          })}
          
          {/* Отображаем полигоны только при достаточном приближении для оптимизации */}
          {mapZoom >= 14 && displayedParkings.filter(p => p.polygon && p.polygon.length > 0).map((parking) => {
            const isSelected = selectedParking?.id === parking.id;
            const color = isSelected ? '#F5A623' : '#4A90E2';
            const fillOpacity = isSelected ? 0.5 : 0.3;
            
            return (
              <LeafletPolygon
                key={`polygon-${parking.id}`}
                positions={convertPolygonForLeaflet(parking.polygon)}
                pathOptions={{
                  color,
                  fillColor: color,
                  fillOpacity,
                  weight: 2,
                }}
                eventHandlers={{
                  click: () => handleParkingSelect(parking),
                }}
              />
            );
          })}
        </MapContainer>
      </ShowRouteContext.Provider>
      
      {/* Информация о маршруте */}
      {showRoute && route && routeDistance && routeDuration && routeParkingCoords && (
        <RouteInfo 
          route={route}
          distance={routeDistance}
          duration={routeDuration}
          selectedParking={selectedParking || displayedParkings.find(p => 
            p.lat === routeParkingCoords[0] && 
            (p.lng === routeParkingCoords[1] || p.lon === routeParkingCoords[1])
          ) || null}
          userLocation={userLocation}
          onClose={() => {
            // Вызываем событие hide-route-info вместо прямого изменения состояния
            window.dispatchEvent(new Event('hide-route-info'));
          }}
        />
      )}
      
      {/* Переключатель типов парковок */}
      <ParkingTypeToggle 
        onTypeChange={handleParkingTypeChange}
        parkings={allParkings}
        totalParkingsCount={totalParkingsCount}
        interceptingParkings={parkings}
      />
      
      {/* Кнопка построения маршрута */}
      {selectedParking && !showRoute && (
        <div className="absolute bottom-16 left-1/2 transform -translate-x-1/2 z-50">
          <button 
            onClick={buildRoute}
            className="bg-blue-600 hover:bg-blue-700 text-white px-4 py-2 rounded-full shadow-lg flex items-center justify-center transition-all duration-300 transform hover:scale-105"
          >
            <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5 mr-2" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 20l-5.447-2.724A1 1 0 013 16.382V5.618a1 1 0 011.447-.894L9 7m0 13l6-3m-6 3V7m6 10l4.553 2.276A1 1 0 0021 18.382V7.618a1 1 0 00-.553-.894L15 4m0 13V4" />
            </svg>
            Построить маршрут
          </button>
        </div>
      )}
      
      {/* Карточка парковки в зависимости от типа */}
      {selectedParking && (
        <div id="parking-card-container">
          {/* Здесь будет отрендерен компонент ParkingCard из родительского компонента */}
        </div>
      )}
      
      {/* Лейбл разработчика */}
      <div className="absolute bottom-2 right-2 bg-white/80 px-2 py-1 rounded-md text-xs text-gray-600 shadow-sm z-50">
        Разработано <a href="https://t.me/new_metas" target="_blank" rel="noopener noreferrer" className="font-medium text-blue-600 hover:underline">NewMeta</a>
      </div>
    </div>
  );
}