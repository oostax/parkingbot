"use client";

import { useState, useEffect, useMemo, useCallback, useRef, Suspense } from "react";
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
import { Search, Loader2 } from "lucide-react";
import { StarIcon } from "lucide-react";
import { User } from "lucide-react";
import { useRouter } from "next/navigation";

// Import the map component dynamically to avoid SSR issues
const MapComponent = dynamic(() => import("@/components/map-component"), {
  ssr: false,
  loading: () => <div className="w-full h-[calc(100vh-250px)] md:h-[calc(100vh-150px)] bg-slate-100 animate-pulse" />,
});

// Инициализация Telegram WebApp
const initWebApp = () => {
  if (typeof window !== 'undefined' && window.Telegram?.WebApp) {
    try {
      // Используем тип any для работы с Telegram API
      const tg = window.Telegram.WebApp as any;
      tg.expand();
      tg.setHeaderColor('#FFFFFF');
      
      // Отключение вертикальных свайпов для предотвращения сворачивания при работе с картой
      if (tg.disableVerticalSwipes) {
        tg.disableVerticalSwipes();
      }
      
      // Настройка safe area для корректного отображения
      if (tg.safeAreaInset) {
        document.documentElement.style.setProperty('--tg-safe-area-top', `${tg.safeAreaInset.top || 0}px`);
        document.documentElement.style.setProperty('--tg-safe-area-bottom', `${tg.safeAreaInset.bottom || 0}px`);
      }
    } catch (error) {
      console.error("Error initializing Telegram WebApp:", error);
    }
  }
};

// Компонент-заглушка для Suspense
const TelegramLoginFallback = () => (
  <Button 
    variant="outline" 
    size="sm" 
    className="text-xs py-1 px-2 md:py-2 md:px-4"
  >
    Загрузка...
  </Button>
);

// Компонент для отображения загрузки на весь экран
const FullPageLoader = () => (
  <div className="fixed inset-0 flex items-center justify-center bg-white bg-opacity-80 z-50">
    <div className="text-center">
      <Loader2 className="h-12 w-12 animate-spin mx-auto text-primary" />
      <p className="mt-4 text-gray-600">Загрузка приложения...</p>
    </div>
  </div>
);

export default function Home() {
  const { data: session, status: sessionStatus } = useSession();
  const { toast } = useToast();
  const [parkings, setParkings] = useState<ParkingInfo[]>([]);
  const [filteredParkings, setFilteredParkings] = useState<ParkingInfo[]>([]);
  const [selectedParking, setSelectedParking] = useState<ParkingInfo | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [activeTab, setActiveTab] = useState("map");
  const [searchQuery, setSearchQuery] = useState("");
  const [showOnlyFavorites, setShowOnlyFavorites] = useState(false);
  const [showOnlyIntercepting, setShowOnlyIntercepting] = useState(true);
  const [authChecked, setAuthChecked] = useState(false);
  const [currentPage, setCurrentPage] = useState(1);
  const [itemsPerPage] = useState(24); // 8 рядов по 3 карточки в ряду в типичном представлении
  // Добавляем состояние для пагинации с сервера
  const [totalListItems, setTotalListItems] = useState(0);
  const [totalListPages, setTotalListPages] = useState(1);
  const [parkingType, setParkingType] = useState<'all' | 'intercepting' | 'paid'>('intercepting');
  // Отдельный массив для парковок на вкладке "Список"
  const [listParkings, setListParkings] = useState<ParkingInfo[]>([]);
  const [isListLoading, setIsListLoading] = useState(false);
  const router = useRouter();
  
  // Добавляем ref для отслеживания активных запросов
  const isDataFetchingRef = useRef<boolean>(false);
  // Добавляем временную метку последнего запроса
  const lastDataFetchRef = useRef<number>(0);
  // Минимальный интервал между запросами (3 секунды)
  const MIN_FETCH_INTERVAL = 3000;
  // Ref для списка парковок для прокрутки вверх при смене страницы
  const listContainerRef = useRef<HTMLDivElement>(null);

  // Check if user has any favorites
  const hasFavorites = useMemo(() => {
    return parkings.some(p => p.isFavorite);
  }, [parkings]);

  // Fetch all parkings from our API
  const fetchParkings = useCallback(async () => {
    // Предотвращаем параллельные запросы на получение данных
    if (isDataFetchingRef.current) {
      console.log("Предотвращен параллельный запрос на получение данных");
      return;
    }
    
    // Проверяем, не слишком ли часто делаем запросы
    const now = Date.now();
    if (now - lastDataFetchRef.current < MIN_FETCH_INTERVAL) {
      console.log("Запрос отклонен из-за слишком частых вызовов");
      return;
    }
    
    try {
      console.log("Начинаем загрузку данных о парковках");
      setIsLoading(true);
      isDataFetchingRef.current = true;
      
      // Добавляем параметр noCache=true и timestamp для обхода кэширования
      const timestamp = new Date().getTime();
      const res = await fetch(`/api/parkings?type=intercepting&noCache=true&t=${timestamp}&limit=1000`); // Для карты загружаем только перехватывающие с большим лимитом
      console.log("Ответ API получен:", res.status, res.statusText);
      const data = await res.json();
      console.log("Данные от API:", data.parkings?.length ? `Получено ${data.parkings.length} парковок` : "Пустой массив или некорректные данные");
      
      if (Array.isArray(data.parkings)) {
        setParkings(data.parkings);
        setFilteredParkings(data.parkings);
        
        // Выводим информацию о количестве перехватывающих парковок
        console.log(`Загружено ${data.parkings.length} перехватывающих парковок`);
        
        // Отправляем событие с количеством перехватывающих парковок
        window.dispatchEvent(new CustomEvent('update-intercepting-count', { 
          detail: { count: data.parkings.length } 
        }));
      } else {
        console.error("Invalid response format", data);
        toast({
          title: "Ошибка",
          description: "Неверный формат данных от API",
          variant: "destructive",
        });
      }
      
      lastDataFetchRef.current = Date.now();
    } catch (error) {
      console.error("Error fetching parkings:", error);
      toast({
        title: "Ошибка",
        description: "Не удалось загрузить данные о парковках",
        variant: "destructive",
      });
      
      // Fallback to local data in case the API fails
      try {
        console.log("Пробуем загрузить локальные данные");
        const localData = await getAllParkings();
        console.log("Локальные данные:", localData.length ? `Получено ${localData.length} парковок` : "Пустой массив или некорректные данные");
        setParkings(localData);
        setFilteredParkings(localData);
      } catch (fallbackError) {
        console.error("Fallback loading failed:", fallbackError);
      }
    } finally {
      setIsLoading(false);
      isDataFetchingRef.current = false;
    }
  }, [toast]);

  // Новая функция для загрузки парковок на вкладке "Список"
  const fetchListParkings = useCallback(async (page = 1, type: 'all' | 'intercepting' | 'paid' = 'all', search = '') => {
    try {
      setIsListLoading(true);
      
      let url = `/api/parkings?page=${page}&limit=${itemsPerPage}&type=${type}`;
      
      if (search) {
        url += `&search=${encodeURIComponent(search)}`;
      }
      
      const res = await fetch(url);
      if (!res.ok) {
        throw new Error("Failed to fetch parkings");
      }
      
      const data = await res.json();
      
      if (data.parkings && Array.isArray(data.parkings)) {
        setListParkings(data.parkings);
        setTotalListItems(data.pagination.totalItems);
        setTotalListPages(data.pagination.totalPages);
      } else {
        throw new Error("Invalid response format");
      }
      
    } catch (error) {
      console.error("Error fetching list parkings:", error);
      toast({
        title: "Ошибка",
        description: "Не удалось загрузить список парковок",
        variant: "destructive",
      });
      setListParkings([]);
      setTotalListItems(0);
      setTotalListPages(1);
    } finally {
      setIsListLoading(false);
    }
  }, [itemsPerPage, toast]);

  // Загрузка парковок при переключении вкладки на "Список"
  useEffect(() => {
    if (activeTab === "list") {
      // Используем напрямую выбранный тип parkingType без дополнительной логики
      console.log(`Загрузка списка парковок: тип=${parkingType}, страница=${currentPage}, поиск=${searchQuery || 'пусто'}`);
      fetchListParkings(currentPage, parkingType, searchQuery);
    }
  }, [activeTab, currentPage, parkingType, fetchListParkings, searchQuery]);

  // Обработчик смены типа парковок
  const handleParkingTypeChange = useCallback((type: 'all' | 'intercepting' | 'paid') => {
    setParkingType(type);
    setCurrentPage(1); // Сброс на первую страницу при смене типа
  }, []);

  // Сбрасываем текущую страницу при изменении поискового запроса или типа парковок
  useEffect(() => {
    if (activeTab === "list") {
      // Используем небольшую задержку для предотвращения слишком частых запросов при вводе
      const timer = setTimeout(() => {
        setCurrentPage(1);
        console.log(`Изменение поиска или типа: тип=${parkingType}, поиск=${searchQuery || 'пусто'}`);
        fetchListParkings(1, parkingType, searchQuery);
      }, 500);
      
      return () => clearTimeout(timer);
    }
  }, [searchQuery, fetchListParkings, activeTab, parkingType]);

  // Прокручиваем список вверх при смене страницы
  useEffect(() => {
    if (listContainerRef.current && activeTab === "list") {
      listContainerRef.current.scrollTop = 0;
    }
  }, [currentPage, activeTab]);

  // Мемоизированные результаты для карты
  const filteredParkingsForMap = useMemo(() => {
    let filtered = parkings;
    
    // Для карты применяем только фильтр избранного
    if (showOnlyFavorites) {
      filtered = filtered.filter(parking => parking.isFavorite);
    }
    
    return filtered;
  }, [parkings, showOnlyFavorites]);
  
  // Обычная фильтрация
  useEffect(() => {
    setFilteredParkings(activeTab === "map" ? filteredParkingsForMap : []);
  }, [activeTab, filteredParkingsForMap]);

  // Fetch parking details
  const fetchParkingDetails = async (id: string) => {
    try {
      const res = await fetch(`/api/parkings/${id}`);
      
      if (!res.ok) {
        console.log(`Парковка с ID ${id} не найдена или не является перехватывающей`);
        return; // Прерываем выполнение, если парковка не найдена
      }
      
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
  const handleParkingSelect = useCallback(async (parking: ParkingInfo | null) => {
    // Если parking равен null, просто закрываем карточку
    if (!parking) {
      setSelectedParking(null);
      return;
    }
    
    setSelectedParking(parking);
    
    // Проверяем, является ли парковка перехватывающей по свойству isIntercepting
    if (parking.isIntercepting) {
      fetchParkingDetails(parking.id);
    }
    
    setActiveTab("map");
  }, [fetchParkingDetails]);

  // Close parking detail card
  const handleCloseParking = () => {
    // Отправляем событие для предотвращения автоцентрирования
    window.dispatchEvent(new Event('prevent-auto-center'));
    
    // Закрываем карточку
    setSelectedParking(null);
  };

  // Toggle showing only favorites
  const toggleShowOnlyFavorites = () => {
    setShowOnlyFavorites(prev => !prev);
  };

  // Load parkings on initial render and handle auth check
  useEffect(() => {
    initWebApp(); // Инициализация Telegram WebApp при загрузке
    
    // Устанавливаем начальную метку времени
    lastDataFetchRef.current = Date.now() - MIN_FETCH_INTERVAL;
    
    // Проверяем статус авторизации
    if (sessionStatus === 'loading') {
      return; // Ждем завершения проверки авторизации
    }
    
    setAuthChecked(true); // Отмечаем, что проверка авторизации завершена
    
    // Загружаем парковки только если еще не загружены
    if (parkings.length === 0) {
      fetchParkings();
    }

    // Обработчик события выбора парковки из компонента рекомендаций
    const handleSelectParking = (event: CustomEvent) => {
      if (event.detail && event.detail.parking) {
        handleParkingSelect(event.detail.parking);
      }
    };

    // Добавляем слушатель события
    window.addEventListener('select-parking', handleSelectParking as EventListener);

    // Удаляем слушатель при размонтировании
    return () => {
      window.removeEventListener('select-parking', handleSelectParking as EventListener);
    };
  }, [fetchParkings, handleParkingSelect, parkings.length, sessionStatus]);

  // Memo для оптимизации рендеринга элементов списка парковок
  const renderParkingItems = useMemo(() => {
    if (listParkings.length === 0) {
      return (
        <div className="col-span-full text-center py-8 text-gray-500">
          {searchQuery ? (
            <>Парковки не найдены по запросу &quot;{searchQuery}&quot;</>
          ) : (
            <>Парковки не найдены</>
          )}
        </div>
      );
    }
    
    return listParkings.map((parking) => (
      <div 
        key={parking.id} 
        className={`p-3 border rounded-md cursor-pointer transition-all ${
          selectedParking?.id === parking.id 
            ? 'border-orange-500 bg-orange-50' 
            : parking.isIntercepting 
              ? 'border-green-300 hover:bg-green-50'
              : 'border-blue-300 hover:bg-blue-50'
        }`}
        onClick={() => handleParkingSelect(parking)}
      >
        <div className="font-medium">{parking.name}</div>
        <div className="text-sm text-gray-500">{parking.street} {parking.house}</div>
        <div className="flex flex-wrap gap-1 mt-1">
          {parking.subway && (
            <div className="text-xs inline-block px-2 py-0.5 bg-blue-100 rounded-full">
              Метро {parking.subway}
            </div>
          )}
          {parking.isIntercepting ? (
            <div className="text-xs inline-block px-2 py-0.5 bg-green-100 rounded-full">
              Перехватывающая
            </div>
          ) : (
            <div className="text-xs inline-block px-2 py-0.5 bg-orange-100 rounded-full">
              Платная
            </div>
          )}
        </div>
      </div>
    ));
  }, [listParkings, selectedParking, handleParkingSelect, searchQuery]);
  
  // Memo для оптимизации рендеринга кнопок пагинации
  const renderPagination = useMemo(() => {
    if (totalListPages <= 1) return null;
    
    const pages: React.ReactNode[] = [];
    const maxPagesToShow = 5;
    let startPage = Math.max(1, currentPage - Math.floor(maxPagesToShow / 2));
    let endPage = Math.min(totalListPages, startPage + maxPagesToShow - 1);
    
    // Корректируем начальную страницу, если текущая страница близка к концу
    if (endPage - startPage + 1 < maxPagesToShow) {
      startPage = Math.max(1, endPage - maxPagesToShow + 1);
    }
    
    // Добавляем кнопку "Предыдущая"
    pages.push(
      <Button 
        key="prev" 
        variant="outline" 
        size="sm" 
        onClick={() => setCurrentPage(prev => Math.max(1, prev - 1))}
        disabled={currentPage === 1}
        className="px-2 py-0 h-8 text-xs"
      >
        &lt;
      </Button>
    );
    
    // Добавляем первую страницу и многоточие, если начинаем не с первой
    if (startPage > 1) {
      pages.push(
        <Button 
          key="1" 
          variant={currentPage === 1 ? "default" : "outline"} 
          size="sm" 
          onClick={() => setCurrentPage(1)}
          className="px-3 py-0 h-8 text-xs"
        >
          1
        </Button>
      );
      
      if (startPage > 2) {
        pages.push(
          <span key="start-ellipsis" className="px-1">...</span>
        );
      }
    }
    
    // Добавляем страницы
    for (let i = startPage; i <= endPage; i++) {
      pages.push(
        <Button 
          key={i} 
          variant={currentPage === i ? "default" : "outline"} 
          size="sm" 
          onClick={() => setCurrentPage(i)}
          className="px-3 py-0 h-8 text-xs"
        >
          {i}
        </Button>
      );
    }
    
    // Добавляем многоточие и последнюю страницу, если заканчиваем не на последней
    if (endPage < totalListPages) {
      if (endPage < totalListPages - 1) {
        pages.push(
          <span key="end-ellipsis" className="px-1">...</span>
        );
      }
      
      pages.push(
        <Button 
          key={totalListPages} 
          variant={currentPage === totalListPages ? "default" : "outline"} 
          size="sm" 
          onClick={() => setCurrentPage(totalListPages)}
          className="px-3 py-0 h-8 text-xs"
        >
          {totalListPages}
        </Button>
      );
    }
    
    // Добавляем кнопку "Следующая"
    pages.push(
      <Button 
        key="next" 
        variant="outline" 
        size="sm" 
        onClick={() => setCurrentPage(prev => Math.min(totalListPages, prev + 1))}
        disabled={currentPage === totalListPages}
        className="px-2 py-0 h-8 text-xs"
      >
        &gt;
      </Button>
    );
    
    return (
      <div className="flex justify-center mt-4 gap-1 pb-4">
        {pages}
      </div>
    );
  }, [currentPage, totalListPages]);

  // Memo для отображения счетчика результатов
  const resultCount = useMemo(() => {
    return totalListItems > 0 ? (
      <span className="text-sm font-normal ml-2 text-gray-500">
        Найдено: {totalListItems}
      </span>
    ) : null;
  }, [totalListItems]);

  // Показываем индикатор загрузки, пока проверяется авторизация
  if (sessionStatus === 'loading' || !authChecked) {
    return <FullPageLoader />;
  }

  return (
    <main className="min-h-screen flex flex-col">
      <header className="p-2 md:p-4 pt-[calc(var(--tg-safe-area-top)+1.5rem)] md:pt-[calc(var(--tg-safe-area-top)+1rem)] bg-white shadow-sm fixed top-0 left-0 right-0 z-50">
        <div className="container flex justify-between items-center">
          <h1 className="text-base md:text-xl font-bold truncate mr-2">
            <span className="hidden sm:inline">MosParking</span>
            <span className="sm:hidden">Парковки</span>
          </h1>
          <div>
            {session ? (
              <div className="flex items-center gap-1 md:gap-2">
                <span className="text-xs md:text-sm hidden md:inline">
                  {session.user.name || "Пользователь"}
                </span>
                <Button 
                  variant="outline" 
                  size="sm" 
                  className="text-xs py-1 px-2 md:py-2 md:px-4 flex items-center gap-1" 
                  onClick={() => router.push("/profile")}
                >
                  <User className="h-3 w-3 md:h-4 md:w-4" />
                  <span className="hidden xs:inline">Мой профиль</span>
                  <span className="xs:hidden">Профиль</span>
                </Button>
              </div>
            ) : (
              <Suspense fallback={<TelegramLoginFallback />}>
                <TelegramLogin onSuccess={() => fetchParkings()} />
              </Suspense>
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
              <span className="hidden xs:inline">Избранные</span>
              <span className="xs:hidden">Избранные</span>
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
                    parkings={filteredParkingsForMap} 
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
                    allParkings={filteredParkings}
                    interceptingParkings={parkings}
                  />
                </div>
              )}
            </div>
          </TabsContent>
          
          <TabsContent value="list" className="flex-1 animate-in fade-in slide-in-from-right duration-300 ease-in-out">
            {isListLoading ? (
              <div className="w-full flex items-center justify-center py-12">
                <div className="text-center">
                  <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-gray-900 mx-auto"></div>
                  <p className="mt-2 text-gray-600">Загрузка списка парковок...</p>
                </div>
              </div>
            ) : (
              <div className="pt-2 px-4">
                <div className="flex items-center justify-between mb-4 sticky top-0 pt-2 pb-2 bg-white z-10">
                  <h2 className="text-xl font-bold">
                    Список парковок 
                    {resultCount}
                  </h2>
                  <div className="flex gap-2">
                    <Button 
                      variant={parkingType === 'all' ? "default" : "outline"} 
                      size="sm" 
                      onClick={() => handleParkingTypeChange('all')}
                    >
                      Все
                    </Button>
                    <Button 
                      variant={parkingType === 'intercepting' ? "default" : "outline"} 
                      size="sm" 
                      onClick={() => handleParkingTypeChange('intercepting')}
                    >
                      Перехватывающие
                    </Button>
                    <Button 
                      variant={parkingType === 'paid' ? "default" : "outline"} 
                      size="sm" 
                      onClick={() => handleParkingTypeChange('paid')}
                    >
                      Платные
                    </Button>
                  </div>
                </div>
                <div ref={listContainerRef} className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4 max-h-[70vh] overflow-y-auto pb-2">
                  {renderParkingItems}
                </div>
                {renderPagination}
              </div>
            )}
          </TabsContent>
          
          <TabsContent value="favorites" className="flex-1 animate-in fade-in slide-in-from-right duration-300 ease-in-out pt-2">
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
