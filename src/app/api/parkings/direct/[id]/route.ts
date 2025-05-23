import { NextRequest, NextResponse } from "next/server";

// User agent rotation to make request look more human-like
const userAgents = [
  "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36",
  "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/121.0.0.0 Safari/537.36",
  "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.2 Safari/605.1.15",
  "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36"
];

/**
 * Direct proxy endpoint that uses a CORS proxy to reliably fetch data
 * This is a simpler implementation with fewer moving parts than the main endpoint
 */
export async function GET(
  request: NextRequest,
  context: { params: { id: string } }
) {
  const parkingId = context.params.id;
  
  try {
    // Choose a random user agent
    const userAgent = userAgents[Math.floor(Math.random() * userAgents.length)];
    
    // Use a CORS proxy to bypass network restrictions
    const apiUrl = `https://lk.parking.mos.ru/api/3.0/parkings/${parkingId}`;
    // Try multiple CORS proxies in case one fails
    const proxyServices = [
      `https://api.allorigins.win/raw?url=${encodeURIComponent(apiUrl)}`,
      `https://corsproxy.io/?${encodeURIComponent(apiUrl)}`,
      `https://cors-anywhere.herokuapp.com/${apiUrl}`
    ];

    // Use the first proxy by default
    const proxyUrl = proxyServices[0];

    console.log(`Direct proxy: Fetching data for parking ${parkingId} via AllOrigins proxy`);
    
    // Create AbortController with a timeout
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort('Request timeout'), 25000);
    
    const response = await fetch(proxyUrl, {
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
      },
      cache: "no-store" as RequestCache,
      signal: controller.signal,
      mode: "cors" as RequestMode,
      keepalive: true
    });
    
    clearTimeout(timeoutId);
    
    if (!response.ok) {
      console.error(`Direct proxy: API request failed with status ${response.status}`);
      return NextResponse.json(
        { error: `Failed to fetch data: ${response.status} ${response.statusText}` },
        { status: response.status }
      );
    }
    
    const data = await response.json();
    
    // Return the raw data
    return NextResponse.json(data);
  } catch (error: any) {
    console.error(`Direct proxy: Error fetching data for ${parkingId}:`, error);
    
    return NextResponse.json(
      { 
        error: `Failed to fetch parking data: ${error.message}`,
        details: error.cause ? JSON.stringify(error.cause) : undefined
      },
      { status: 500 }
    );
  }
} 