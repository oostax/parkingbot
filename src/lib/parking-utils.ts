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
} | null> {
  try {
    const response = await fetch(`/api/parkings/${parkingId}/live`);
    if (!response.ok) {
      throw new Error(`Failed to fetch parking data: ${response.statusText}`);
    }
    
    const data = await response.json();
    return {
      totalSpaces: data.totalSpaces || 0,
      freeSpaces: data.freeSpaces || 0,
      handicappedTotal: data.handicappedTotal || 0,
      handicappedFree: data.handicappedFree || 0,
    };
  } catch (error) {
    console.error(`Error fetching real-time data for parking ${parkingId}:`, error);
    return null;
  }
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