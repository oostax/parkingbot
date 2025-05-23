import { NextRequest, NextResponse } from "next/server";

// Cache responses for 30 minutes instead of 10 to drastically reduce API calls
const CACHE_TIME = 1800; // seconds (30 minutes)
const STALE_CACHE_TIME = 86400; // seconds (24 hours) - after this, data is considered outdated but still usable

// Global request tracking - this helps prevent parallel requests to the Moscow API
const requestTracker = {
  inProgress: new Set<string>(),
  lastRequest: 0,
  minRequestDelay: 2000, // minimum 2 seconds between requests to the external API
};

// Cache structure holding data for each parking ID
const cache = new Map<string, { 
  data: Record<string, number | boolean>; 
  timestamp: number;
  attempts: number; 
}>();

// User agent rotation to make request look more human-like
const userAgents = [
  "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36",
  "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/121.0.0.0 Safari/537.36",
  "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.2 Safari/605.1.15",
  "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36"
];

// Make a single fetch attempt with better browser emulation
const fetchData = async (parkingId: string): Promise<any> => {
  const apiUrl = `https://lk.parking.mos.ru/api/3.0/parkings/${parkingId}`;
  
  // Ensure we're not making requests too quickly
  const now = Date.now();
  const timeSinceLastRequest = now - requestTracker.lastRequest;
  if (timeSinceLastRequest < requestTracker.minRequestDelay) {
    const delay = requestTracker.minRequestDelay - timeSinceLastRequest;
    console.log(`Throttling API request, waiting ${delay}ms...`);
    await new Promise(resolve => setTimeout(resolve, delay));
  }
  
  // Update last request time
  requestTracker.lastRequest = Date.now();
  
  // Choose a random user agent
  const userAgent = userAgents[Math.floor(Math.random() * userAgents.length)];
  
  try {
    console.log(`Fetching data for parking ${parkingId}...`);
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 10000);
    
    const response = await fetch(apiUrl, {
      headers: {
        "Accept": "application/json, text/plain, */*",
        "Accept-Language": "ru-RU,ru;q=0.9,en-US;q=0.8,en;q=0.7",
        "User-Agent": userAgent,
        "Referer": "https://lk.parking.mos.ru/parkings",
        "Origin": "https://lk.parking.mos.ru",
        "sec-ch-ua": `"Not_A Brand";v="8", "Chromium";v="120"`,
        "sec-ch-ua-mobile": "?0",
        "sec-ch-ua-platform": "\"Windows\"",
        "Sec-Fetch-Dest": "empty",
        "Sec-Fetch-Mode": "cors",
        "Sec-Fetch-Site": "same-origin",
        "Connection": "keep-alive",
        "Cache-Control": "no-cache",
        "Pragma": "no-cache"
      },
      cache: "no-store",
      signal: controller.signal
    });
    
    clearTimeout(timeoutId);
    
    if (!response.ok) {
      throw new Error(`API request failed with status ${response.status}`);
    }
    
    const data = await response.json();
    
    if (!data.parking) {
      throw new Error("Invalid response format");
    }
    
    return data;
  } catch (error: any) {
    console.error(`Error fetching parking data: ${error.message}`);
    throw error;
  }
};

// Process the API response data
const processApiData = (data: any): Record<string, number | boolean> => {
  const parkingData = data.parking;
  const spaces = parkingData.congestion?.spaces || {};
  const overall = spaces.overall || {};
  const handicapped = spaces.handicapped || {};
  
  return {
    totalSpaces: overall.total || 0,
    freeSpaces: overall.free || 0,
    handicappedTotal: handicapped.total || 0,
    handicappedFree: handicapped.free || 0,
    dataAvailable: true,
    lastUpdated: Math.floor(Date.now() / 1000)
  };
};

// Main API handler
export async function GET(
  request: NextRequest,
  context: { params: { id: string } }
) {
  const params = await context.params;
  const parkingId = params.id;
  
  try {
    const now = Math.floor(Date.now() / 1000);
    const cachedResponse = cache.get(parkingId);
    
    // STRATEGY 1: Return fresh cache immediately if available
    if (cachedResponse && now - cachedResponse.timestamp < CACHE_TIME) {
      // If it's not too old, return immediately
      console.log(`Using fresh cached data for parking ${parkingId} (${Math.round((now - cachedResponse.timestamp) / 60)} minutes old)`);
      return NextResponse.json(cachedResponse.data);
    }
    
    // STRATEGY 2: Return stale cache AND refresh in background
    if (cachedResponse && now - cachedResponse.timestamp < STALE_CACHE_TIME) {
      // Only make a new request if we're not already fetching this parking ID
      if (!requestTracker.inProgress.has(parkingId)) {
        requestTracker.inProgress.add(parkingId);
        
        // Fetch fresh data in the background (don't await it)
        setTimeout(async () => {
          try {
            const data = await fetchData(parkingId);
            const processedData = processApiData(data);
            
            // Update cache with new data
            cache.set(parkingId, { 
              data: processedData, 
              timestamp: Math.floor(Date.now() / 1000),
              attempts: 0
            });
            console.log(`Background update successful for parking ${parkingId}`);
          } catch (error) {
            console.error(`Background update failed for parking ${parkingId}`);
            // Increment failed attempt count
            if (cachedResponse) {
              cache.set(parkingId, {
                ...cachedResponse,
                attempts: (cachedResponse.attempts || 0) + 1
              });
            }
          } finally {
            requestTracker.inProgress.delete(parkingId);
          }
        }, 100);
      }
      
      // Immediately return stale cache data with isStale flag
      console.log(`Using stale cache for parking ${parkingId} while refreshing in background`);
      return NextResponse.json({
        ...cachedResponse.data,
        isStale: true
      });
    }
    
    // STRATEGY 3: No usable cache, make synchronous request
    if (!requestTracker.inProgress.has(parkingId)) {
      try {
        requestTracker.inProgress.add(parkingId);
        const data = await fetchData(parkingId);
        const processedData = processApiData(data);
        
        // Save to cache
        cache.set(parkingId, { 
          data: processedData, 
          timestamp: now,
          attempts: 0
        });
        
        console.log(`Successfully fetched fresh data for parking ${parkingId}`);
        return NextResponse.json(processedData);
      } catch (error) {
        // If we have any cached data (even very old), return it in case of error
        if (cachedResponse) {
          return NextResponse.json({
            ...cachedResponse.data,
            isStale: true,
            dataAvailable: true
          });
        }
        
        // No cached data at all, return empty data
        return NextResponse.json({
          totalSpaces: 0,
          freeSpaces: 0,
          handicappedTotal: 0,
          handicappedFree: 0,
          dataAvailable: false
        });
      } finally {
        requestTracker.inProgress.delete(parkingId);
      }
    } else {
      // Already fetching this parking ID, return a waiting status
      console.log(`Request for ${parkingId} already in progress, returning temporary data`);
      return NextResponse.json({
        totalSpaces: 0,
        freeSpaces: 0, 
        handicappedTotal: 0,
        handicappedFree: 0,
        dataAvailable: true,
        isLoading: true
      });
    }
  } catch (error) {
    console.error(`Critical error in API handler for ${parkingId}: ${error}`);
    return NextResponse.json(
      { error: "Failed to fetch parking data", dataAvailable: false },
      { status: 500 }
    );
  }
}