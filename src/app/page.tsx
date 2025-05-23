"use client";

import { useState, useEffect, useMemo, useCallback } from "react";
import dynamic from "next/dynamic";
import { Button } from "@/components/ui/button";
import { ParkingInfo } from "@/types/parking";
import ParkingCard from "@/components/parking-card";
import TelegramLogin from "@/components/telegram-login";
import { signOut, useSession } from "next-auth/react";
import { useToast } from "@/hooks/use-toast";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import FavoritesList from "@/components/favorites-list";
import { getAllParkings } from "@/lib/parking-utils";
import { Input } from "@/components/ui/input";
import { Search } from "lucide-react";
import { StarIcon } from "lucide-react";

// Import the map component dynamically to avoid SSR issues
const MapComponent = dynamic(() => import("@/components/map-component"), {
  ssr: false,
  loading: () => <div className="w-full h-[calc(100vh-250px)] md:h-[calc(100vh-150px)] bg-slate-100 animate-pulse" />,
});

export default function Home() {
  const { data: session } = useSession();
  const { toast } = useToast();
  const [parkings, setParkings] = useState<ParkingInfo[]>([]);
  const [filteredParkings, setFilteredParkings] = useState<ParkingInfo[]>([]);
  const [selectedParking, setSelectedParking] = useState<ParkingInfo | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [activeTab, setActiveTab] = useState("map");
  const [searchQuery, setSearchQuery] = useState("");
  const [showOnlyFavorites, setShowOnlyFavorites] = useState(false);

  // Check if user has any favorites
  const hasFavorites = useMemo(() => {
    return parkings.some(p => p.isFavorite);
  }, [parkings]);

  // Fetch all parkings from our API
  const fetchParkings = useCallback(async () => {
    try {
      setIsLoading(true);
      const res = await fetch("/api/parkings");
      const data = await res.json();
      
      if (Array.isArray(data)) {
        setParkings(data);
        setFilteredParkings(data);
      } else {
        console.error("Invalid response format", data);
        toast({
          title: "Ошибка",
          description: "Неверный формат данных от API",
          variant: "destructive",
        });
      }
    } catch (error) {
      console.error("Error fetching parkings:", error);
      toast({
        title: "Ошибка",
        description: "Не удалось загрузить данные о парковках",
        variant: "destructive",
      });
      
      // Fallback to local data in case the API fails
      try {
        const localData = await getAllParkings();
        setParkings(localData);
        setFilteredParkings(localData);
      } catch (fallbackError) {
        console.error("Fallback loading failed:", fallbackError);
      }
    } finally {
      setIsLoading(false);
    }
  }, [toast]);

  // Filter parkings based on search query
  useEffect(() => {
    let filtered = parkings;
    
    // Apply search filter if query exists
    if (searchQuery.trim()) {
      const query = searchQuery.toLowerCase().trim();
      filtered = parkings.filter(parking => 
        parking.name.toLowerCase().includes(query) || 
        parking.street.toLowerCase().includes(query) || 
        (parking.subway && parking.subway.toLowerCase().includes(query))
      );
    }
    
    // Apply favorites filter if enabled
    if (showOnlyFavorites) {
      filtered = filtered.filter(parking => parking.isFavorite);
    }
    
    setFilteredParkings(filtered);
  }, [searchQuery, parkings, showOnlyFavorites]);

  // Fetch parking details
  const fetchParkingDetails = async (id: string) => {
    try {
      const res = await fetch(`/api/parkings/${id}`);
      const data = await res.json();
      
      if (data.parking) {
        setSelectedParking(data.parking);
      } else {
        console.error("Invalid parking details response", data);
      }
    } catch (error) {
      console.error("Error fetching parking details:", error);
      toast({
        title: "Ошибка",
        description: "Не удалось загрузить детали парковки",
        variant: "destructive",
      });
    }
  };

  // Toggle favorite status
  const toggleFavorite = async (parking: ParkingInfo) => {
    if (!session) {
      toast({
        title: "Требуется авторизация",
        description: "Войдите через Telegram, чтобы добавить парковку в избранное",
        variant: "default",
      });
      return;
    }

    try {
      if (parking.isFavorite) {
        await fetch("/api/favorites", {
          method: "DELETE",
          headers: {
            "Content-Type": "application/json",
          },
          body: JSON.stringify({ parkingId: parking.id }),
        });
      } else {
        await fetch("/api/favorites", {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
          },
          body: JSON.stringify({ parkingId: parking.id }),
        });
      }
      
      // Update the parking list
      fetchParkings();
      
      toast({
        title: parking.isFavorite ? "Удалено из избранного" : "Добавлено в избранное",
        description: parking.name,
      });
    } catch (error) {
      console.error("Error toggling favorite:", error);
      toast({
        title: "Ошибка",
        description: "Не удалось обновить избранное",
        variant: "destructive",
      });
    }
  };

  // Get selected parking details and switch to map tab
  const handleParkingSelect = async (parking: ParkingInfo) => {
    setSelectedParking(parking);
    fetchParkingDetails(parking.id);
    setActiveTab("map");
  };

  // Close parking detail card
  const handleCloseParking = () => {
    setSelectedParking(null);
  };

  // Toggle showing only favorites
  const toggleShowOnlyFavorites = () => {
    setShowOnlyFavorites(prev => !prev);
  };

  // Load parkings on initial render
  useEffect(() => {
    fetchParkings();
  }, [session, fetchParkings]);

  return (
    <main className="min-h-screen flex flex-col">
      <header className="p-2 md:p-4 pt-6 md:pt-4 bg-white shadow-sm fixed top-0 left-0 right-0 z-50">
        <div className="container flex justify-between items-center">
          <h1 className="text-base md:text-xl font-bold truncate mr-2">
            <span className="hidden sm:inline">Перехватывающие парковки</span>
            <span className="sm:hidden">Парковки</span>
          </h1>
          <div>
            {session ? (
              <div className="flex items-center gap-1 md:gap-2">
                <span className="text-xs md:text-sm hidden md:inline">
                  {session.user.name || "Пользователь"}
                </span>
                <Button variant="outline" size="sm" className="text-xs py-1 px-2 md:py-2 md:px-4" onClick={() => signOut()}>
                  Выйти
                </Button>
              </div>
            ) : (
              <TelegramLogin onSuccess={() => fetchParkings()} />
            )}
          </div>
        </div>
      </header>

      <div className="container py-0 flex-1 flex flex-col mt-[60px] md:mt-[72px]">
        <div className="my-2 md:my-4 px-2 md:px-6">
          <div className="relative">
            <Search className="absolute left-3 md:left-4 top-1/2 transform -translate-y-1/2 text-gray-400 h-3 w-3 md:h-4 md:w-4" />
            <Input
              type="text"
              placeholder="Поиск парковок..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="pl-8 md:pl-10 py-1 md:py-2 text-xs md:text-sm h-8 md:h-10"
            />
          </div>
        </div>

        <Tabs value={activeTab} className="flex-1 flex flex-col" onValueChange={setActiveTab}>
          <TabsList className="bg-transparent px-1 md:px-3">
            <TabsTrigger value="map" className="relative overflow-hidden transition-all text-xs md:text-sm py-1 px-2 md:py-2 md:px-3">
              Карта
              <span className="absolute bottom-0 left-0 w-full h-0.5 bg-primary transform origin-left transition-transform duration-300 ease-out" 
                style={{ transform: activeTab === "map" ? "scaleX(1)" : "scaleX(0)" }} />
            </TabsTrigger>
            <TabsTrigger value="list" className="relative overflow-hidden transition-all text-xs md:text-sm py-1 px-2 md:py-2 md:px-3">
              Список
              <span className="absolute bottom-0 left-0 w-full h-0.5 bg-primary transform origin-left transition-transform duration-300 ease-out" 
                style={{ transform: activeTab === "list" ? "scaleX(1)" : "scaleX(0)" }} />
            </TabsTrigger>
            <TabsTrigger value="favorites" disabled={!session} className="relative overflow-hidden transition-all text-xs md:text-sm py-1 px-2 md:py-2 md:px-3">
              <span className="hidden xs:inline">Избранное</span>
              <span className="xs:hidden">⭐</span>
              <span className="absolute bottom-0 left-0 w-full h-0.5 bg-primary transform origin-left transition-transform duration-300 ease-out" 
                style={{ transform: activeTab === "favorites" ? "scaleX(1)" : "scaleX(0)" }} />
            </TabsTrigger>
          </TabsList>
          
          <TabsContent value="map" className="flex-1 flex flex-col p-0 animate-in fade-in slide-in-from-left duration-300 ease-in-out">
            <div className="relative flex-1 flex flex-col h-[calc(100vh-200px)]">
              {session && hasFavorites && (
                <div className="absolute top-3 right-3 z-30">
                  <Button 
                    variant={showOnlyFavorites ? "default" : "outline"} 
                    size="sm" 
                    className="flex items-center gap-2 shadow-md"
                    onClick={toggleShowOnlyFavorites}
                  >
                    {showOnlyFavorites ? (
                      <>
                        <StarIcon className="h-4 w-4" /> Избранные
                      </>
                    ) : (
                      <>
                        <StarIcon className="h-4 w-4" /> Все парковки
                      </>
                    )}
                  </Button>
                </div>
              )}
              
              {isLoading ? (
                <div className="w-full h-full min-h-[70vh] flex items-center justify-center bg-slate-100 rounded-md">
                  <div className="text-center">
                    <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-gray-900 mx-auto"></div>
                    <p className="mt-2 text-gray-600">Загрузка парковок...</p>
                  </div>
                </div>
              ) : (
                <div className="flex-1 relative h-full">
                  <MapComponent 
                    parkings={filteredParkings} 
                    selectedParking={selectedParking}
                    onParkingSelect={handleParkingSelect}
                  />
                </div>
              )}
              
              {selectedParking && (
                <div className="absolute bottom-4 left-0 right-0 mx-auto p-2 max-w-md z-50 parking-card-container animate-in fade-in zoom-in-95 duration-200">
                  <ParkingCard 
                    parking={selectedParking} 
                    onClose={handleCloseParking}
                    onToggleFavorite={() => toggleFavorite(selectedParking)}
                  />
                </div>
              )}
            </div>
          </TabsContent>
          
          <TabsContent value="list" className="flex-1 animate-in fade-in slide-in-from-right duration-300 ease-in-out">
            {isLoading ? (
              <div className="w-full flex items-center justify-center py-12">
                <div className="text-center">
                  <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-gray-900 mx-auto"></div>
                  <p className="mt-2 text-gray-600">Загрузка списка парковок...</p>
                </div>
              </div>
            ) : (
              <div className="py-4 pl-4">
                <h2 className="text-xl font-bold mb-4">
                  Список перехватывающих парковок 
                  {filteredParkings.length !== parkings.length && (
                    <span className="text-sm font-normal ml-2 text-gray-500">
                      Найдено: {filteredParkings.length}
                    </span>
                  )}
                </h2>
                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4 max-h-[70vh] overflow-y-auto">
                  {filteredParkings.length > 0 ? (
                    filteredParkings.map((parking) => (
                      <div 
                        key={parking.id} 
                        className={`p-3 border rounded-md cursor-pointer transition-all ${
                          selectedParking?.id === parking.id 
                            ? 'border-orange-500 bg-orange-50' 
                            : 'border-blue-300 hover:bg-blue-50'
                        }`}
                        onClick={() => handleParkingSelect(parking)}
                      >
                        <div className="font-medium">{parking.name}</div>
                        <div className="text-sm text-gray-500">{parking.street} {parking.house}</div>
                        {parking.subway && (
                          <div className="text-xs mt-1 inline-block px-2 py-1 bg-blue-100 rounded-full">
                            Метро {parking.subway}
                          </div>
                        )}
                      </div>
                    ))
                  ) : (
                    <div className="col-span-full text-center py-8 text-gray-500">
                      Парковки не найдены по запросу &quot;{searchQuery}&quot;
                    </div>
                  )}
                </div>
              </div>
            )}
          </TabsContent>
          
          <TabsContent value="favorites" className="flex-1 animate-in fade-in slide-in-from-right duration-300 ease-in-out">
            <FavoritesList 
              onParkingSelect={handleParkingSelect}
              onToggleFavorite={toggleFavorite}
            />
          </TabsContent>
        </Tabs>
      </div>
    </main>
  );
}
