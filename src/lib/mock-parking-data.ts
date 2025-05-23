/**
 * Fallback mock data generator for when the real API is unreachable
 * This ensures the app can still function when the Moscow API is down
 */

// Fixed capacity data for specific parking IDs
const knownParkingCapacities: Record<string, { total: number, handicapped: number }> = {
  "37709": { total: 93, handicapped: 10 }, // Parking 9179 (data from original API)
  "29794": { total: 68, handicapped: 6 },
  "25285": { total: 105, handicapped: 8 },
};

// Default fallback capacity if the parking ID is unknown
const defaultCapacity = { total: 80, handicapped: 5 };

/**
 * Generate mock parking data with semi-random but realistic occupancy rates
 */
export function generateMockParkingData(parkingId: string) {
  // Get the capacity info (either known or default)
  const capacity = knownParkingCapacities[parkingId] || defaultCapacity;
  
  // Create semi-random occupancy rates based on time of day
  const now = new Date();
  const hour = now.getHours();
  let occupancyRate: number;
  
  // Simulate realistic patterns based on time of day
  if (hour >= 9 && hour <= 19) {
    // Busier during workday (9am-7pm): 50-90% occupied
    occupancyRate = 0.5 + (Math.sin(Date.now() / 10000000) * 0.2 + 0.2);
  } else if ((hour >= 20 && hour <= 23) || (hour >= 0 && hour <= 5)) {
    // Less busy at night (8pm-5am): 10-30% occupied
    occupancyRate = 0.1 + (Math.sin(Date.now() / 10000000) * 0.1 + 0.1);
  } else {
    // Medium busy during early morning/evening: 30-60% occupied
    occupancyRate = 0.3 + (Math.sin(Date.now() / 10000000) * 0.15 + 0.15);
  }
  
  // Calculate free spaces
  const freeSpaces = Math.floor(capacity.total * (1 - occupancyRate));
  const freeHandicapped = Math.floor(capacity.handicapped * (1 - occupancyRate * 0.8)); // Handicapped spaces tend to have lower occupancy
  
  return {
    parking: {
      _id: parkingId,
      congestion: {
        spaces: {
          overall: {
            total: capacity.total,
            free: freeSpaces
          },
          handicapped: {
            total: capacity.handicapped,
            free: freeHandicapped
          }
        },
        updateDate: Date.now()
      }
    },
    isMock: true
  };
} 