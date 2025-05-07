import { sql } from '@vercel/postgres';

// Types
export interface Parking {
  id: string;
  name: string;
  street: string;
  house: string;
  subway: string;
  total_spaces: number;
  free_spaces: number;
  handicapped_total: number;
  handicapped_free: number;
  area: string;
  lat: number;
  lng: number;
  last_updated: Date;
}

export interface ParkingStats {
  hour: number;
  avg_free_spaces: number;
  avg_occupancy: number;
}

export interface UserFavorite {
  id: number;
  parking_id: string;
  notify_enabled: boolean;
}

// Parking functions
export async function getAllParkings(): Promise<Parking[]> {
  try {
    const result = await sql<Parking>`
      SELECT * FROM parkings
      ORDER BY area, name
    `;
    return result.rows;
  } catch (error) {
    console.error('Error fetching parkings:', error);
    return [];
  }
}

export async function getParkingById(id: string): Promise<Parking | null> {
  try {
    const result = await sql<Parking>`
      SELECT * FROM parkings
      WHERE id = ${id}
    `;
    return result.rows[0] || null;
  } catch (error) {
    console.error('Error fetching parking:', error);
    return null;
  }
}

export async function getParkingsByMetro(subway: string): Promise<Parking[]> {
  try {
    const result = await sql<Parking>`
      SELECT * FROM parkings
      WHERE subway = ${subway}
      ORDER BY name
    `;
    return result.rows;
  } catch (error) {
    console.error('Error fetching parkings by metro:', error);
    return [];
  }
}

export async function updateParkingSpaces(
  id: string,
  free_spaces: number,
  total_spaces: number,
  handicapped_free: number,
  handicapped_total: number
): Promise<boolean> {
  try {
    await sql`
      UPDATE parkings
      SET 
        free_spaces = ${free_spaces},
        total_spaces = ${total_spaces},
        handicapped_free = ${handicapped_free},
        handicapped_total = ${handicapped_total},
        last_updated = CURRENT_TIMESTAMP
      WHERE id = ${id}
    `;
    
    // Record stats
    await sql`
      INSERT INTO parking_stats 
      (parking_id, timestamp, free_spaces, total_spaces)
      VALUES (${id}, CURRENT_TIMESTAMP, ${free_spaces}, ${total_spaces})
    `;
    
    return true;
  } catch (error) {
    console.error('Error updating parking spaces:', error);
    return false;
  }
}

// User favorite functions
export async function getUserFavorites(userId: string): Promise<Parking[]> {
  try {
    const result = await sql<Parking>`
      SELECT p.* 
      FROM parkings p
      JOIN favorites f ON p.id = f.parking_id
      WHERE f.user_id = ${userId}
      ORDER BY p.name
    `;
    return result.rows;
  } catch (error) {
    console.error('Error fetching user favorites:', error);
    return [];
  }
}

export async function addFavorite(userId: string, parkingId: string): Promise<boolean> {
  try {
    await sql`
      INSERT INTO favorites (user_id, parking_id)
      VALUES (${userId}, ${parkingId})
      ON CONFLICT (user_id, parking_id) DO NOTHING
    `;
    return true;
  } catch (error) {
    console.error('Error adding favorite:', error);
    return false;
  }
}

export async function removeFavorite(userId: string, parkingId: string): Promise<boolean> {
  try {
    await sql`
      DELETE FROM favorites
      WHERE user_id = ${userId} AND parking_id = ${parkingId}
    `;
    return true;
  } catch (error) {
    console.error('Error removing favorite:', error);
    return false;
  }
}

export async function toggleNotification(userId: string, parkingId: string): Promise<boolean> {
  try {
    await sql`
      UPDATE favorites
      SET notify_enabled = NOT notify_enabled
      WHERE user_id = ${userId} AND parking_id = ${parkingId}
    `;
    return true;
  } catch (error) {
    console.error('Error toggling notification:', error);
    return false;
  }
}

export async function getNotificationStatus(userId: string, parkingId: string): Promise<boolean> {
  try {
    const result = await sql`
      SELECT notify_enabled
      FROM favorites
      WHERE user_id = ${userId} AND parking_id = ${parkingId}
    `;
    return result.rows[0]?.notify_enabled || false;
  } catch (error) {
    console.error('Error getting notification status:', error);
    return false;
  }
}

// Stats and forecast functions
export async function getParkingForecast(parkingId: string): Promise<ParkingStats[]> {
  try {
    const result = await sql<ParkingStats>`
      SELECT hour, avg_free_spaces, avg_occupancy
      FROM daily_stats
      WHERE parking_id = ${parkingId}
      ORDER BY hour
    `;
    
    if (result.rows.length === 0) {
      // If no stats, return current state for all hours
      const currentState = await sql`
        SELECT free_spaces, total_spaces
        FROM parking_stats
        WHERE parking_id = ${parkingId}
        ORDER BY timestamp DESC
        LIMIT 1
      `;
      
      if (currentState.rows.length > 0) {
        const { free_spaces, total_spaces } = currentState.rows[0];
        const occupancy = total_spaces > 0 ? 
          (total_spaces - free_spaces) / total_spaces : 0;
        
        return Array.from({ length: 24 }, (_, i) => ({
          hour: i,
          avg_free_spaces: free_spaces,
          avg_occupancy: occupancy
        }));
      }
    }
    
    return result.rows;
  } catch (error) {
    console.error('Error getting parking forecast:', error);
    return [];
  }
} 