import { sql } from '@vercel/postgres';
import { initializeDatabase } from '@/db/schema';
import { PARKING_AREAS, getParkingInfo } from '@/lib/parking-api';

// Moscow districts coordinates
const AREA_COORDINATES = {
  'САО': { lat: 55.8398, lng: 37.5398 },
  'СВАО': { lat: 55.8687, lng: 37.6459 },
  'ВАО': { lat: 55.7887, lng: 37.7798 },
  'ЮВАО': { lat: 55.6704, lng: 37.7366 },
  'ЮАО': { lat: 55.6099, lng: 37.6101 },
  'ЮЗАО': { lat: 55.6399, lng: 37.5199 },
  'ЗАО': { lat: 55.7299, lng: 37.4199 },
  'СЗАО': { lat: 55.8399, lng: 37.4599 },
  'НАО': { lat: 55.5399, lng: 37.2199 }
};

// Function to generate random coordinates around the center point
function generateCoordinates(centerLat: number, centerLng: number) {
  const lat = centerLat + (Math.random() - 0.5) * 0.1; // +/- 0.05 degrees
  const lng = centerLng + (Math.random() - 0.5) * 0.1; // +/- 0.05 degrees
  return { lat, lng };
}

async function seedParkings() {
  console.log('Initializing database...');
  await initializeDatabase();
  
  console.log('Seeding parkings...');
  
  // Process each area
  for (const area in PARKING_AREAS) {
    const parkingIds = PARKING_AREAS[area as keyof typeof PARKING_AREAS];
    const areaCoords = AREA_COORDINATES[area as keyof typeof AREA_COORDINATES];
    
    console.log(`Processing ${area} (${parkingIds.length} parkings)...`);
    
    for (const id of parkingIds) {
      try {
        // Get parking info from API
        const parkingInfo = await getParkingInfo(id);
        
        if (!parkingInfo) {
          console.warn(`No data for parking ${id}, skipping...`);
          continue;
        }
        
        // Generate random coordinates around the area center
        const coords = generateCoordinates(areaCoords.lat, areaCoords.lng);
        
        // Insert into database
        await sql`
          INSERT INTO parkings (
            id, name, street, house, subway, 
            total_spaces, free_spaces, 
            handicapped_total, handicapped_free,
            area, lat, lng, last_updated
          ) VALUES (
            ${id}, 
            ${parkingInfo.name}, 
            ${parkingInfo.street}, 
            ${parkingInfo.house}, 
            ${parkingInfo.subway}, 
            ${parkingInfo.totalSpaces}, 
            ${parkingInfo.freeSpaces}, 
            ${parkingInfo.handicappedTotal}, 
            ${parkingInfo.handicappedFree},
            ${area}, 
            ${coords.lat}, 
            ${coords.lng},
            CURRENT_TIMESTAMP
          )
          ON CONFLICT (id) DO UPDATE SET
            name = EXCLUDED.name,
            street = EXCLUDED.street,
            house = EXCLUDED.house,
            subway = EXCLUDED.subway,
            total_spaces = EXCLUDED.total_spaces,
            free_spaces = EXCLUDED.free_spaces,
            handicapped_total = EXCLUDED.handicapped_total,
            handicapped_free = EXCLUDED.handicapped_free,
            area = EXCLUDED.area,
            lat = EXCLUDED.lat,
            lng = EXCLUDED.lng,
            last_updated = CURRENT_TIMESTAMP
        `;
        
        console.log(`Added parking ${id} - ${parkingInfo.name}`);
      } catch (error) {
        console.error(`Error seeding parking ${id}:`, error);
      }
    }
  }
  
  console.log('Database seeding completed!');
}

// Execute the script
if (require.main === module) {
  seedParkings()
    .then(() => {
      console.log('Seed script completed successfully');
      process.exit(0);
    })
    .catch((error) => {
      console.error('Error running seed script:', error);
      process.exit(1);
    });
}

export default seedParkings; 