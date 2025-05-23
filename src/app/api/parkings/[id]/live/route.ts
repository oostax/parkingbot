import { NextRequest, NextResponse } from "next/server";

// Cache responses for 10 minutes to reduce API calls
const CACHE_TIME = 600; // seconds
const cache = new Map<string, { data: Record<string, number | boolean>; timestamp: number }>();

// Добавляем настройки таймаута и повторных попыток
const fetchWithRetry = async (url: string, options: RequestInit, retries = 3, timeout = 15000) => {
  // Создаем контроллер для отмены fetch по таймауту
  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), timeout);

  try {
    // Добавляем случайную задержку от 100 до 500 мс чтобы избежать блокировки
    await new Promise(resolve => setTimeout(resolve, 100 + Math.random() * 400));
    
    const response = await fetch(url, {
      ...options,
      signal: controller.signal
    });
    clearTimeout(timeoutId);
    return response;
  } catch (err) {
    clearTimeout(timeoutId);
    
    if (retries <= 1) throw err;
    
    console.log(`Retry attempt for ${url}, ${retries-1} attempts remaining`);
    // Экспоненциальная задержка с случайным компонентом (jitter)
    const delay = Math.pow(2, 4 - retries) * 1000 + Math.random() * 1000;
    console.log(`Waiting ${Math.round(delay)}ms before next retry...`);
    await new Promise(resolve => setTimeout(resolve, delay));
    return fetchWithRetry(url, options, retries - 1, timeout);
  }
};

export async function GET(
  request: NextRequest,
  context: { params: { id: string } }
) {
  try {
    const params = await context.params;
    const parkingId = params.id;
    
    // Check cache first
    const now = Math.floor(Date.now() / 1000);
    const cachedResponse = cache.get(parkingId);
    if (cachedResponse && now - cachedResponse.timestamp < CACHE_TIME) {
      console.log(`Using cached data for parking ${parkingId} (${Math.round((now - cachedResponse.timestamp) / 60)} minutes old)`);
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
            "Accept-Language": "ru-RU,ru;q=0.9,en-US;q=0.8,en;q=0.7",
            "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36",
            "Referer": "https://lk.parking.mos.ru/",
            "Origin": "https://lk.parking.mos.ru",
            "sec-ch-ua": `"Not_A Brand";v="8", "Chromium";v="120"`,
            "sec-ch-ua-mobile": "?0",
            "sec-ch-ua-platform": "\"Windows\"",
            "Sec-Fetch-Dest": "empty",
            "Sec-Fetch-Mode": "cors", 
            "Sec-Fetch-Site": "same-origin",
            "Connection": "keep-alive"
          },
          cache: "no-store",
        },
        3, // 3 попытки
        15000 // 15 секунд таймаут
      );

      if (!response.ok) {
        console.error(`API returned status code: ${response.status}`);
        throw new Error(`API request failed with status ${response.status}`);
      }

      const data = await response.json();
      
      if (!data.parking) {
        console.error("Invalid response format from API:", JSON.stringify(data).substring(0, 200));
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
        dataAvailable: true,
        lastUpdated: now
      };
      
      // Update cache
      cache.set(parkingId, { data: result, timestamp: now });
      console.log(`Successfully fetched fresh data for parking ${parkingId}`);
      
      return NextResponse.json(result);
    } catch (error: any) {
      // Если данные не доступны и нет кэша, возвращаем заглушку
      console.error(`Error fetching parking data: ${error.message}`);
      
      // Если в кэше есть старые данные, используем их и указываем, что данные могут быть устаревшими
      if (cachedResponse) {
        console.log(`Using stale cache for parking ${parkingId} (${Math.round((now - cachedResponse.timestamp) / 60)} minutes old)`);
        return NextResponse.json({
          ...cachedResponse.data,
          isStale: true
        });
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
      { error: "Failed to fetch real-time parking data", dataAvailable: false },
      { status: 500 }
    );
  }
}