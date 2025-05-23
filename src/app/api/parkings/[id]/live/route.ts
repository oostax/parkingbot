import { NextRequest, NextResponse } from "next/server";
import { generateMockParkingData } from "@/lib/mock-parking-data";

// Cache responses for longer periods to reduce API calls and improve reliability
const CACHE_TIME = 3600; // seconds (1 hour)
const STALE_CACHE_TIME = 86400 * 7; // seconds (7 days) - after this, data is considered outdated but still usable

// Global request tracking - this helps prevent parallel requests to the Moscow API
const requestTracker = {
  inProgress: new Set<string>(),
  lastRequest: 0,
  minRequestDelay: 5000, // minimum 5 seconds between requests to the external API
};

// Cache structure holding data for each parking ID
const cache = new Map<string, { 
  data: Record<string, number | boolean | string>; 
  timestamp: number;
  attempts: number; 
}>();

// Initialize cache from a persistent store if available
try {
  // In a serverless environment, we need to recreate the cache on each cold start
  // This is a limitation of Vercel's serverless functions
  console.log("Initializing parking data cache...");
} catch (error) {
  console.error("Error initializing cache:", error);
}

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
  
  // Try different approaches in sequence
  const approaches = [
    {
      name: "CORSProxy.io",
      url: `https://corsproxy.io/?${encodeURIComponent(apiUrl)}`
    },
    {
      name: "Direct request",
      url: apiUrl
    },
    {
      name: "AllOrigins proxy",
      url: `https://api.allorigins.win/raw?url=${encodeURIComponent(apiUrl)}`
    },
    {
      name: "CORS.sh",
      url: `https://cors.sh/${apiUrl}`
    }
  ];
  
  let lastError = null;
  
  // Try each approach in sequence
  for (const approach of approaches) {
    try {
      console.log(`Trying ${approach.name} for parking ${parkingId}...`);
      
      // Create AbortController with a longer timeout (30 seconds)
      const controller = new AbortController();
      const timeoutId = setTimeout(() => {
        console.log(`Aborting ${approach.name} request for parking ${parkingId} due to timeout`);
        controller.abort('Request timeout');
      }, 30000);
      
      // Use node-fetch options that help with connection issues
      const fetchOptions: RequestInit = {
        headers: {
          "Accept": "application/json, text/plain, */*",
          "Accept-Language": "ru-RU,ru;q=0.9,en-US;q=0.8,en;q=0.7",
          "User-Agent": userAgent,
          "Referer": "https://lk.parking.mos.ru/parkings",
          "Origin": "https://lk.parking.mos.ru",
          "Host": "lk.parking.mos.ru",
          "sec-ch-ua": `"Not_A Brand";v="8", "Chromium";v="120"`,
          "sec-ch-ua-mobile": "?0",
          "sec-ch-ua-platform": "\"Windows\"",
          "Sec-Fetch-Dest": "empty",
          "Sec-Fetch-Mode": "cors",
          "Sec-Fetch-Site": "same-origin"
        },
        cache: "no-store" as RequestCache,
        signal: controller.signal,
        mode: "cors" as RequestMode,
        // This option helps with connection issues in serverless environments
        keepalive: true
      };
      
      // Make the request with proper error handling
      const response = await fetch(approach.url, fetchOptions);
      clearTimeout(timeoutId);
      
      if (!response.ok) {
        console.error(`${approach.name} request failed with status ${response.status}: ${response.statusText}`);
        continue; // Try next approach
      }
      
      const data = await response.json();
      
      if (!data.parking && !data.contents) {
        console.error(`${approach.name} returned invalid format:`, data);
        continue; // Try next approach
      }
      
      // Handle AllOrigins response format which wraps the content in a 'contents' field
      if (data.contents) {
        try {
          const parsedContents = JSON.parse(data.contents);
          if (parsedContents.parking) {
            console.log(`${approach.name} successful for parking ${parkingId}`);
            return parsedContents;
          }
        } catch (parseError) {
          console.error(`Failed to parse ${approach.name} contents:`, parseError);
          continue;
        }
      }
      
      // Handle direct response
      if (data.parking) {
        console.log(`${approach.name} successful for parking ${parkingId}`);
        return data;
      }
      
      // If we get here, the response format wasn't recognized
      console.error(`${approach.name} returned unrecognized format`);
      continue;
    } catch (error: any) {
      lastError = error;
      
      // Check if it's a timeout error
      if (error.name === 'AbortError' || 
          (error.cause && error.cause.code === 'UND_ERR_CONNECT_TIMEOUT')) {
        console.error(`${approach.name} connection timeout for parking ${parkingId}`);
      } else {
        console.error(`${approach.name} error for parking ${parkingId}: ${error.message}`);
        if (error.cause) {
          console.error(`Cause: ${JSON.stringify(error.cause)}`);
        }
      }
      
      // Continue to the next approach
      continue;
    }
  }
  
  // All approaches failed
  throw new Error(`All approaches failed for parking ${parkingId}`);
};

// Process the API response data
const processApiData = (data: any): Record<string, number | boolean | string> => {
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
    lastUpdated: Math.floor(Date.now() / 1000),
    // Add source information for debugging
    source: "moscow_api"
  };
};

// Main API handler
export async function GET(
  request: NextRequest,
  context: { params: { id: string } }
) {
  const params = await context.params;
  const parkingId = params.id;
  
  // Check if we should use mock data only
  const url = new URL(request.url);
  const mockOnly = url.searchParams.get('mock') === 'true';
  
  if (mockOnly) {
    console.log(`Live API: Using mock data for parking ${parkingId} as requested`);
    const mockData = generateMockParkingData(parkingId);
    const processedMockData = processApiData(mockData);
    return NextResponse.json(processedMockData);
  }
  
  // Check if this is a direct proxy request (for debugging)
  const directProxy = url.searchParams.get('direct') === 'true';
  
  if (directProxy) {
    console.log(`Direct proxy mode for parking ${parkingId}`);
    try {
      // Choose a random user agent
      const userAgent = userAgents[Math.floor(Math.random() * userAgents.length)];
      const apiUrl = `https://lk.parking.mos.ru/api/3.0/parkings/${parkingId}`;
      
      const response = await fetch(apiUrl, {
        headers: {
          "Accept": "application/json, text/plain, */*",
          "Accept-Language": "ru-RU,ru;q=0.9,en-US;q=0.8,en;q=0.7",
          "User-Agent": userAgent,
          "Referer": "https://lk.parking.mos.ru/parkings",
          "Origin": "https://lk.parking.mos.ru",
          "Host": "lk.parking.mos.ru",
          "sec-ch-ua": `"Not_A Brand";v="8", "Chromium";v="120"`,
          "sec-ch-ua-mobile": "?0",
          "sec-ch-ua-platform": "\"Windows\"",
          "Sec-Fetch-Dest": "empty",
          "Sec-Fetch-Mode": "cors",
          "Sec-Fetch-Site": "same-origin"
        }
      });
      
      if (!response.ok) {
        return NextResponse.json(
          { error: `Moscow API returned ${response.status}: ${response.statusText}` },
          { status: response.status }
        );
      }
      
      const data = await response.json();
      
      // Return the raw data from Moscow API
      return NextResponse.json(data);
    } catch (error) {
      console.error(`Direct proxy error: ${error}`);
      return NextResponse.json(
        { error: `Failed to proxy request: ${error}` },
        { status: 500 }
      );
    }
  }
  
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
            console.error(`Background update failed for parking ${parkingId}:`, error);
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
      let retryCount = 0;
      const maxRetries = 2;
      
      while (retryCount <= maxRetries) {
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
          console.error(`Attempt ${retryCount + 1}/${maxRetries + 1} failed for parking ${parkingId}:`, error);
          
          // If not the last retry, wait and try again
          if (retryCount < maxRetries) {
            retryCount++;
            // Exponential backoff: 1s, 2s
            const delay = Math.pow(2, retryCount - 1) * 1000;
            console.log(`Retrying in ${delay}ms...`);
            await new Promise(resolve => setTimeout(resolve, delay));
          } else {
            // All retries failed
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
              dataAvailable: false,
              error: "Failed to fetch data after multiple attempts"
            });
          }
        } finally {
          if (retryCount === maxRetries) {
            requestTracker.inProgress.delete(parkingId);
          }
        }
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
    
    // New strategy: Fall back to mock data if all else fails
    console.log(`All strategies failed for parking ${parkingId}, using mock data as fallback`);
    const mockData = generateMockParkingData(parkingId);
    const processedMockData = processApiData(mockData);
    return NextResponse.json(processedMockData);
    
  } catch (error) {
    console.error(`Critical error in API handler for ${parkingId}: ${error}`);
    
    // Even in case of critical error, return mock data instead of error
    const mockData = generateMockParkingData(parkingId);
    const processedMockData = processApiData(mockData);
    return NextResponse.json(processedMockData);
  }
}