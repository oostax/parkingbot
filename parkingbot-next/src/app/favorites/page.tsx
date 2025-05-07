import { auth } from '../api/auth/[...nextauth]/route';
import { redirect } from 'next/navigation';
import { getUserFavorites } from '@/db/utils';
import { Button } from '@/components/ui/button';
import Link from 'next/link';
import { Card, CardContent, CardFooter, CardHeader, CardTitle } from '@/components/ui/card';
import ParkingForecast from '@/components/ParkingForecast';

export default async function FavoritesPage() {
  const session = await auth();
  
  // Redirect to login if not authenticated
  if (!session?.user) {
    redirect('/api/auth/signin');
  }
  
  // Get user's favorite parkings
  const userId = session.user.id;
  if (!userId) {
    redirect('/api/auth/signin');
  }
  
  const favorites = await getUserFavorites(userId);
  
  return (
    <main className="flex min-h-screen flex-col items-center p-4 md:p-24">
      <h1 className="text-3xl font-bold text-center mb-6">
        Избранные парковки
      </h1>
      
      {favorites.length === 0 ? (
        <div className="text-center py-10">
          <p className="mb-4">У вас пока нет избранных парковок</p>
          <Button asChild>
            <Link href="/">Добавить парковки</Link>
          </Button>
        </div>
      ) : (
        <div className="w-full max-w-4xl grid grid-cols-1 gap-6">
          {favorites.map((parking) => (
            <Card key={parking.id} className="w-full">
              <CardHeader>
                <CardTitle className="flex justify-between">
                  <span>{parking.name}</span>
                  <span className={`px-3 py-1 rounded-full text-xs ${
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
                </CardTitle>
              </CardHeader>
              <CardContent>
                <div className="mb-4">
                  <p><strong>Адрес:</strong> {parking.street} {parking.house}</p>
                  <p><strong>Метро:</strong> {parking.subway}</p>
                  <p className="mt-2">
                    <strong>Доступно мест:</strong> {parking.free_spaces} из {parking.total_spaces}
                  </p>
                  <p>
                    <strong>Для инвалидов:</strong> {parking.handicapped_free} из {parking.handicapped_total}
                  </p>
                </div>
                
                <div className="mt-4">
                  <ParkingForecast parkingId={parking.id} />
                </div>
              </CardContent>
              <CardFooter className="flex justify-between">
                <form action="/api/favorites" method="DELETE">
                  <input type="hidden" name="parkingId" value={parking.id} />
                  <Button variant="outline" type="submit">
                    Удалить из избранного
                  </Button>
                </form>
                
                <Button asChild>
                  <Link 
                    href={`yandexmaps://maps.yandex.ru/?text=${encodeURIComponent(`${parking.street} ${parking.house}`)}`}
                    target="_blank"
                  >
                    Маршрут
                  </Link>
                </Button>
              </CardFooter>
            </Card>
          ))}
        </div>
      )}
    </main>
  );
} 