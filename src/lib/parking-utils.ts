import { ParkingInfo, ParkingStats, ParkingData } from "@/types/parking";

/**
 * Fetch all parking locations from the data file
 */
export async function getAllParkings(): Promise<ParkingInfo[]> {
  try {
    const response = await fetch('/data/parking_data.json');
    const data = await response.json();
    
    return data.map((parking: any) => ({
      id: parking.id,
      name: parking.name,
      street: parking.street || "",
      house: parking.house || "",
      subway: parking.subway || "",
      lat: parking.lat,
      lng: parking.lon || parking.lng,
      lon: parking.lon || parking.lng,
      polygon: parking.polygon || [],
      isFavorite: false,
      // Initialize with null values for real-time data
      totalSpaces: null,
      freeSpaces: null,
      handicappedTotal: null,
      handicappedFree: null,
    }));
  } catch (error) {
    console.error("Error fetching parking data:", error);
    return [];
  }
}

/**
 * Fetch real-time data for a specific parking
 */
export async function getParkingRealTimeData(parkingId: string): Promise<{
  totalSpaces: number;
  freeSpaces: number;
  handicappedTotal: number;
  handicappedFree: number;
  dataAvailable?: boolean;
  isStale?: boolean;
} | null> {
  // Try multiple approaches to get the data
  const approaches = [
    { url: `/api/parkings/${parkingId}/live`, name: "Standard API" },
    { url: `/api/parkings/direct/${parkingId}`, name: "Direct Proxy" }
  ];
  
  let lastError: any = null;
  
  // Try each approach in sequence
  for (const approach of approaches) {
    try {
      console.log(`Requesting data for parking ${parkingId} using ${approach.name}...`);
      
      // Add cache-busting parameter to prevent browser caching
      const cacheBuster = `?_t=${Date.now()}`;
      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort('Request timeout'), 15000);
      
      const response = await fetch(`${approach.url}${cacheBuster}`, {
        signal: controller.signal,
        cache: 'no-store',
        headers: {
          'Cache-Control': 'no-cache, no-store, must-revalidate',
          'Pragma': 'no-cache',
        }
      });
      
      clearTimeout(timeoutId);
      
      if (!response.ok) {
        console.error(`${approach.name} failed: ${response.status} ${response.statusText}`);
        continue; // Try next approach
      }
      
      const data = await response.json();
      
      // Check for error message in response
      if (data.error) {
        console.error(`${approach.name} returned error: ${data.error}`);
        continue; // Try next approach
      }
      
      // Handle direct proxy response format
      if (approach.name === "Direct Proxy" && data.parking?.congestion?.spaces) {
        const spaces = data.parking.congestion.spaces;
        const overall = spaces.overall || {};
        const handicapped = spaces.handicapped || {};
        
        console.log(`Successfully loaded data for parking ${parkingId} using ${approach.name}`);
        return {
          totalSpaces: overall.total || 0,
          freeSpaces: overall.free || 0,
          handicappedTotal: handicapped.total || 0,
          handicappedFree: handicapped.free || 0,
          dataAvailable: true
        };
      }
      
      // Handle standard API response format
      if ('dataAvailable' in data && data.dataAvailable === false) {
        console.log(`No data available for parking ${parkingId} using ${approach.name}`);
        return {
          totalSpaces: 0,
          freeSpaces: 0,
          handicappedTotal: 0,
          handicappedFree: 0,
          dataAvailable: false
        };
      }
      
      console.log(`Successfully loaded data for parking ${parkingId} using ${approach.name}`);
      return {
        totalSpaces: data.totalSpaces || 0,
        freeSpaces: data.freeSpaces || 0,
        handicappedTotal: data.handicappedTotal || 0,
        handicappedFree: data.handicappedFree || 0,
        isStale: data.isStale || false
      };
    } catch (error: any) {
      // Store the error for reporting if all approaches fail
      lastError = error;
      
      // Check if it's an abort error
      if (error.name === 'AbortError') {
        console.error(`${approach.name} request for parking ${parkingId} timed out`);
      } else {
        console.error(`Error fetching data using ${approach.name} for parking ${parkingId}:`, error);
      }
    }
  }
  
  // All approaches failed
  console.error(`All approaches failed for parking ${parkingId}. Last error:`, lastError);
  return null;
}

/**
 * Get the occupancy status class based on percentage of free spaces
 */
export function getOccupancyStatusClass(freeSpaces: number, totalSpaces: number): string {
  if (totalSpaces === 0) return 'status-unknown';
  
  const percentage = (freeSpaces / totalSpaces) * 100;
  
  if (percentage >= 30) return 'status-free';
  if (percentage >= 10) return 'status-limited';
  return 'status-full';
}

/**
 * Format parking statistics for display
 */
export function formatParkingStats(stats: ParkingStats[]): {
  labels: string[];
  data: number[];
  colors: string[];
} {
  const hours = stats.map(stat => `${stat.hour}:00`);
  const freeSpaces = stats.map(stat => stat.avg_free_spaces);
  
  // Generate colors based on occupancy
  const colors = stats.map(stat => {
    const occupancyPercent = stat.avg_occupancy * 100;
    if (occupancyPercent >= 90) return '#ef4444'; // red-500
    if (occupancyPercent >= 70) return '#f97316'; // orange-500
    return '#22c55e'; // green-500
  });
  
  return {
    labels: hours,
    data: freeSpaces,
    colors,
  };
} 