"use client";

import { useState, useEffect, useCallback } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { ParkingInfo } from "@/types/parking";
import { Heart, Navigation2, CarFront } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { useToast } from "@/hooks/use-toast";

interface FavoritesListProps {
  onParkingSelect: (parking: ParkingInfo) => void;
  onToggleFavorite: (parking: ParkingInfo) => void;
}

interface FavoriteResponse {
  parking: ParkingInfo;
  parkingId: string;
  userId: string;
  id: string;
}

export default function FavoritesList({ onParkingSelect, onToggleFavorite }: FavoritesListProps) {
  const [favorites, setFavorites] = useState<ParkingInfo[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const { toast } = useToast();

  // Fetch user's favorites
  const fetchFavorites = useCallback(async () => {
    try {
      setIsLoading(true);
      const res = await fetch("/api/favorites");
      
      if (!res.ok) {
        throw new Error("Failed to fetch favorites");
      }
      
      const data = await res.json();
      
      // Transform data into ParkingInfo array
      const parkings = data.map((fav: FavoriteResponse) => ({
        ...fav.parking,
        isFavorite: true,
      }));
      
      setFavorites(parkings);
    } catch (error) {
      console.error("Error fetching favorites:", error);
      toast({
        title: "Ошибка",
        description: "Не удалось загрузить избранные парковки",
        variant: "destructive",
      });
    } finally {
      setIsLoading(false);
    }
  }, [toast]);
  
  useEffect(() => {
    fetchFavorites();
  }, [fetchFavorites]);

  // Handle removing a parking from favorites
  const handleRemoveFavorite = async (parking: ParkingInfo) => {
    onToggleFavorite(parking);
    // Optimistically remove from the local state
    setFavorites(prev => prev.filter(p => p.id !== parking.id));
  };

  if (isLoading) {
    return (
      <div className="flex justify-center py-8">
        <div className="w-8 h-8 border-4 border-blue-500 border-t-transparent rounded-full animate-spin"></div>
      </div>
    );
  }

  if (favorites.length === 0) {
    return (
      <div className="text-center py-8">
        <p className="text-gray-500 mb-4">У вас пока нет избранных парковок</p>
        <Button variant="outline" onClick={() => document.querySelector('[value="map"]')?.dispatchEvent(new Event('click'))}>
          Перейти к карте
        </Button>
      </div>
    );
  }

  return (
    <div className="px-4">
      <h2 className="text-xl font-bold mb-4">
        Избранные парковки 
        <span className="text-sm font-normal ml-2 text-gray-500">
          {favorites.length}
        </span>
      </h2>

      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
        {favorites.map(parking => (
          <Card key={parking.id} className="overflow-hidden">
            <CardHeader className="pb-2">
              <CardTitle className="text-lg font-semibold flex justify-between items-start">
                <div className="truncate pr-2">
                  {parking.name}
                  {parking.subway && (
                    <Badge variant="outline" className="ml-2 text-xs">
                      М {parking.subway}
                    </Badge>
                  )}
                </div>
                <Button 
                  variant="ghost" 
                  size="icon" 
                  onClick={() => handleRemoveFavorite(parking)}
                  className="flex-shrink-0"
                >
                  <Heart className="h-4 w-4 fill-current text-pink-500" />
                </Button>
              </CardTitle>
              <div className="text-sm text-gray-500">
                {parking.street} {parking.house}
              </div>
            </CardHeader>
            
            <CardContent className="pt-0">
              <div className="flex justify-between items-center mt-2">
                {parking.freeSpaces !== undefined && (
                  <div className="flex items-center">
                    <CarFront className="h-4 w-4 mr-1 text-blue-500" />
                    <span className="font-medium">
                      {parking.freeSpaces} / {parking.totalSpaces || '?'}
                    </span>
                  </div>
                )}
                
                <div className="flex gap-2">
                  <Button 
                    size="sm" 
                    variant="outline" 
                    onClick={() => onParkingSelect(parking)}
                  >
                    Подробнее
                  </Button>
                  
                  <Button 
                    size="sm" 
                    onClick={() => {
                      const longitude = parking.lng || parking.lon || 37.6156; // Default to Moscow center longitude if nothing available
                      window.open(
                        `https://yandex.ru/maps/?rtext=~${parking.lat},${longitude}`,
                        "_blank"
                      );
                    }}
                  >
                    <Navigation2 className="h-4 w-4" />
                  </Button>
                </div>
              </div>
            </CardContent>
          </Card>
        ))}
      </div>
    </div>
  );
} 