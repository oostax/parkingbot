"use client";

import { useState, useEffect, useRef } from "react";
import { ParkingInfo, Polygon } from "@/types/parking";
import { MapContainer, TileLayer, Marker, useMap, Polygon as LeafletPolygon, Tooltip, ZoomControl, Polyline, Circle } from "react-leaflet";
import "leaflet/dist/leaflet.css";
import L from "leaflet";
// Импортируем только типы из leaflet-routing-machine
import "leaflet-routing-machine";

// Расширяем типы Leaflet для поддержки routing-machine
declare global {
  namespace L {
    namespace Routing {
      function control(options: any): any;
    }
  }
}

// Компонент для отображения местоположения пользователя
function UserLocationMarker({ position }: { position: [number, number] | null }) {
  if (!position) return null;
  
  return (
    <>
      {/* Внешний пульсирующий круг */}
      <Circle 
        center={position}
        pathOptions={{ 
          color: '#3B82F6',
          fillColor: '#3B82F6',
          fillOpacity: 0.2,
          weight: 1
        }}
        radius={30}
        className="animate-pulse-slow"
      />
      
      {/* Средний круг */}
      <Circle 
        center={position}
        pathOptions={{ 
          color: '#3B82F6',
          fillColor: '#3B82F6',
          fillOpacity: 0.4,
          weight: 1
        }}
        radius={15}
      />
      
      {/* Центральная точка */}
      <Circle 
        center={position}
        pathOptions={{ 
          color: '#3B82F6',
          fillColor: '#ffffff',
          fillOpacity: 1,
          weight: 2
        }}
        radius={5}
      />
    </>
  );
}

// Компонент для анимации маршрута
function RouteAnimator({ from, to }: { from: [number, number] | null; to: [number, number] | null }) {
  const map = useMap();
  const routingControlRef = useRef<any>(null);
  const [routePoints, setRoutePoints] = useState<[number, number][]>([]);
  const [animationProgress, setAnimationProgress] = useState(0);
  
  // Эффект для создания и удаления маршрута
  useEffect(() => {
    if (!from || !to) {
      // Удаляем маршрут, если нет координат
      if (routingControlRef.current) {
        map.removeControl(routingControlRef.current);
        routingControlRef.current = null;
        setRoutePoints([]);
      }
      return;
    }
    
    // Создаем маршрут
    if (!routingControlRef.current) {
      const control = L.Routing.control({
        waypoints: [
          L.latLng(from[0], from[1]),
          L.latLng(to[0], to[1])
        ],
        lineOptions: {
          styles: [{ color: '#3B82F6', opacity: 0, weight: 0 }], // Скрываем стандартную линию
          addWaypoints: false
        },
        createMarker: () => null, // Не создаем маркеры маршрута
        fitSelectedRoutes: false,
        showAlternatives: false,
        show: false, // Не показываем панель маршрута
        routeWhileDragging: false,
        addWaypoints: false
      }).addTo(map);
      
      routingControlRef.current = control;
      
      // Получаем точки маршрута после его создания
      control.on('routesfound', (e: any) => {
        const routes = e.routes;
        if (routes && routes.length > 0) {
          const coordinates = routes[0].coordinates;
          setRoutePoints(coordinates.map((coord: any) => [coord.lat, coord.lng] as [number, number]));
          
          // Начинаем анимацию
          setAnimationProgress(0);
          const duration = 1500; // 1.5 секунды
          const steps = 60;
          let step = 0;
          
          const interval = setInterval(() => {
            step++;
            setAnimationProgress(step / steps);
            if (step >= steps) {
              clearInterval(interval);
            }
          }, duration / steps);
        }
      });
    } else {
      // Обновляем маршрут, если координаты изменились
      routingControlRef.current.setWaypoints([
        L.latLng(from[0], from[1]),
        L.latLng(to[0], to[1])
      ]);
    }
    
    return () => {
      if (routingControlRef.current) {
        map.removeControl(routingControlRef.current);
        routingControlRef.current = null;
      }
    };
  }, [from, to, map]);
  
  // Вычисляем точки для отображения с учетом прогресса анимации
  const animatedPoints = routePoints.length > 0 
    ? routePoints.slice(0, Math.ceil(routePoints.length * animationProgress))
    : [];
  
  if (animatedPoints.length < 2) return null;
  
  return (
    <Polyline 
      positions={animatedPoints}
      pathOptions={{
        color: '#3B82F6',
        weight: 4,
        opacity: 0.8,
        lineCap: 'round',
        lineJoin: 'round',
        dashArray: '0, 10',
        dashOffset: '0'
      }}
    />
  );
}

// Component to handle map updates when selected parking changes
function MapUpdater({ selectedParking, userLocation }: { selectedParking: ParkingInfo | null, userLocation: [number, number] | null }) {
  const map = useMap();
  
  useEffect(() => {
    if (selectedParking) {
      // Offset the center point to position the marker in the upper part of the screen
      // This ensures the card appears directly below the marker in the center of the screen
      const offset = window.innerHeight < 800 ? 0.00035 : 0.00045;
      
      // Используем lng, если оно определено, иначе lon
      const longitude = selectedParking.lng ?? selectedParking.lon;
      
      if (longitude !== undefined) {
        map.flyTo(
          [selectedParking.lat - offset, longitude], // Position marker ~35-40% from top
          16, // Reduced zoom level for a less close view
          {
            duration: 1, // Quick animation
            easeLinearity: 0.5
          }
        );
      }
    }
  }, [selectedParking, map]);
  
  // Центрируем карту на местоположении пользователя, если нет выбранной парковки
  useEffect(() => {
    if (!selectedParking && userLocation) {
      map.flyTo(
        userLocation,
        15,
        {
          duration: 1,
          easeLinearity: 0.5
        }
      );
    }
  }, [userLocation, selectedParking, map]);
  
  return null;
}

interface MapComponentProps {
  parkings: ParkingInfo[];
  selectedParking: ParkingInfo | null;
  onParkingSelect: (parking: ParkingInfo) => void;
}

// Интерфейс для данных о загруженности парковок
interface OccupancyData {
  [parkingId: string]: { occupancy: number; freeSpaces: number };
}

export default function MapComponent({ parkings, selectedParking, onParkingSelect }: MapComponentProps) {
  const [isMounted, setIsMounted] = useState(false);
  const [occupancyData, setOccupancyData] = useState<OccupancyData>({});
  const [userLocation, setUserLocation] = useState<[number, number] | null>(null);
  const [showRoute, setShowRoute] = useState(false);

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
    getUserLocation();
  }, []);

  // Обработчик клика по парковке с обновлением данных
  const handleParkingSelect = (parking: ParkingInfo) => {
    // Вызываем внешний обработчик
    onParkingSelect(parking);
    
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

  // Create custom marker icons
  const getMarkerIcon = (parking: ParkingInfo) => {
    const isSelected = selectedParking?.id === parking.id;
    const isFavorite = parking.isFavorite;
    
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
      html: `<div style="background-color: ${color}; width: 24px; height: 24px; border-radius: 50%; display: flex; align-items: center; justify-content: center; transform: ${isSelected ? 'scale(1.25)' : 'scale(1)'}; transition: transform 0.3s ease;">
               <div style="background-color: white; width: 8px; height: 8px; border-radius: 50%;"></div>
             </div>`,
      iconSize: [24, 24],
      iconAnchor: [12, 24],
    });
  };

  // Convert coordinates for Leaflet polygon
  const convertPolygonForLeaflet = (polygon: Polygon | undefined) => {
    if (!polygon || !Array.isArray(polygon)) return [];
    return polygon.map(coord => [coord[1], coord[0]] as [number, number]);
  };

  // Функция для получения долготы из объекта парковки
  const getLongitude = (parking: ParkingInfo): number => {
    // Используем lng, если оно определено, иначе lon
    return parking.lng ?? parking.lon ?? 0;
  };

  if (!isMounted) {
    return (
      <div className="w-full h-full min-h-[70vh] rounded-md overflow-hidden bg-slate-100 animate-pulse flex items-center justify-center">
        <p>Загрузка карты...</p>
      </div>
    );
  }

  // Получаем координаты выбранной парковки для маршрута
  const selectedParkingCoords = selectedParking ? [
    selectedParking.lat,
    getLongitude(selectedParking)
  ] as [number, number] : null;

  return (
    <div className="w-full h-full absolute inset-0">
      <MapContainer
        center={[55.751244, 37.618423]}
        zoom={10}
        style={{ width: "100%", height: "100%" }}
        className="z-10 absolute inset-0"
        attributionControl={false}
        zoomControl={false}
        scrollWheelZoom={true}
      >
        <TileLayer
          url="https://{s}.basemaps.cartocdn.com/light_all/{z}/{x}/{y}{r}.png"
          attribution=""
        />
        
        <ZoomControl position="bottomright" />
        <MapUpdater selectedParking={selectedParking} userLocation={userLocation} />
        
        {/* Отображаем местоположение пользователя */}
        <UserLocationMarker position={userLocation} />
        
        {/* Отображаем маршрут, если он активен */}
        {showRoute && userLocation && selectedParkingCoords && (
          <RouteAnimator from={userLocation} to={selectedParkingCoords} />
        )}
        
        {parkings.map((parking) => {
          const longitude = getLongitude(parking);
          
          // Пропускаем маркер, если нет координат
          if (longitude === 0 || parking.lat === 0) return null;
          
          return (
            <Marker 
              key={parking.id} 
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
        })}
        
        {/* Render parking polygons */}
        {parkings.filter(p => p.polygon && p.polygon.length > 0).map((parking) => {
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
      
      {/* Кнопка построения маршрута */}
      {selectedParking && (
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
      
      {/* Лейбл разработчика */}
      <div className="absolute bottom-2 right-2 bg-white/80 px-2 py-1 rounded-md text-xs text-gray-600 shadow-sm z-50">
        Разработано <a href="https://t.me/new_metas" target="_blank" rel="noopener noreferrer" className="font-medium text-blue-600 hover:underline">NewMeta</a>
      </div>
    </div>
  );
}