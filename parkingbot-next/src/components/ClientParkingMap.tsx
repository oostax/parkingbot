'use client';

import dynamic from 'next/dynamic';
import { Parking } from '@/db/utils';

// Import dynamically to avoid server-side rendering issues with Leaflet
const ParkingMap = dynamic(() => import('@/components/ParkingMap'), {
  ssr: false,
  loading: () => <div className="w-full h-[600px] flex items-center justify-center">Загрузка карты...</div>
});

interface ClientParkingMapProps {
  parkings: Parking[];
}

export default function ClientParkingMap({ parkings }: ClientParkingMapProps) {
  return <ParkingMap parkings={parkings} />;
} 