'use client';

import { useState, useEffect } from 'react';
import { MapContainer, TileLayer, Marker, Popup } from 'react-leaflet';
import { Parking } from '@/db/utils';
import { Button } from './ui/button';
import { Card, CardContent, CardHeader, CardTitle, CardFooter } from './ui/card';
import Link from 'next/link';
import { getYandexMapsUrl } from '@/lib/parking-api';
import 'leaflet/dist/leaflet.css';
import dynamic from 'next/dynamic';

// Fix for Leaflet icons in Next.js
const fixLeafletIcon = () => {
  // Используем более конкретные типы вместо any
  interface WindowWithLeaflet extends Window {
    _leafletMarker?: unknown;
    _leafletMap?: unknown;
    L: {
      Icon: {
        Default: {
          mergeOptions: (options: Record<string, string>) => void;
        };
      };
    };
  }

  const win = window as WindowWithLeaflet;
  
  delete win._leafletMarker;
  delete win._leafletMap;

  win.L.Icon.Default.mergeOptions({
    iconRetinaUrl: '/leaflet/marker-icon-2x.png',
    iconUrl: '/leaflet/marker-icon.png',
    shadowUrl: '/leaflet/marker-shadow.png',
  });
};

interface ParkingMapProps {
  parkings: Parking[];
}

const ParkingMap = ({ parkings }: ParkingMapProps) => {
  const [selectedParking, setSelectedParking] = useState<Parking | null>(null);
  const [isMounted, setIsMounted] = useState<boolean>(false);

  useEffect(() => {
    setIsMounted(true);
    return () => setIsMounted(false);
  }, []);

  useEffect(() => {
    if (isMounted) {
      fixLeafletIcon();
    }
  }, [isMounted]);

  if (!isMounted) {
    return <div>Loading map...</div>;
  }

  const moscowCenter = [55.751244, 37.618423];

  return (
    <div className="w-full h-[600px] relative">
      <MapContainer 
        center={moscowCenter as [number, number]} 
        zoom={10} 
        style={{ height: '100%', width: '100%' }}
      >
        <TileLayer
          url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
          attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors'
        />
        
        {parkings.map((parking) => (
          <Marker 
            key={parking.id}
            position={[parking.lat, parking.lng]}
            eventHandlers={{
              click: () => {
                setSelectedParking(parking);
              },
            }}
          >
            <Popup>
              <div className="text-sm">
                <strong>{parking.name}</strong><br />
                {parking.street} {parking.house}<br />
                Метро: {parking.subway}<br />
                Свободно: {parking.free_spaces} из {parking.total_spaces} мест
              </div>
              <div className="mt-2">
                <Button
                  size="sm"
                  className="w-full"
                  onClick={() => setSelectedParking(parking)}
                >
                  Подробнее
                </Button>
              </div>
            </Popup>
          </Marker>
        ))}
      </MapContainer>

      {selectedParking && (
        <div className="absolute top-2 right-2 z-[1000] w-80">
          <Card className="shadow-lg">
            <CardHeader>
              <CardTitle>{selectedParking.name}</CardTitle>
            </CardHeader>
            <CardContent>
              <p><strong>Адрес:</strong> {selectedParking.street} {selectedParking.house}</p>
              <p><strong>Метро:</strong> {selectedParking.subway}</p>
              <p className="mt-2">
                <strong>Доступно мест:</strong> {selectedParking.free_spaces} из {selectedParking.total_spaces}
              </p>
              <p>
                <strong>Для инвалидов:</strong> {selectedParking.handicapped_free} из {selectedParking.handicapped_total}
              </p>
              <div className="mt-4 h-16 bg-gray-100 rounded-md p-2">
                <p className="text-sm">Прогноз загруженности будет здесь</p>
              </div>
            </CardContent>
            <CardFooter className="flex justify-between">
              <Button variant="outline" onClick={() => setSelectedParking(null)}>
                Закрыть
              </Button>
              <Button asChild>
                <Link 
                  href={getYandexMapsUrl({
                    id: selectedParking.id,
                    name: selectedParking.name,
                    street: selectedParking.street,
                    house: selectedParking.house,
                    subway: selectedParking.subway,
                    totalSpaces: selectedParking.total_spaces,
                    freeSpaces: selectedParking.free_spaces,
                    handicappedTotal: selectedParking.handicapped_total,
                    handicappedFree: selectedParking.handicapped_free,
                    parkingNumber: ''
                  })}
                  target="_blank"
                >
                  Маршрут
                </Link>
              </Button>
            </CardFooter>
          </Card>
        </div>
      )}
    </div>
  );
};

// Dynamic import to prevent SSR issues with Leaflet
export default dynamic(() => Promise.resolve(ParkingMap), {
  ssr: false,
}); 