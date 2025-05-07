import { getAllParkings } from '@/db/utils';
import dynamic from 'next/dynamic';
import { Suspense } from 'react';

// Import dynamically to avoid server-side rendering issues with Leaflet
const ParkingMap = dynamic(() => import('@/components/ParkingMap'), {
  ssr: false,
  loading: () => <div className="w-full h-[600px] flex items-center justify-center">Загрузка карты...</div>
});

export default async function Home() {
  const parkings = await getAllParkings();
  
  return (
    <main className="flex min-h-screen flex-col items-center p-4 md:p-24">
      <h1 className="text-3xl font-bold text-center mb-6">
        Парковки Москвы
      </h1>
      <p className="text-center mb-8 max-w-2xl">
        Интерактивная карта перехватывающих парковок Москвы с информацией о свободных местах в режиме реального времени
      </p>
      
      <div className="w-full max-w-7xl mb-8">
        <Suspense fallback={<div className="w-full h-[600px] flex items-center justify-center">Загрузка карты...</div>}>
          <ParkingMap parkings={parkings} />
        </Suspense>
      </div>
      
      <div className="w-full max-w-7xl">
        <h2 className="text-2xl font-bold mb-4">Список парковок</h2>
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {parkings.map((parking) => (
            <div key={parking.id} className="border rounded-lg p-4 hover:shadow-md transition-shadow">
              <h3 className="font-bold">{parking.name}</h3>
              <p className="text-sm text-gray-600">
                {parking.street} {parking.house}
              </p>
              <p className="text-sm mt-1">м. {parking.subway}</p>
              <div className="mt-2 flex justify-between items-center">
                <span className="text-sm">
                  <span className="font-semibold">Свободно:</span> {parking.free_spaces} из {parking.total_spaces}
                </span>
                <span className={`px-2 py-1 rounded-full text-xs ${
                  parking.free_spaces === 0 
                    ? 'bg-red-100 text-red-800' 
                    : parking.free_spaces < 10 
                      ? 'bg-yellow-100 text-yellow-800' 
                      : 'bg-green-100 text-green-800'
                }`}>
                  {parking.free_spaces === 0 
                    ? 'Нет мест' 
                    : parking.free_spaces < 10 
                      ? 'Мало мест' 
                      : 'Есть места'}
                </span>
              </div>
            </div>
          ))}
        </div>
      </div>
    </main>
  );
}
