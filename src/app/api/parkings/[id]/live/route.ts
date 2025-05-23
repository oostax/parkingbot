import { NextRequest, NextResponse } from "next/server";

// Cache responses for 2 minutes
const CACHE_TIME = 120; // seconds
const cache = new Map<string, { data: Record<string, number>; timestamp: number }>();

// Добавляем настройки таймаута и повторных попыток
const fetchWithRetry = async (url: string, options: RequestInit, retries = 3, timeout = 5000) => {
  // Создаем контроллер для отмены fetch по таймауту
  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), timeout);

  try {
    const response = await fetch(url, {
      ...options,
      signal: controller.signal
    });
    clearTimeout(timeoutId);
    return response;
  } catch (err) {
    clearTimeout(timeoutId);
    
    if (retries <= 1) throw err;
    
    // Добавляем задержку перед повторной попыткой
    await new Promise(resolve => setTimeout(resolve, 500));
    return fetchWithRetry(url, options, retries - 1, timeout);
  }
};

export async function GET(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const parkingId = await params.id;
    
    // Check cache first
    const now = Math.floor(Date.now() / 1000);
    const cachedResponse = cache.get(parkingId);
    if (cachedResponse && now - cachedResponse.timestamp < CACHE_TIME) {
      return NextResponse.json(cachedResponse.data);
    }
    
    // Fetch real-time data from Moscow parking API with retry logic
    const apiUrl = `https://lk.parking.mos.ru/api/3.0/parkings/${parkingId}`;
    
    try {
      const response = await fetchWithRetry(
        apiUrl, 
        {
          headers: {
            "Accept": "application/json",
            "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36"
          },
          cache: "no-store",
        },
        3, // 3 попытки
        7000 // 7 секунд таймаут
      );

      if (!response.ok) {
        throw new Error(`API request failed with status ${response.status}`);
      }

      const data = await response.json();
      
      if (!data.parking) {
        throw new Error("Invalid response format");
      }
      
      // Extract relevant data
      const parkingData = data.parking;
      const spaces = parkingData.congestion?.spaces || {};
      const overall = spaces.overall || {};
      const handicapped = spaces.handicapped || {};
      
      const result = {
        totalSpaces: overall.total || 0,
        freeSpaces: overall.free || 0,
        handicappedTotal: handicapped.total || 0,
        handicappedFree: handicapped.free || 0,
      };
      
      // Update cache
      cache.set(parkingId, { data: result, timestamp: now });
      
      return NextResponse.json(result);
    } catch (error: any) {
      // Если данные не доступны и нет кэша, возвращаем заглушку
      console.error(`Error fetching parking data: ${error.message}`);
      
      // Если в кэше есть старые данные, используем их
      if (cachedResponse) {
        console.log(`Using stale cache for parking ${parkingId}`);
        return NextResponse.json(cachedResponse.data);
      }
      
      // Иначе возвращаем пустые данные с правильной структурой
      return NextResponse.json({
        totalSpaces: 0,
        freeSpaces: 0,
        handicappedTotal: 0,
        handicappedFree: 0,
        dataAvailable: false
      });
    }
  } catch (error) {
    console.error(`Error in API handler: ${error}`);
    return NextResponse.json(
      { error: "Failed to fetch real-time parking data" },
      { status: 500 }
    );
  }
} 