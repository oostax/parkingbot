import { NextRequest, NextResponse } from "next/server";
import axios from "axios";
import axiosRetry from "axios-retry";

// Cache responses for 30 minutes instead of 10 to drastically reduce API calls
const CACHE_TIME = 1800; // seconds (30 minutes)
const STALE_CACHE_TIME = 86400; // seconds (24 hours) - after this, data is considered outdated but still usable

// Cache structure holding data for each parking ID
const cache = new Map<string, { 
  data: Record<string, number | boolean>; 
  timestamp: number;
  attempts: number; 
}>();

// Session management - create one persistent axios instance instead of using fetch
// This mirrors the Python requests.Session() approach
const apiClient = axios.create({
  timeout: 10000,
  headers: {
    "Accept": "application/json, text/plain, */*",
    "Accept-Language": "ru-RU,ru;q=0.9,en-US;q=0.8,en;q=0.7",
    "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36",
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
  }
});

// Configure retry strategy similar to Python's urllib3.Retry
axiosRetry(apiClient, {
  retries: 3,
  retryDelay: (retryCount) => {
    return retryCount * 1000; // Backoff factor of 1 second (like Python version)
  },
  retryCondition: (error) => {
    return Boolean(
      axiosRetry.isNetworkOrIdempotentRequestError(error) || 
      (error.response && [429, 500, 502, 503, 504].includes(error.response.status))
    );
  },
  onRetry: (retryCount, error, requestConfig) => {
    console.log(`Retry attempt ${retryCount} for ${requestConfig.url}`);
  }
});

// Global request tracking to prevent parallel requests
let lastRequestTime = 0;
const minRequestDelay = 2000; // 2 seconds between requests
const inProgressRequests = new Set<string>();

// Make a single fetch attempt with better browser emulation
const fetchParkingData = async (parkingId: string) => {
  const apiUrl = `https://lk.parking.mos.ru/api/3.0/parkings/${parkingId}`;
  
  // Implement request throttling like in Python version
  const now = Date.now();
  const timeSinceLastRequest = now - lastRequestTime;
  if (timeSinceLastRequest < minRequestDelay) {
    const delay = minRequestDelay - timeSinceLastRequest;
    console.log(`Throttling API request, waiting ${delay}ms...`);
    await new Promise(resolve => setTimeout(resolve, delay));
  }
  
  // Update last request time
  lastRequestTime = Date.now();
  
  try {
    console.log(`Fetching data for parking ${parkingId}...`);
    const response = await apiClient.get(apiUrl);
    
    if (!response.data.parking) {
      throw new Error("Invalid response format");
    }
    
    return response.data;
  } catch (error: any) {
    // Enhanced error logging like in Python version
    console.error(`Error fetching parking data: ${error.message}`);
    if (error.response) {
      console.error(`Response status code: ${error.response.status}`);
      console.error(`Response content: ${JSON.stringify(error.response.data).substring(0, 200)}`);
    }
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
      if (!inProgressRequests.has(parkingId)) {
        inProgressRequests.add(parkingId);
        
        // Fetch fresh data in the background (don't await it)
        setTimeout(async () => {
          try {
            const data = await fetchParkingData(parkingId);
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
            inProgressRequests.delete(parkingId);
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
    if (!inProgressRequests.has(parkingId)) {
      try {
        inProgressRequests.add(parkingId);
        const data = await fetchParkingData(parkingId);
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
        inProgressRequests.delete(parkingId);
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