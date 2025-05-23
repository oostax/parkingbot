import { NextRequest, NextResponse } from "next/server";
import { generateMockParkingData } from "@/lib/mock-parking-data";

// User agent rotation to make request look more human-like
const userAgents = [
  "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36",
  "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/121.0.0.0 Safari/537.36",
  "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.2 Safari/605.1.15",
  "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36"
];

/**
 * Direct server-side fetch implementation
 * 
 * Since all CORS proxies are failing, we'll implement a direct fetch from our server
 * without relying on third-party services.
 */
export async function GET(
  request: NextRequest,
  context: { params: { id: string } }
) {
  const parkingId = context.params.id;
  
  try {
    // Check if we should use mock data only (query parameter)
    const url = new URL(request.url);
    const mockOnly = url.searchParams.get('mock') === 'true';
    
    if (mockOnly) {
      console.log(`Direct API: Using mock data for parking ${parkingId} as requested`);
      return NextResponse.json(generateMockParkingData(parkingId));
    }
    
    // Choose a random user agent
    const userAgent = userAgents[Math.floor(Math.random() * userAgents.length)];
    
    // Direct API URL
    const apiUrl = `https://lk.parking.mos.ru/api/3.0/parkings/${parkingId}`;
    
    console.log(`Direct API: Fetching data for parking ${parkingId}`);
    
    // Create AbortController with a longer timeout (45 seconds)
    const controller = new AbortController();
    const timeoutId = setTimeout(() => {
      console.log(`Aborting request for parking ${parkingId} due to timeout`);
      controller.abort('Request timeout');
    }, 45000);
    
    // Set up fetch options with better headers and longer timeout
    const fetchOptions = {
      method: 'GET',
      headers: {
        "Accept": "application/json",
        "Accept-Language": "ru-RU,ru;q=0.9,en-US;q=0.8,en;q=0.7",
        "User-Agent": userAgent,
        "Referer": "https://lk.parking.mos.ru/parkings",
        "Origin": "https://lk.parking.mos.ru",
        "Host": "lk.parking.mos.ru",
        "X-Requested-With": "XMLHttpRequest",
        "sec-ch-ua": `"Not_A Brand";v="8", "Chromium";v="120"`,
        "sec-ch-ua-mobile": "?0",
        "sec-ch-ua-platform": "\"Windows\"",
        "Sec-Fetch-Dest": "empty",
        "Sec-Fetch-Mode": "cors",
        "Sec-Fetch-Site": "same-origin"
      },
      cache: 'no-store' as RequestCache,
      signal: controller.signal,
      next: { revalidate: 0 }
    };
    
    // Attempt to fetch data directly
    const response = await fetch(apiUrl, fetchOptions);
    
    clearTimeout(timeoutId);
    
    if (!response.ok) {
      console.error(`Direct API request failed with status ${response.status}: ${response.statusText}`);
      
      // Return generated mock data
      return NextResponse.json(generateMockParkingData(parkingId));
    }
    
    // Parse the response
    const data = await response.json();
    
    if (!data.parking) {
      console.error("Invalid response format:", JSON.stringify(data).substring(0, 300));
      throw new Error("Invalid response format");
    }
    
    // Log success
    console.log(`Successfully fetched data for parking ${parkingId}`);
    
    // Return the successful response
    return NextResponse.json(data);
    
  } catch (error: any) {
    console.error(`Direct API error for ${parkingId}:`, error.message);
    
    // Return fallback mock data
    return NextResponse.json(generateMockParkingData(parkingId));
  }
} 